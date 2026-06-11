import { cp, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRecentTestRuns } from "../test-runs.js";

const fixtureRoot = new URL("./fixtures/project/", import.meta.url);

async function createProjectCopy(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "devloop-test-runs-"));
  await cp(fixtureRoot, projectRoot, { recursive: true });
  return projectRoot;
}

async function writeRun(
  projectRoot: string,
  date: string,
  fileName: string,
  executedAt: string
): Promise<void> {
  const runPath = join(projectRoot, ".devloop", "test-runs", date, fileName);
  await mkdir(join(projectRoot, ".devloop", "test-runs", date), { recursive: true });
  await writeFile(
    runPath,
    JSON.stringify(
      {
        run_id: fileName.replace(/\.json$/, ""),
        status: "passed",
        revision: {
          kind: "snapshot",
          snapshotId: "snap_000001"
        },
        scenario_ids: ["app-smoke-local"],
        scope: "smoke",
        artifacts: [],
        executed_at: executedAt
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

describe("loadRecentTestRuns", () => {
  it("returns the most recent runs first and respects the requested limit", async () => {
    const projectRoot = await createProjectCopy();
    await writeRun(projectRoot, "2026-06-09", "run-older.json", "2026-06-09T09:00:00.000Z");
    await writeRun(projectRoot, "2026-06-10", "run-middle.json", "2026-06-10T08:00:00.000Z");
    await writeRun(projectRoot, "2026-06-10", "run-latest.json", "2026-06-10T10:00:00.000Z");

    const runs = await loadRecentTestRuns(projectRoot, 2);

    expect(runs).toHaveLength(2);
    expect(runs.map((run) => run.run_id)).toEqual(["run-latest", "run-middle"]);
    expect(runs[0].executed_at).toBe("2026-06-10T10:00:00.000Z");
  });
});
