import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as core from "@devloop/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@devloop/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@devloop/core")>();

  return {
    ...actual,
    captureRequirement: vi.fn(actual.captureRequirement),
    getStatusSummary: vi.fn(actual.getStatusSummary),
    listIterations: vi.fn(actual.listIterations),
    loadIteration: vi.fn(actual.loadIteration),
    loadRegistry: vi.fn(actual.loadRegistry),
    loadRecentTestRuns: vi.fn(actual.loadRecentTestRuns),
    runReleaseCheck: vi.fn(actual.runReleaseCheck),
    saveRegistry: vi.fn(actual.saveRegistry),
    syncProject: vi.fn(actual.syncProject)
  };
});

import { buildServer } from "../app.js";

const fixtureProjectRoot = new URL("../../../core/src/__tests__/fixtures/project", import.meta.url);

async function withServer(run: (app: Awaited<ReturnType<typeof buildServer>>) => Promise<void>) {
  const app = await buildServer({ projectRoot: fixtureProjectRoot });

  try {
    await run(app);
  } finally {
    await app.close();
  }
}

beforeEach(async () => {
  const actual = await vi.importActual<typeof import("@devloop/core")>("@devloop/core");

  vi.clearAllMocks();
  vi.mocked(core.captureRequirement).mockImplementation(actual.captureRequirement);
  vi.mocked(core.getStatusSummary).mockImplementation(actual.getStatusSummary);
  vi.mocked(core.listIterations).mockImplementation(actual.listIterations);
  vi.mocked(core.loadIteration).mockImplementation(actual.loadIteration);
  vi.mocked(core.loadRegistry).mockImplementation(actual.loadRegistry);
  vi.mocked(core.loadRecentTestRuns).mockImplementation(actual.loadRecentTestRuns);
  vi.mocked(core.runReleaseCheck).mockImplementation(actual.runReleaseCheck);
  vi.mocked(core.saveRegistry).mockResolvedValue(undefined);
  vi.mocked(core.syncProject).mockImplementation(actual.syncProject);
});

describe("buildServer", () => {
  it("returns a health payload", async () => {
    await withServer(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/health" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    });
  });

  it("returns the fixture status summary", async () => {
    vi.mocked(core.getStatusSummary).mockResolvedValue({
      counts: {
        never_tested: 0,
        changed_untested: 1,
        rework_untested: 0,
        tested: 1,
        failed: 0,
        "needs-triage": 0
      },
      highRiskFeatures: [{ featureId: "host-listen", status: "changed_untested" }],
      lastSyncAt: "2026-06-10T09:00:00.000Z",
      vcs: {
        mode: "snapshot",
        gitRoot: null,
        headSha: null,
        projectId: null,
        upgradedFromSnapshotAt: null
      }
    });

    await withServer(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/status" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        counts: {
          never_tested: 0,
          changed_untested: 1,
          rework_untested: 0,
          tested: 1,
          failed: 0,
          "needs-triage": 0
        },
        highRiskFeatures: [{ featureId: "host-listen", status: "changed_untested" }],
        lastSyncAt: "2026-06-10T09:00:00.000Z",
        vcs: {
          mode: "snapshot",
          gitRoot: null,
          headSha: null,
          projectId: null,
          upgradedFromSnapshotAt: null
        }
      });
    });
  });

  it("returns the fixture impact queue", async () => {
    await withServer(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/impact-queue" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ items: [] });
    });
  });

  it("returns recent test runs for the dashboard", async () => {
    vi.mocked(core.loadRecentTestRuns).mockResolvedValue([
      {
        run_id: "run_latest",
        status: "passed",
        revision: {
          kind: "snapshot",
          snapshotId: "snap_000001"
        },
        scenario_ids: ["local-api-smoke"],
        scope: "impacted",
        artifacts: [],
        executed_at: "2026-06-10T10:30:00.000Z"
      }
    ]);

    await withServer(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/recent-runs" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          {
            run_id: "run_latest",
            status: "passed",
            revision: {
              kind: "snapshot",
              snapshotId: "snap_000001"
            },
            scenario_ids: ["local-api-smoke"],
            scope: "impacted",
            artifacts: [],
            executed_at: "2026-06-10T10:30:00.000Z"
          }
        ]
      });
      expect(core.loadRecentTestRuns).toHaveBeenCalledWith(fixtureProjectRoot, 5);
    });
  });

  it("lists iterations for iteration-first clients", async () => {
    vi.mocked(core.listIterations).mockResolvedValue([
      {
        id: "iter_001",
        slug: "wizard-refactor",
        title: "Wizard refactor",
        status: "active",
        source: "manual",
        createdAt: "2026-06-11T08:00:00.000Z",
        updatedAt: "2026-06-11T09:00:00.000Z",
        closedAt: null,
        reopenedFrom: null,
        rawUserIntent: "Refactor the onboarding wizard",
        goal: "Refactor the onboarding wizard",
        nonGoals: [],
        acceptanceItems: [],
        regressionItems: [],
        affectedFeatures: [],
        affectedPaths: [],
        changeEvents: [],
        testRunIds: [],
        evidenceLinks: [],
        releaseStatus: "unknown",
        conversationRefs: []
      }
    ]);

    await withServer(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/iterations" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        items: [
          {
            id: "iter_001",
            slug: "wizard-refactor",
            title: "Wizard refactor",
            status: "active",
            source: "manual",
            createdAt: "2026-06-11T08:00:00.000Z",
            updatedAt: "2026-06-11T09:00:00.000Z",
            closedAt: null,
            reopenedFrom: null,
            rawUserIntent: "Refactor the onboarding wizard",
            goal: "Refactor the onboarding wizard",
            nonGoals: [],
            acceptanceItems: [],
            regressionItems: [],
            affectedFeatures: [],
            affectedPaths: [],
            changeEvents: [],
            testRunIds: [],
            evidenceLinks: [],
            releaseStatus: "unknown",
            conversationRefs: []
          }
        ]
      });
      expect(core.listIterations).toHaveBeenCalledWith(fixtureProjectRoot);
    });
  });

  it("loads a single iteration by id", async () => {
    vi.mocked(core.loadIteration).mockResolvedValue({
      id: "iter_001",
      slug: "wizard-refactor",
      title: "Wizard refactor",
      status: "reopened",
      source: "manual",
      createdAt: "2026-06-11T08:00:00.000Z",
      updatedAt: "2026-06-11T09:30:00.000Z",
      closedAt: null,
      reopenedFrom: null,
      rawUserIntent: "Refactor the onboarding wizard",
      goal: "Refactor the onboarding wizard",
      nonGoals: [],
      acceptanceItems: [],
      regressionItems: [],
      affectedFeatures: [],
      affectedPaths: [],
      changeEvents: [],
      testRunIds: [],
      evidenceLinks: [],
      releaseStatus: "unknown",
      conversationRefs: []
    });

    await withServer(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/iterations/iter_001" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        id: "iter_001",
        title: "Wizard refactor",
        status: "reopened"
      });
      expect(core.loadIteration).toHaveBeenCalledWith(fixtureProjectRoot, "iter_001");
    });
  });

  it("captures a requirement into a PRD-backed iteration", async () => {
    vi.mocked(core.captureRequirement).mockResolvedValue({
      iteration: {
        id: "iter_002",
        slug: "add-prd-capture",
        title: "Add PRD capture",
        status: "active",
        source: "manual",
        createdAt: "2026-06-11T10:30:00.000Z",
        updatedAt: "2026-06-11T10:30:00.000Z",
        closedAt: null,
        reopenedFrom: null,
        rawUserIntent: "Add requirement capture",
        goal: "Add requirement capture",
        nonGoals: [],
        acceptanceItems: [],
        regressionItems: [],
        affectedFeatures: [],
        affectedPaths: [],
        changeEvents: [],
        testRunIds: [],
        evidenceLinks: [],
        releaseStatus: "unknown",
        conversationRefs: []
      },
      prdPath: "/tmp/project/docs/prd/2026-06-11/add-prd-capture.md"
    });

    await withServer(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/iterations/capture",
        payload: {
          source: "manual",
          rawRequest: "Add requirement capture",
          title: "Add PRD capture",
          timestamp: "2026-06-11T10:30:00.000Z"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        iteration: {
          id: "iter_002",
          title: "Add PRD capture",
          status: "active"
        },
        prdPath: "/tmp/project/docs/prd/2026-06-11/add-prd-capture.md"
      });
      expect(core.captureRequirement).toHaveBeenCalledWith(fixtureProjectRoot, {
        source: "manual",
        rawRequest: "Add requirement capture",
        title: "Add PRD capture",
        timestamp: "2026-06-11T10:30:00.000Z"
      });
    });
  });

  it("calls sync helpers and returns the sync result", async () => {
    const syncResult = {
      version: 1,
      projectId: "proj_testsync",
      lastSyncAt: "2026-06-10T10:00:00.000Z",
      impactQueue: [],
      features: [],
      vcs: {
        mode: "snapshot" as const,
        detectedAt: "2026-06-10T10:00:00.000Z",
        gitRoot: null,
        headSha: null,
        lastRevision: {
          kind: "snapshot" as const,
          snapshotId: "snap_000001"
        },
        historyBridge: null,
        snapshotState: {
          sequence: 1,
          files: {}
        }
      }
    };

    vi.mocked(core.syncProject).mockResolvedValue(syncResult);

    await withServer(async (app) => {
      const response = await app.inject({ method: "POST", url: "/api/sync" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(syncResult);
      expect(core.syncProject).toHaveBeenCalledTimes(1);
      expect(core.saveRegistry).toHaveBeenCalledWith(fixtureProjectRoot, syncResult);

      const [projectRoot, input] = vi.mocked(core.syncProject).mock.calls[0];

      expect(projectRoot).toBe(fixtureProjectRoot);
      expect(new Date(input.now).toISOString()).toBe(input.now);
    });
  });

  it("runs release checks without requiring a separate HEAD lookup and returns the result", async () => {
    const releaseCheckResult = {
      decision: "warn" as const,
      mode: "snapshot" as const,
      impactedFeatures: ["host-listen"],
      unmetRequirements: ["missing_git_revision_evidence"],
      notes: ["Running in snapshot mode without commit-backed release evidence"]
    };

    vi.mocked(core.runReleaseCheck).mockResolvedValue(releaseCheckResult);

    await withServer(async (app) => {
      const response = await app.inject({ method: "POST", url: "/api/release-check" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(releaseCheckResult);
      expect(core.runReleaseCheck).toHaveBeenCalledWith(fixtureProjectRoot);
    });
  });

  it("serves index.html at the root path when a ui dist path is provided", async () => {
    const uiDistPath = await mkdtemp(join(tmpdir(), "devloop-ui-dist-"));
    await writeFile(
      join(uiDistPath, "index.html"),
      "<!doctype html><html><body><div id='root'>DevLoop UI</div></body></html>"
    );

    const app = await buildServer({ projectRoot: fixtureProjectRoot, uiDistPath });

    try {
      const response = await app.inject({ method: "GET", url: "/" });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/html");
      expect(response.body).toContain("DevLoop UI");
    } finally {
      await app.close();
    }
  });
});
