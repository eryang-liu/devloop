import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { loadProjectConfig } from "./config.js";
import { normalizeProjectRoot } from "./paths.js";
import {
  revisionFromLegacySha,
  revisionSchema,
  revisionTokenSchema
} from "./revision.js";

export const testRunSchema = z
  .object({
    run_id: z.string().min(1),
    status: z.enum(["passed", "failed", "partial", "aborted"]),
    revision: revisionSchema.optional(),
    commit_sha: revisionTokenSchema.optional(),
    scenario_ids: z.array(z.string().min(1)),
    scope: z.enum(["smoke", "impacted", "current", "current+p0", "full"]),
    artifacts: z.array(z.string().min(1)).default([]),
    executed_at: z.string().datetime().optional()
  })
  .strict()
  .transform((run) => ({
    run_id: run.run_id,
    status: run.status,
    revision:
      run.revision ??
      revisionFromLegacySha(run.commit_sha) ?? {
        kind: "snapshot" as const,
        snapshotId: "snap_000001"
      },
    scenario_ids: run.scenario_ids,
    scope: run.scope,
    artifacts: run.artifacts,
    executed_at: run.executed_at ?? null
  }));

export type TestRun = z.output<typeof testRunSchema>;

export async function loadAllTestRuns(projectRoot: string | URL): Promise<TestRun[]> {
  const config = await loadProjectConfig(projectRoot);
  const root = normalizeProjectRoot(projectRoot);
  const baseDir = join(root, config.paths.test_runs);

  let days;

  try {
    days = await readdir(baseDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const runs: TestRun[] = [];

  for (const day of days) {
    if (!day.isDirectory()) {
      continue;
    }

    const files = await readdir(join(baseDir, day.name));

    for (const file of files) {
      if (!file.endsWith(".json")) {
        continue;
      }

      const raw = await readFile(join(baseDir, day.name, file), "utf8");
      runs.push(testRunSchema.parse(JSON.parse(raw)));
    }
  }

  return runs;
}

export async function loadRecentTestRuns(
  projectRoot: string | URL,
  limit = 5
): Promise<TestRun[]> {
  const runs = await loadAllTestRuns(projectRoot);

  return runs
    .sort((a, b) => {
      if (a.executed_at && b.executed_at) {
        return b.executed_at.localeCompare(a.executed_at);
      }

      if (a.executed_at) {
        return -1;
      }

      if (b.executed_at) {
        return 1;
      }

      return b.run_id.localeCompare(a.run_id);
    })
    .slice(0, limit);
}
