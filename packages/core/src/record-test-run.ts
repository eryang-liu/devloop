import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadProjectConfig } from "./config.js";
import { normalizeProjectRoot } from "./paths.js";
import { loadRegistry, saveRegistry, type Registry } from "./registry.js";
import { type Revision } from "./revision.js";
import { testRunSchema, type TestRun } from "./test-runs.js";

export type RecordTestRunInput = {
  runId?: string;
  status: TestRun["status"];
  scope: TestRun["scope"];
  scenarioIds: string[];
  artifacts?: string[];
  executedAt?: string;
  revision?: Revision;
};

export type RecordTestRunResult = {
  run: TestRun;
  registry: Registry;
};

function buildScenarioCatalog(config: Awaited<ReturnType<typeof loadProjectConfig>>): Set<string> {
  return new Set([
    ...config.test.smoke_scenarios,
    ...config.features.flatMap((feature) => feature.scenarios)
  ]);
}

function buildCoveredFeatureIds(
  config: Awaited<ReturnType<typeof loadProjectConfig>>,
  scenarioIds: string[]
): Set<string> {
  const coveredScenarios = new Set(scenarioIds);

  return new Set(
    config.features
      .filter((feature) => feature.scenarios.some((scenarioId) => coveredScenarios.has(scenarioId)))
      .map((feature) => feature.id)
  );
}

function inferRevision(registry: Registry, input: RecordTestRunInput): Revision {
  const revision = input.revision ?? registry.vcs.lastRevision;

  if (!revision) {
    throw new Error("No active revision found. Run `devloop sync` before recording a test run.");
  }

  return revision;
}

function buildRunId(executedAt: string): string {
  return `run_${executedAt.replaceAll(/[-:.TZ]/g, "").slice(0, 17).toLowerCase()}`;
}

function updateRegistryForRun(
  registry: Registry,
  coveredFeatureIds: Set<string>,
  run: TestRun
): Registry {
  const features = registry.features.map((feature) => {
    if (!coveredFeatureIds.has(feature.featureId)) {
      return feature;
    }

    if (run.status === "passed") {
      return {
        ...feature,
        status: "tested" as const,
        lastVerifiedRunId: run.run_id,
        lastVerifiedRevision: run.revision
      };
    }

    if (run.status === "failed") {
      return {
        ...feature,
        status: "failed" as const
      };
    }

    return {
      ...feature,
      status: "rework_untested" as const
    };
  });

  return {
    ...registry,
    features,
    impactQueue:
      run.status === "passed"
        ? registry.impactQueue.filter((item) => !coveredFeatureIds.has(item.featureId))
        : registry.impactQueue
  };
}

export async function recordTestRun(
  projectRoot: string | URL,
  input: RecordTestRunInput
): Promise<RecordTestRunResult> {
  const [config, registry] = await Promise.all([
    loadProjectConfig(projectRoot),
    loadRegistry(projectRoot)
  ]);
  const root = normalizeProjectRoot(projectRoot);
  const scenarioIds = [...new Set(input.scenarioIds)];

  if (scenarioIds.length === 0) {
    throw new Error("At least one scenario id is required.");
  }

  const knownScenarios = buildScenarioCatalog(config);

  for (const scenarioId of scenarioIds) {
    if (!knownScenarios.has(scenarioId)) {
      throw new Error(`Unknown scenario id: ${scenarioId}`);
    }
  }

  const revision = inferRevision(registry, input);
  const executedAt = input.executedAt ?? new Date().toISOString();
  const run = testRunSchema.parse({
    run_id: input.runId ?? buildRunId(executedAt),
    status: input.status,
    revision,
    scenario_ids: scenarioIds,
    scope: input.scope,
    artifacts: input.artifacts ?? [],
    executed_at: executedAt
  });
  const coveredFeatureIds = buildCoveredFeatureIds(config, run.scenario_ids);
  const nextRegistry = updateRegistryForRun(registry, coveredFeatureIds, run);
  const runDir = join(root, config.paths.test_runs, executedAt.slice(0, 10));

  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, `${run.run_id}.json`), JSON.stringify(run, null, 2) + "\n", "utf8");
  await saveRegistry(projectRoot, nextRegistry);

  return {
    run,
    registry: nextRegistry
  };
}
