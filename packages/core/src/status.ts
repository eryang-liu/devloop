import { loadProjectConfig } from "./config.js";
import { detectProjectVcsState } from "./git.js";
import { loadRegistry, type FeatureState, type Registry } from "./registry.js";

type StatusCounts = Record<FeatureState["status"], number>;

export type StatusSummary = {
  counts: StatusCounts;
  highRiskFeatures: Array<{
    featureId: string;
    status: FeatureState["status"];
  }>;
  lastSyncAt: Registry["lastSyncAt"];
  vcs: {
    mode: "snapshot" | "git-pending" | "git";
    gitRoot: string | null;
    headSha: string | null;
    projectId: string | null;
    upgradedFromSnapshotAt: string | null;
  };
};

export async function getStatusSummary(projectRoot: string | URL): Promise<StatusSummary> {
  const [config, registry, vcsState] = await Promise.all([
    loadProjectConfig(projectRoot),
    loadRegistry(projectRoot),
    detectProjectVcsState(projectRoot)
  ]);

  const counts: StatusCounts = {
    never_tested: 0,
    changed_untested: 0,
    rework_untested: 0,
    tested: 0,
    failed: 0,
    "needs-triage": 0
  };

  const registryFeaturesById = new Map(
    registry.features.map((feature) => [feature.featureId, feature] as const)
  );

  const highRiskFeatures = config.features
    .map((feature) => {
      const registryFeature = registryFeaturesById.get(feature.id);
      const status: FeatureState["status"] = registryFeature?.status ?? "never_tested";

      counts[status] += 1;

      return {
        priority: feature.priority,
        featureId: feature.id,
        status
      };
    })
    .filter((feature) => feature.priority === "P0" && feature.status !== "tested")
    .map(({ featureId, status }) => ({ featureId, status }));

  return {
    counts,
    highRiskFeatures,
    lastSyncAt: registry.lastSyncAt,
    vcs: {
      mode: vcsState.mode,
      gitRoot: vcsState.gitRoot,
      headSha: vcsState.headSha,
      projectId: registry.projectId,
      upgradedFromSnapshotAt: registry.vcs.historyBridge?.createdAt ?? null
    }
  };
}
