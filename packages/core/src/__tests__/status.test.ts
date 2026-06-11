import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRegistry, saveRegistry } from "../registry.js";
import { getStatusSummary } from "../status.js";

const fixtureProjectRoot = fileURLToPath(new URL("./fixtures/project", import.meta.url));

async function createTempProject(): Promise<string> {
  const tempRoot = await mkdtemp(join(tmpdir(), "devloop-status-"));
  const projectRoot = join(tempRoot, "project");

  await cp(fixtureProjectRoot, projectRoot, { recursive: true });

  return projectRoot;
}

describe("getStatusSummary", () => {
  it("counts feature states and returns the highest risk list", async () => {
    const projectRoot = await createTempProject();
    const summary = await getStatusSummary(projectRoot);

    expect(summary.counts.changed_untested).toBe(1);
    expect(summary.counts.tested).toBe(1);
    expect(summary.highRiskFeatures.map((item) => item.featureId)).toEqual(["host-listen"]);
    expect(summary.vcs.mode).toBe("snapshot");
  });

  it("treats config features missing from the registry as never_tested high risk", async () => {
    const projectRoot = await createTempProject();
    const registryPath = join(projectRoot, ".devloop", "registry.json");
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
      features: Array<{ featureId: string }>;
    };

    registry.features = registry.features.filter((item) => item.featureId !== "host-listen");
    await writeFile(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf8");

    const summary = await getStatusSummary(projectRoot);

    expect(summary.counts.never_tested).toBe(1);
    expect(summary.counts.changed_untested).toBe(0);
    expect(summary.counts.tested).toBe(1);
    expect(summary.highRiskFeatures).toEqual([
      { featureId: "host-listen", status: "never_tested" }
    ]);
  });

  it("ignores stale registry-only entries that no longer exist in config", async () => {
    const projectRoot = await createTempProject();
    const configPath = join(projectRoot, ".devloop", "config.yml");
    const config = await readFile(configPath, "utf8");

    await writeFile(
      configPath,
      config.replace(
        /  - id: embed-shell[\s\S]*?    invariants: \[\]\n/,
        ""
      ),
      "utf8"
    );

    const summary = await getStatusSummary(projectRoot);

    expect(summary.counts.changed_untested).toBe(1);
    expect(summary.counts.tested).toBe(0);
    expect(summary.counts.never_tested).toBe(0);
    expect(summary.highRiskFeatures).toEqual([
      { featureId: "host-listen", status: "changed_untested" }
    ]);
  });

  it("round-trips registry data through saveRegistry and loadRegistry", async () => {
    const projectRoot = await createTempProject();
    const registry = await loadRegistry(projectRoot);

    registry.lastSyncAt = "2026-06-10T10:00:00.000Z";
    registry.impactQueue = [
      {
        featureId: "host-listen",
        confidence: "high",
        reasons: ["matched:frontend/src/hostListen.tsx"],
        recommendedScope: "current+p0",
        detectedAt: "2026-06-10T10:00:00.000Z",
        sourceRevision: {
          kind: "git",
          commitSha: "def5678"
        }
      }
    ];

    await saveRegistry(projectRoot, registry);

    await expect(loadRegistry(projectRoot)).resolves.toEqual(registry);
  });

  it("rejects invalid registry data on save without overwriting the persisted file", async () => {
    const projectRoot = await createTempProject();
    const registryPath = join(projectRoot, ".devloop", "registry.json");
    const original = await readFile(registryPath, "utf8");
    const registry = await loadRegistry(projectRoot);

    await expect(
      saveRegistry(projectRoot, {
        ...registry,
        impactQueue: [
          {
            featureId: "host-listen",
            confidence: "high"
          }
        ]
      } as never)
    ).rejects.toThrow();

    await expect(readFile(registryPath, "utf8")).resolves.toBe(original);
  });
});
