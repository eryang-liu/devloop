import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { describe, expect, it } from "vitest";
import { runReleaseCheck } from "../release-check.js";

const fixtureRoot = new URL("./fixtures/project/", import.meta.url);

async function createProjectCopy(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "devloop-release-check-"));
  await cp(fixtureRoot, projectRoot, { recursive: true });
  return projectRoot;
}

async function updateConfig(
  projectRoot: string,
  mutate: (config: Record<string, unknown>) => void
): Promise<void> {
  const configPath = join(projectRoot, ".devloop", "config.yml");
  const config = parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
  mutate(config);
  await writeFile(configPath, stringify(config), "utf8");
}

async function updateRegistry(
  projectRoot: string,
  mutate: (registry: {
    version: number;
    lastSyncAt: string | null;
    impactQueue: Array<{ featureId: string }>;
    features: Array<Record<string, unknown>>;
  }) => void
): Promise<void> {
  const registryPath = join(projectRoot, ".devloop", "registry.json");
  const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
    version: number;
    lastSyncAt: string | null;
    impactQueue: Array<{ featureId: string }>;
    features: Array<Record<string, unknown>>;
  };
  mutate(registry);
  await writeFile(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf8");
}

async function writeSmokeRun(
  projectRoot: string,
  {
    fileName,
    revision,
    scenarioIds
  }: {
    fileName: string;
    revision:
      | {
          kind: "git";
          commitSha: string;
        }
      | {
          kind: "snapshot";
          snapshotId: string;
        };
    scenarioIds: string[];
  }
): Promise<void> {
  const runPath = join(projectRoot, ".devloop", "test-runs", "2026-06-10", fileName);
  await writeFile(
    runPath,
    JSON.stringify(
      {
        run_id: fileName.replace(/\.json$/, ""),
        status: "passed",
        revision,
        scenario_ids: scenarioIds,
        scope: "smoke",
        artifacts: ["logs/smoke.txt"]
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

async function writeIteration(
  projectRoot: string,
  iteration: {
    id: string;
    title: string;
    status: "active" | "paused" | "done" | "reopened" | "archived";
    acceptanceItems?: Array<{ status: "pending" | "in_progress" | "verified" | "failed" | "waived" }>;
    regressionItems?: Array<{ status: "pending" | "in_progress" | "verified" | "failed" | "waived" }>;
  }
): Promise<void> {
  const iterationPath = join(projectRoot, ".devloop", "iterations", `${iteration.id}.json`);
  await mkdir(join(projectRoot, ".devloop", "iterations"), { recursive: true });
  await writeFile(
    iterationPath,
    JSON.stringify(
      {
        id: iteration.id,
        slug: iteration.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: iteration.title,
        status: iteration.status,
        source: "manual",
        createdAt: "2026-06-11T10:00:00.000Z",
        updatedAt: "2026-06-11T10:10:00.000Z",
        closedAt: null,
        reopenedFrom: null,
        rawUserIntent: iteration.title,
        goal: iteration.title,
        nonGoals: [],
        acceptanceItems: (iteration.acceptanceItems ?? []).map((item, index) => ({
          id: `acc_${index + 1}`,
          title: `Acceptance ${index + 1}`,
          type: "acceptance",
          priority: "P0",
          rationale: "",
          suggestedScope: "smoke",
          status: item.status,
          evidenceLinks: []
        })),
        regressionItems: (iteration.regressionItems ?? []).map((item, index) => ({
          id: `reg_${index + 1}`,
          title: `Regression ${index + 1}`,
          type: "regression",
          priority: "P1",
          rationale: "",
          suggestedScope: "current+p0",
          status: item.status,
          evidenceLinks: []
        })),
        affectedFeatures: [],
        affectedPaths: [],
        changeEvents: [],
        testRunIds: [],
        evidenceLinks: [],
        releaseStatus: "unknown",
        conversationRefs: []
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

describe("runReleaseCheck", () => {
  it("blocks when a P0 feature is changed and no head smoke run exists", async () => {
    const result = await runReleaseCheck(new URL("./fixtures/project", import.meta.url), {
      currentRevision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(result.decision).toBe("block");
    expect(result.mode).toBe("git");
    expect(result.unmetRequirements).toContain("missing_head_smoke_run");
  });

  it("blocks when a P0 feature is unverified even if the current SHA has a smoke run", async () => {
    const projectRoot = await createProjectCopy();
    await writeSmokeRun(projectRoot, {
      fileName: "run-current-smoke.json",
      revision: {
        kind: "git",
        commitSha: "new5678"
      },
      scenarioIds: ["app-smoke-local"]
    });

    const result = await runReleaseCheck(projectRoot, {
      currentRevision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(result.decision).toBe("block");
    expect(result.unmetRequirements).toContain("p0_not_verified:host-listen");
    expect(result.unmetRequirements).not.toContain("missing_head_smoke_run");
  });

  it("blocks when a P0 feature is needs-triage", async () => {
    const projectRoot = await createProjectCopy();
    await updateRegistry(projectRoot, (registry) => {
      const hostListen = registry.features.find((feature) => feature.featureId === "host-listen");
      if (hostListen) {
        hostListen.status = "needs-triage";
      }
    });
    await writeSmokeRun(projectRoot, {
      fileName: "run-current-smoke.json",
      revision: {
        kind: "git",
        commitSha: "new5678"
      },
      scenarioIds: ["app-smoke-local"]
    });

    const result = await runReleaseCheck(projectRoot, {
      currentRevision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(result.decision).toBe("block");
    expect(result.unmetRequirements).toContain("p0_not_verified:host-listen");
  });

  it("blocks when a config-defined P0 feature is missing from the registry", async () => {
    const projectRoot = await createProjectCopy();
    await updateRegistry(projectRoot, (registry) => {
      registry.features = registry.features.filter((feature) => feature.featureId !== "host-listen");
    });
    await writeSmokeRun(projectRoot, {
      fileName: "run-current-smoke.json",
      revision: {
        kind: "git",
        commitSha: "new5678"
      },
      scenarioIds: ["app-smoke-local"]
    });

    const result = await runReleaseCheck(projectRoot, {
      currentRevision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(result.decision).toBe("block");
    expect(result.unmetRequirements).toContain("p0_not_verified:host-listen");
  });

  it("does not block on P0 untested state when block_on_p0_untested is false", async () => {
    const projectRoot = await createProjectCopy();
    await updateConfig(projectRoot, (config) => {
      const gate = config.gate as Record<string, unknown>;
      gate.block_on_p0_untested = false;
    });
    await writeSmokeRun(projectRoot, {
      fileName: "run-current-smoke.json",
      revision: {
        kind: "git",
        commitSha: "new5678"
      },
      scenarioIds: ["app-smoke-local"]
    });

    const result = await runReleaseCheck(projectRoot, {
      currentRevision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(result.decision).toBe("pass");
    expect(result.unmetRequirements).not.toContain("p0_not_verified:host-listen");
  });

  it("passes when the current SHA has the expected smoke run and there are no blocking P0 issues", async () => {
    const projectRoot = await createProjectCopy();
    await updateRegistry(projectRoot, (registry) => {
      const hostListen = registry.features.find((feature) => feature.featureId === "host-listen");
      if (hostListen) {
        hostListen.status = "tested";
        hostListen.lastVerifiedRunId = "run-current-smoke";
        hostListen.lastVerifiedSha = "new5678";
      }
    });
    await writeSmokeRun(projectRoot, {
      fileName: "run-current-smoke.json",
      revision: {
        kind: "git",
        commitSha: "new5678"
      },
      scenarioIds: ["app-smoke-local"]
    });

    const result = await runReleaseCheck(projectRoot, {
      currentRevision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(result.decision).toBe("pass");
    expect(result.unmetRequirements).toEqual([]);
  });

  it("blocks when the current SHA smoke run does not cover the configured smoke scenarios", async () => {
    const projectRoot = await createProjectCopy();
    await updateRegistry(projectRoot, (registry) => {
      const hostListen = registry.features.find((feature) => feature.featureId === "host-listen");
      if (hostListen) {
        hostListen.status = "tested";
        hostListen.lastVerifiedRunId = "run-current-smoke";
        hostListen.lastVerifiedSha = "new5678";
      }
    });
    await writeSmokeRun(projectRoot, {
      fileName: "run-current-smoke.json",
      revision: {
        kind: "git",
        commitSha: "new5678"
      },
      scenarioIds: ["different-smoke-scenario"]
    });

    const result = await runReleaseCheck(projectRoot, {
      currentRevision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(result.decision).toBe("block");
    expect(result.unmetRequirements).toContain("missing_head_smoke_run");
  });

  it("returns a snapshot-mode warning instead of crashing when git is absent but P0s are verified", async () => {
    const projectRoot = await createProjectCopy();
    await updateRegistry(projectRoot, (registry) => {
      const hostListen = registry.features.find((feature) => feature.featureId === "host-listen");
      if (hostListen) {
        hostListen.status = "tested";
        hostListen.lastVerifiedRunId = "run-snapshot-smoke";
        hostListen.lastVerifiedRevision = {
          kind: "snapshot",
          snapshotId: "snap_000001"
        };
      }
    });
    await writeSmokeRun(projectRoot, {
      fileName: "run-snapshot-smoke.json",
      revision: {
        kind: "snapshot",
        snapshotId: "snap_000001"
      },
      scenarioIds: ["app-smoke-local"]
    });

    const result = await runReleaseCheck(projectRoot, {
      currentRevision: {
        kind: "snapshot",
        snapshotId: "snap_000001"
      }
    });

    expect(result.decision).toBe("warn");
    expect(result.mode).toBe("snapshot");
    expect(result.unmetRequirements).toContain("missing_git_revision_evidence");
    expect(result.notes).toContain(
      "Running in snapshot mode without commit-backed release evidence"
    );
  });

  it("passes in snapshot mode when strict snapshot evidence is explicitly disabled", async () => {
    const projectRoot = await createProjectCopy();
    await updateRegistry(projectRoot, (registry) => {
      const hostListen = registry.features.find((feature) => feature.featureId === "host-listen");
      if (hostListen) {
        hostListen.status = "tested";
        hostListen.lastVerifiedRunId = "run-snapshot-smoke";
        hostListen.lastVerifiedRevision = {
          kind: "snapshot",
          snapshotId: "snap_000001"
        };
      }
    });
    await writeSmokeRun(projectRoot, {
      fileName: "run-snapshot-smoke.json",
      revision: {
        kind: "snapshot",
        snapshotId: "snap_000001"
      },
      scenarioIds: ["app-smoke-local"]
    });

    const result = await runReleaseCheck(projectRoot, {
      currentRevision: {
        kind: "snapshot",
        snapshotId: "snap_000001"
      },
      strictSnapshot: false
    });

    expect(result.decision).toBe("pass");
    expect(result.mode).toBe("snapshot");
    expect(result.unmetRequirements).toEqual([]);
    expect(result.notes).toContain(
      "Snapshot git evidence requirement skipped by strict-snapshot override"
    );
  });

  it("passes in snapshot mode when project config disables strict snapshot evidence by default", async () => {
    const projectRoot = await createProjectCopy();
    await updateConfig(projectRoot, (config) => {
      const gate = config.gate as Record<string, unknown>;
      gate.strict_snapshot = false;
    });
    await updateRegistry(projectRoot, (registry) => {
      const hostListen = registry.features.find((feature) => feature.featureId === "host-listen");
      if (hostListen) {
        hostListen.status = "tested";
        hostListen.lastVerifiedRunId = "run-snapshot-smoke";
        hostListen.lastVerifiedRevision = {
          kind: "snapshot",
          snapshotId: "snap_000001"
        };
      }
    });
    await writeSmokeRun(projectRoot, {
      fileName: "run-snapshot-smoke.json",
      revision: {
        kind: "snapshot",
        snapshotId: "snap_000001"
      },
      scenarioIds: ["app-smoke-local"]
    });

    const result = await runReleaseCheck(projectRoot, {
      currentRevision: {
        kind: "snapshot",
        snapshotId: "snap_000001"
      }
    });

    expect(result.decision).toBe("pass");
    expect(result.mode).toBe("snapshot");
    expect(result.unmetRequirements).toEqual([]);
    expect(result.notes).toContain(
      "Snapshot git evidence requirement skipped by project config"
    );
  });

  it("blocks when an active iteration still has pending checklist items", async () => {
    const projectRoot = await createProjectCopy();
    await updateRegistry(projectRoot, (registry) => {
      const hostListen = registry.features.find((feature) => feature.featureId === "host-listen");
      if (hostListen) {
        hostListen.status = "tested";
        hostListen.lastVerifiedRunId = "run-current-smoke";
        hostListen.lastVerifiedSha = "new5678";
      }
    });
    await writeSmokeRun(projectRoot, {
      fileName: "run-current-smoke.json",
      revision: {
        kind: "git",
        commitSha: "new5678"
      },
      scenarioIds: ["app-smoke-local"]
    });
    await writeIteration(projectRoot, {
      id: "iter_001",
      title: "Wizard refactor",
      status: "active",
      acceptanceItems: [{ status: "verified" }, { status: "pending" }],
      regressionItems: [{ status: "verified" }]
    });

    const result = await runReleaseCheck(projectRoot, {
      currentRevision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(result.decision).toBe("block");
    expect(result.unmetRequirements).toContain("iteration_pending:iter_001");
  });
});
