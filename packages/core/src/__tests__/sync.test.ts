import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { saveRegistry } from "../registry.js";
import { syncProject } from "../sync.js";

const fixtureProjectRoot = fileURLToPath(new URL("./fixtures/project", import.meta.url));
const execFileAsync = promisify(execFile);

async function createTempProject(): Promise<string> {
  const tempRoot = await mkdtemp(join(tmpdir(), "devloop-sync-"));
  const projectRoot = join(tempRoot, "project");

  await cp(fixtureProjectRoot, projectRoot, { recursive: true });

  return projectRoot;
}

async function seedTrackedFiles(projectRoot: string): Promise<void> {
  await mkdir(join(projectRoot, "frontend", "src"), { recursive: true });
  await writeFile(
    join(projectRoot, "frontend", "src", "hostListen.tsx"),
    "export const hostListen = 'baseline-host';\n",
    "utf8"
  );
  await writeFile(
    join(projectRoot, "frontend", "src", "embedShell.tsx"),
    "export const embedShell = 'baseline-embed';\n",
    "utf8"
  );
}

async function runGit(projectRoot: string, args: string[]) {
  await execFileAsync("git", args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "DevLoop Test",
      GIT_AUTHOR_EMAIL: "devloop@example.com",
      GIT_COMMITTER_NAME: "DevLoop Test",
      GIT_COMMITTER_EMAIL: "devloop@example.com"
    }
  });
}

describe("syncProject", () => {
  it("transitions impacted features from explicit git-backed input, updates change metadata, and leaves unrelated entries untouched", async () => {
    const result = await syncProject(new URL("./fixtures/project", import.meta.url), {
      changedFiles: ["frontend/src/embedShell.tsx"],
      revision: {
        kind: "git",
        commitSha: "new5678"
      },
      vcsState: {
        mode: "git",
        gitRoot: "/tmp/fixture-project",
        headSha: "new5678"
      },
      now: "2026-06-10T10:00:00.000Z"
    });

    expect(result.lastSyncAt).toBe("2026-06-10T10:00:00.000Z");
    expect(result.vcs.mode).toBe("git");
    expect(result.impactQueue).toHaveLength(1);

    expect(result.impactQueue[0]).toEqual({
      featureId: "embed-shell",
      confidence: "medium",
      reasons: ["matched:frontend/src/embedShell.tsx"],
      recommendedScope: "impacted",
      detectedAt: "2026-06-10T10:00:00.000Z",
      sourceRevision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(result.features.find((item) => item.featureId === "embed-shell")).toMatchObject({
      featureId: "embed-shell",
      status: "changed_untested",
      lastChangedAt: "2026-06-10T10:00:00.000Z",
      lastChangedRevision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(result.features.find((item) => item.featureId === "host-listen")).toMatchObject({
      featureId: "host-listen",
      status: "changed_untested",
      lastChangedAt: "2026-06-10T08:58:00.000Z",
      lastChangedRevision: {
        kind: "git",
        commitSha: "abc1234"
      }
    });
  });

  it("adds impacted config features back when they are missing from the registry", async () => {
    const projectRoot = await createTempProject();
    const registryPath = join(projectRoot, ".devloop", "registry.json");
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
      features: Array<{ featureId: string }>;
    };

    registry.features = registry.features.filter((item) => item.featureId !== "embed-shell");
    await writeFile(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf8");

    const result = await syncProject(projectRoot, {
      changedFiles: ["frontend/src/embedShell.tsx"],
      revision: {
        kind: "git",
        commitSha: "new5678"
      },
      vcsState: {
        mode: "git",
        gitRoot: projectRoot,
        headSha: "new5678"
      },
      now: "2026-06-10T10:00:00.000Z"
    });

    expect(result.features.find((item) => item.featureId === "embed-shell")).toEqual({
      featureId: "embed-shell",
      status: "changed_untested",
      iteration: 1,
      activeChecklist: [],
      lastChangedAt: "2026-06-10T10:00:00.000Z",
      lastChangedRevision: {
        kind: "git",
        commitSha: "new5678"
      },
      lastVerifiedRunId: null,
      lastVerifiedRevision: null
    });
  });

  it("captures snapshot-backed changes when no git repository exists", async () => {
    const projectRoot = await createTempProject();
    await seedTrackedFiles(projectRoot);

    const firstSync = await syncProject(projectRoot, {
      now: "2026-06-10T10:00:00.000Z"
    });
    await saveRegistry(projectRoot, firstSync);

    await writeFile(
      join(projectRoot, "frontend", "src", "embedShell.tsx"),
      "export const embedShell = 'changed-after-snapshot';\n",
      "utf8"
    );

    const result = await syncProject(projectRoot, {
      now: "2026-06-10T10:05:00.000Z"
    });

    expect(result.vcs.mode).toBe("snapshot");
    expect(result.vcs.headSha).toBeNull();
    expect(result.vcs.historyBridge).toBeNull();
    expect(result.impactQueue).toEqual([
      {
        featureId: "embed-shell",
        confidence: "medium",
        reasons: ["matched:frontend/src/embedShell.tsx"],
        recommendedScope: "impacted",
        detectedAt: "2026-06-10T10:05:00.000Z",
        sourceRevision: {
          kind: "snapshot",
          snapshotId: "snap_000002"
        }
      }
    ]);
    expect(result.features.find((item) => item.featureId === "embed-shell")).toMatchObject({
      status: "changed_untested",
      lastChangedRevision: {
        kind: "snapshot",
        snapshotId: "snap_000002"
      }
    });
  });

  it("automatically upgrades snapshot history to git-backed mode once HEAD exists", async () => {
    const projectRoot = await createTempProject();
    await seedTrackedFiles(projectRoot);

    const firstSync = await syncProject(projectRoot, {
      now: "2026-06-10T10:00:00.000Z"
    });
    await saveRegistry(projectRoot, firstSync);

    await runGit(projectRoot, ["init"]);
    await runGit(projectRoot, ["add", "."]);
    await runGit(projectRoot, ["commit", "-m", "initial import"]);

    const result = await syncProject(projectRoot, {
      now: "2026-06-10T10:10:00.000Z"
    });

    expect(result.vcs.mode).toBe("git");
    expect(result.vcs.gitRoot?.endsWith("/project")).toBe(true);
    expect(result.vcs.headSha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.vcs.historyBridge).toEqual({
      fromRevision: {
        kind: "snapshot",
        snapshotId: "snap_000001"
      },
      toRevision: {
        kind: "git",
        commitSha: result.vcs.headSha
      },
      createdAt: "2026-06-10T10:10:00.000Z"
    });
  });
});
