export type FeatureStatus =
  | "never_tested"
  | "changed_untested"
  | "rework_untested"
  | "tested"
  | "failed"
  | "needs-triage";

export type Revision =
  | {
      kind: "git";
      commitSha: string;
    }
  | {
      kind: "snapshot";
      snapshotId: string;
    };

export type StatusSummary = {
  counts: Record<FeatureStatus, number>;
  highRiskFeatures: Array<{
    featureId: string;
    status: FeatureStatus;
  }>;
  lastSyncAt: string | null;
  vcs: {
    mode: "snapshot" | "git-pending" | "git";
    gitRoot: string | null;
    headSha: string | null;
    projectId: string | null;
    upgradedFromSnapshotAt: string | null;
  };
};

export type ImpactRecord = {
  featureId: string;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  recommendedScope: "smoke" | "impacted" | "current+p0" | "full";
  detectedAt: string;
  sourceRevision: Revision;
};

export type ImpactQueueResponse = {
  items: ImpactRecord[];
};

export type TestRun = {
  run_id: string;
  status: "passed" | "failed" | "partial" | "aborted";
  revision: Revision;
  scenario_ids: string[];
  scope: "smoke" | "impacted" | "current" | "current+p0" | "full";
  artifacts: string[];
  executed_at: string | null;
};

export type RecentRunsResponse = {
  items: TestRun[];
};

export type ReleaseCheckResult = {
  decision: "pass" | "block" | "warn";
  mode: "snapshot" | "git-pending" | "git";
  impactedFeatures: string[];
  unmetRequirements: string[];
  notes: string[];
};

export type IterationRecord = {
  id: string;
  title: string;
  status: "active" | "paused" | "done" | "reopened" | "archived";
  updatedAt: string;
  acceptanceItems: Array<{
    status: "pending" | "in_progress" | "verified" | "failed" | "waived";
  }>;
  regressionItems: Array<{
    status: "pending" | "in_progress" | "verified" | "failed" | "waived";
  }>;
};

export type IterationOverview = {
  id: string;
  title: string;
  status: IterationRecord["status"];
  acceptancePending: number;
  regressionPending: number;
  updatedAt: string;
};

export type DashboardData = {
  status: StatusSummary;
  queue: ImpactRecord[];
  runs: TestRun[];
  release: ReleaseCheckResult;
  iterations: IterationOverview[];
};

export type RequestOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

type DashboardRequestOptions = RequestOptions & {
  dedupeKey?: string;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const inflightDashboardRequests = new Map<string, Promise<DashboardData>>();

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: RequestOptions
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options?.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  let response: Response;

  try {
    response = await fetch(input, {
      ...init,
      signal
    });
  } catch (error) {
    if (timeoutSignal.aborted && !options?.signal?.aborted) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function getStatus(options?: RequestOptions) {
  return requestJson<StatusSummary>("/api/status", undefined, options);
}

export function getImpactQueue(options?: RequestOptions) {
  return requestJson<ImpactQueueResponse>("/api/impact-queue", undefined, options);
}

export function getRecentRuns(options?: RequestOptions) {
  return requestJson<RecentRunsResponse>("/api/recent-runs", undefined, options);
}

export function runReleaseCheck(options?: RequestOptions) {
  return requestJson<ReleaseCheckResult>("/api/release-check", {
    method: "POST"
  }, options);
}

export function getIterations(options?: RequestOptions) {
  return requestJson<{ items: IterationRecord[] }>("/api/iterations", undefined, options);
}

function countPendingChecklistItems(
  items: Array<{ status: "pending" | "in_progress" | "verified" | "failed" | "waived" }>
) {
  return items.filter((item) => item.status !== "verified" && item.status !== "waived").length;
}

async function loadDashboardData(options?: RequestOptions): Promise<DashboardData> {
  const [status, queueResult, runsResult, release, iterationResult] = await Promise.all([
    getStatus(options),
    getImpactQueue(options),
    getRecentRuns(options),
    runReleaseCheck(options),
    getIterations(options)
  ]);

  return {
    status,
    queue: queueResult.items,
    runs: runsResult.items,
    release,
    iterations: iterationResult.items
      .filter((iteration) => iteration.status === "active" || iteration.status === "reopened")
      .map((iteration) => ({
        id: iteration.id,
        title: iteration.title,
        status: iteration.status,
        acceptancePending: countPendingChecklistItems(iteration.acceptanceItems),
        regressionPending: countPendingChecklistItems(iteration.regressionItems),
        updatedAt: iteration.updatedAt
      }))
  };
}

export function getDashboardData(options?: DashboardRequestOptions) {
  const dedupeKey = options?.dedupeKey;

  if (!dedupeKey) {
    return loadDashboardData(options);
  }

  const existingRequest = inflightDashboardRequests.get(dedupeKey);

  if (existingRequest) {
    return existingRequest;
  }

  const request = loadDashboardData(options).finally(() => {
    inflightDashboardRequests.delete(dedupeKey);
  });

  inflightDashboardRequests.set(dedupeKey, request);
  return request;
}
