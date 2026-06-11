import { loadProjectConfig } from "./config.js";
import { detectProjectVcsState, type ProjectVcsState } from "./git.js";
import { listIterations } from "./iterations.js";
import { loadRegistry } from "./registry.js";
import { evaluateIterationReleaseStatus } from "./release-iterations.js";
import type { Revision } from "./revision.js";
import { loadAllTestRuns } from "./test-runs.js";

export type ReleaseCheckInput = {
  currentRevision?: Revision;
  strictSnapshot?: boolean;
  vcsState?: ProjectVcsState;
};

export type ReleaseCheckResult = {
  decision: "pass" | "block" | "warn";
  mode: ProjectVcsState["mode"];
  impactedFeatures: string[];
  unmetRequirements: string[];
  notes: string[];
};

const P0_UNVERIFIED_STATUSES = new Set([
  "changed_untested",
  "rework_untested",
  "failed",
  "never_tested",
  "needs-triage"
]);

function isCoveredSmokeRun(
  run: { scenario_ids: string[]; revision: Revision },
  requiredScenarioIds: string[],
  revision: Revision
): boolean {
  if (revision.kind === "git") {
    if (run.revision.kind !== "git" || run.revision.commitSha !== revision.commitSha) {
      return false;
    }
  } else if (run.revision.kind !== "snapshot" || run.revision.snapshotId !== revision.snapshotId) {
    return false;
  }

  if (requiredScenarioIds.length === 0) {
    return true;
  }

  const coveredScenarioIds = new Set(run.scenario_ids);
  return requiredScenarioIds.every((scenarioId) => coveredScenarioIds.has(scenarioId));
}

function snapshotModeNote(mode: ProjectVcsState["mode"]) {
  if (mode === "git-pending") {
    return "Git detected but no HEAD exists yet; continuing with snapshot-backed release evidence";
  }

  return "Running in snapshot mode without commit-backed release evidence";
}

export async function runReleaseCheck(
  projectRoot: string | URL,
  input: ReleaseCheckInput = {}
): Promise<ReleaseCheckResult> {
  const [config, registry, runs, detectedVcsState, iterations] = await Promise.all([
    loadProjectConfig(projectRoot),
    loadRegistry(projectRoot),
    loadAllTestRuns(projectRoot),
    input.vcsState ? Promise.resolve(input.vcsState) : detectProjectVcsState(projectRoot),
    listIterations(projectRoot).catch(() => [])
  ]);
  const vcsState =
    input.vcsState ??
    (input.currentRevision?.kind === "git"
      ? {
          mode: "git" as const,
          gitRoot: detectedVcsState.gitRoot,
          headSha: input.currentRevision.commitSha
        }
      : detectedVcsState);

  const blockingRequirements = new Set<string>();
  const advisoryRequirements = new Set<string>();
  const notes: string[] = [];
  const impactedFeatures = registry.impactQueue.map((item) => item.featureId);
  const registryFeaturesById = new Map(
    registry.features.map((feature) => [feature.featureId, feature] as const)
  );
  const currentRevision =
    input.currentRevision ??
    (vcsState.mode === "git" && vcsState.headSha
      ? {
          kind: "git" as const,
          commitSha: vcsState.headSha
        }
      : registry.vcs.lastRevision);
  const strictSnapshot = input.strictSnapshot ?? config.gate.strict_snapshot;

  if (config.gate.require_head_smoke_pass) {
    if (vcsState.mode === "git" && currentRevision?.kind === "git") {
      const latestSmoke = runs.find((run) => {
        return (
          run.scope === "smoke" &&
          run.status === "passed" &&
          isCoveredSmokeRun(run, config.test.smoke_scenarios, currentRevision)
        );
      });

      if (!latestSmoke) {
        blockingRequirements.add("missing_head_smoke_run");
      }
    } else if (strictSnapshot) {
      advisoryRequirements.add("missing_git_revision_evidence");
      notes.push(snapshotModeNote(vcsState.mode));
    } else {
      notes.push(
        input.strictSnapshot === false
          ? "Snapshot git evidence requirement skipped by strict-snapshot override"
          : "Snapshot git evidence requirement skipped by project config"
      );
    }
  }

  const relevantIterations = iterations.filter(
    (item) => item.status === "active" || item.status === "reopened"
  );
  const iterationGate = evaluateIterationReleaseStatus(relevantIterations);

  for (const requirement of iterationGate.unmetRequirements) {
    blockingRequirements.add(requirement);
  }

  for (const definition of config.features) {
    if (definition.priority !== "P0") {
      continue;
    }

    const feature = registryFeaturesById.get(definition.id);
    const featureStatus = feature?.status ?? "never_tested";

    if (config.gate.block_on_p0_untested && P0_UNVERIFIED_STATUSES.has(featureStatus)) {
      blockingRequirements.add(`p0_not_verified:${definition.id}`);
    }

    if (config.gate.require_scenario_for_p0 && definition.scenarios.length === 0) {
      blockingRequirements.add(`missing_scenario:${definition.id}`);
    }
  }

  return {
    decision:
      blockingRequirements.size > 0 ? "block" : advisoryRequirements.size > 0 ? "warn" : "pass",
    mode: vcsState.mode,
    impactedFeatures,
    unmetRequirements: [...blockingRequirements, ...advisoryRequirements],
    notes
  };
}
