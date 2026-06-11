import { cp, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRegistry } from "../registry.js";
import { recordTestRun } from "../record-test-run.js";

const fixtureRoot = new URL("./fixtures/project/", import.meta.url);

async function createProjectCopy(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "devloop-record-run-"));
  await cp(fixtureRoot, projectRoot, { recursive: true });
  return projectRoot;
}

describe("recordTestRun", () => {
  it("writes a passed run and marks covered features as tested for the current revision", async () => {
    const projectRoot = await createProjectCopy();

    const result = await recordTestRun(projectRoot, {
      runId: "run-smoke-current",
      scope: "smoke",
      status: "passed",
      scenarioIds: ["app-smoke-local", "host-listen-smoke"],
      executedAt: "2026-06-10T10:30:00.000Z",
      revision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(result.run).toEqual({
      run_id: "run-smoke-current",
      status: "passed",
      revision: {
        kind: "git",
        commitSha: "new5678"
      },
      scenario_ids: ["app-smoke-local", "host-listen-smoke"],
      scope: "smoke",
      artifacts: [],
      executed_at: "2026-06-10T10:30:00.000Z"
    });

    const persistedRun = JSON.parse(
      await readFile(
        join(projectRoot, ".devloop", "test-runs", "2026-06-10", "run-smoke-current.json"),
        "utf8"
      )
    );

    expect(persistedRun).toEqual(result.run);

    const registry = await loadRegistry(projectRoot);
    expect(registry.features.find((feature) => feature.featureId === "host-listen")).toMatchObject({
      status: "tested",
      lastVerifiedRunId: "run-smoke-current",
      lastVerifiedRevision: {
        kind: "git",
        commitSha: "new5678"
      }
    });
  });

  it("marks covered features as failed when a run fails", async () => {
    const projectRoot = await createProjectCopy();

    await recordTestRun(projectRoot, {
      runId: "run-host-listen-failed",
      scope: "impacted",
      status: "failed",
      scenarioIds: ["host-listen-smoke"],
      executedAt: "2026-06-10T10:35:00.000Z",
      revision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    const registry = await loadRegistry(projectRoot);

    expect(registry.features.find((feature) => feature.featureId === "host-listen")).toMatchObject({
      status: "failed",
      lastVerifiedRunId: null,
      lastVerifiedRevision: null
    });
  });

  it("generates distinct automatic run ids within the same second", async () => {
    const projectRoot = await createProjectCopy();

    const first = await recordTestRun(projectRoot, {
      scope: "impacted",
      status: "passed",
      scenarioIds: ["embed-shell-smoke"],
      executedAt: "2026-06-10T10:35:00.123Z",
      revision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    const second = await recordTestRun(projectRoot, {
      scope: "impacted",
      status: "passed",
      scenarioIds: ["embed-shell-smoke"],
      executedAt: "2026-06-10T10:35:00.987Z",
      revision: {
        kind: "git",
        commitSha: "new5678"
      }
    });

    expect(first.run.run_id).not.toBe(second.run.run_id);
  });
});
