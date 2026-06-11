import * as core from "@devloop/core";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@devloop/core", () => ({
  captureRequirement: vi.fn(),
  getStatusSummary: vi.fn(),
  listIterations: vi.fn(),
  recordTestRun: vi.fn(),
  runReleaseCheck: vi.fn(),
  saveRegistry: vi.fn(),
  syncProject: vi.fn()
}));

vi.mock("../app.js", () => ({
  buildServer: vi.fn()
}));

vi.mock("../dashboard-runtime.js", () => ({
  launchDashboardRuntime: vi.fn()
}));

import { buildServer } from "../app.js";
import { launchDashboardRuntime } from "../dashboard-runtime.js";
import { buildConsoleApp } from "../console-app.js";

const fixtureProjectRoot = new URL("../../../core/src/__tests__/fixtures/project", import.meta.url);

async function withConsoleApp(
  run: (app: Awaited<ReturnType<typeof buildConsoleApp>>) => Promise<void>
) {
  const app = await buildConsoleApp({ projectRoot: fixtureProjectRoot });

  try {
    await run(app);
  } finally {
    await app.close();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildConsoleApp", () => {
  it("exposes a lightweight console health route", async () => {
    await withConsoleApp(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/health" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ ok: true });
    });
  });

  it("executes sync actions through the backend action layer", async () => {
    const syncResult = {
      version: 1,
      projectId: "proj_console_sync",
      lastSyncAt: "2026-06-11T10:00:00.000Z",
      impactQueue: [],
      features: [],
      vcs: {
        mode: "snapshot" as const,
        detectedAt: "2026-06-11T10:00:00.000Z",
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
    vi.mocked(core.saveRegistry).mockResolvedValue(undefined);

    await withConsoleApp(async (app) => {
      const response = await app.inject({ method: "POST", url: "/api/actions/sync" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        kind: "action",
        actionId: "sync",
        status: "passed",
        data: syncResult
      });
      expect(response.json().logs).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(core.syncProject).toHaveBeenCalledWith(
        fixtureProjectRoot,
        expect.objectContaining({
          now: expect.any(String)
        })
      );
      expect(core.saveRegistry).toHaveBeenCalledWith(fixtureProjectRoot, syncResult);
    });
  });

  it("lists iterations for the console workspace", async () => {
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
        rawUserIntent: "Refactor the wizard",
        goal: "Refactor the wizard",
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
    ] as never);

    await withConsoleApp(async (app) => {
      const response = await app.inject({ method: "GET", url: "/api/iterations" });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        items: [
          {
            id: "iter_001",
            title: "Wizard refactor",
            status: "active"
          }
        ]
      });
      expect(core.listIterations).toHaveBeenCalledWith(fixtureProjectRoot);
    });
  });

  it("captures requirements from the console workspace", async () => {
    vi.mocked(core.captureRequirement).mockResolvedValue({
      iteration: {
        id: "iter_002",
        slug: "locale-polish",
        title: "Locale polish",
        status: "active",
        source: "manual",
        createdAt: "2026-06-11T10:00:00.000Z",
        updatedAt: "2026-06-11T10:00:00.000Z",
        closedAt: null,
        reopenedFrom: null,
        rawUserIntent: "Polish locale handling",
        goal: "Polish locale handling",
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
      prdPath: "/tmp/project/docs/prd/2026-06-11/locale-polish.md"
    } as never);

    await withConsoleApp(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/iterations/capture",
        payload: {
          source: "manual",
          rawRequest: "Polish locale handling"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        iteration: {
          id: "iter_002",
          title: "Locale polish",
          status: "active"
        },
        prdPath: "/tmp/project/docs/prd/2026-06-11/locale-polish.md"
      });
      expect(core.captureRequirement).toHaveBeenCalledWith(
        fixtureProjectRoot,
        expect.objectContaining({
          source: "manual",
          rawRequest: "Polish locale handling",
          timestamp: expect.any(String)
        })
      );
    });
  });

  it("executes run-scenario actions without shelling out", async () => {
    const inject = vi
      .fn()
      .mockResolvedValueOnce({ statusCode: 200, body: "{\"ok\":true}" })
      .mockResolvedValueOnce({ statusCode: 200, body: "{\"counts\":{}}" })
      .mockResolvedValueOnce({ statusCode: 200, body: "{\"items\":[]}" })
      .mockResolvedValueOnce({ statusCode: 200, body: "{\"items\":[]}" })
      .mockResolvedValueOnce({ statusCode: 200, body: "{\"items\":[]}" })
      .mockResolvedValueOnce({ statusCode: 200, body: "{\"decision\":\"warn\"}" });
    const close = vi.fn().mockResolvedValue(undefined);

    vi.mocked(buildServer).mockResolvedValue({ inject, close } as never);
    vi.mocked(core.recordTestRun).mockResolvedValue({
      run: {
        run_id: "run_local_api_smoke",
        status: "passed",
        revision: {
          kind: "snapshot",
          snapshotId: "snap_000001"
        },
        scenario_ids: ["local-api-smoke"],
        scope: "impacted",
        artifacts: [],
        executed_at: "2026-06-11T10:15:00.000Z"
      },
      registry: {} as never
    });

    await withConsoleApp(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/actions/run-scenario",
        payload: {
          scenarioId: "local-api-smoke"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        kind: "action",
        actionId: "local-api-smoke",
        status: "passed"
      });
      expect(vi.mocked(buildServer)).toHaveBeenCalledWith({ projectRoot: fixtureProjectRoot });
      expect(core.recordTestRun).toHaveBeenCalledWith(fixtureProjectRoot, {
        scope: "impacted",
        status: "passed",
        scenarioIds: ["local-api-smoke"],
        artifacts: []
      });
      expect(inject).toHaveBeenNthCalledWith(1, { method: "GET", url: "/api/health" });
      expect(inject).toHaveBeenNthCalledWith(2, { method: "GET", url: "/api/status" });
      expect(inject).toHaveBeenNthCalledWith(3, { method: "GET", url: "/api/iterations" });
      expect(inject).toHaveBeenNthCalledWith(6, { method: "POST", url: "/api/release-check" });
      expect(close).toHaveBeenCalledTimes(1);
    });
  });

  it("runs workflows sequentially, stops on failure, and marks remaining steps as skipped", async () => {
    vi.mocked(core.syncProject).mockResolvedValue({
      version: 1,
      projectId: "proj_console_workflow",
      lastSyncAt: "2026-06-11T10:00:00.000Z",
      impactQueue: [],
      features: [],
      vcs: {
        mode: "snapshot" as const,
        detectedAt: "2026-06-11T10:00:00.000Z",
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
    });
    vi.mocked(core.saveRegistry).mockResolvedValue(undefined);
    vi.mocked(buildServer).mockResolvedValue({
      inject: vi
        .fn()
        .mockResolvedValueOnce({ statusCode: 200, body: "{\"ok\":true}" })
        .mockResolvedValueOnce({ statusCode: 200, body: "{\"counts\":{}}" })
        .mockResolvedValueOnce({ statusCode: 500, body: "boom" }),
      close: vi.fn().mockResolvedValue(undefined)
    } as never);
    vi.mocked(core.recordTestRun).mockResolvedValue({
      run: {
        run_id: "run_local_api_smoke_failed",
        status: "failed",
        revision: {
          kind: "snapshot",
          snapshotId: "snap_000001"
        },
        scenario_ids: ["local-api-smoke"],
        scope: "impacted",
        artifacts: [],
        executed_at: "2026-06-11T10:20:00.000Z"
      },
      registry: {} as never
    });

    await withConsoleApp(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/workflows/run",
        payload: {
          workflowId: "pre-release-check"
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        kind: "workflow",
        workflowId: "pre-release-check",
        status: "failed",
        steps: [
          {
            stepId: "sync",
            actionId: "sync",
            status: "passed"
          },
          {
            stepId: "local-api-smoke",
            actionId: "local-api-smoke",
            status: "failed",
            error: {
              message: "GET /api/iterations returned 500"
            }
          },
          {
            stepId: "browser-dashboard-smoke",
            actionId: "browser-dashboard-smoke",
            status: "skipped"
          },
          {
            stepId: "release-check",
            actionId: "release-check",
            status: "skipped"
          }
        ]
      });
      expect(response.json().steps[2].logs).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(core.runReleaseCheck).not.toHaveBeenCalled();
    });
  });

  it("keeps release-check warnings as non-failing action results", async () => {
    vi.mocked(core.runReleaseCheck).mockResolvedValue({
      decision: "warn",
      mode: "snapshot",
      impactedFeatures: [],
      unmetRequirements: [],
      notes: ["Warning only"]
    });

    await withConsoleApp(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/actions/release-check"
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        kind: "action",
        actionId: "release-check",
        status: "passed",
        data: {
          decision: "warn"
        }
      });
    });
  });

  it("launches the shared dashboard runtime from the start-ui action", async () => {
    vi.mocked(launchDashboardRuntime).mockResolvedValue({
      url: "http://127.0.0.1:4300",
      reusedExisting: false
    } as never);

    await withConsoleApp(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/actions/start-ui",
        payload: {
          port: 4300
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        kind: "action",
        actionId: "start-ui",
        status: "passed",
        data: {
          url: "http://127.0.0.1:4300",
          reusedExisting: false
        }
      });
      expect(launchDashboardRuntime).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "127.0.0.1",
          port: 4300,
          projectRoot: fixtureProjectRoot
        })
      );
    });
  });

  it("returns a failed action result when start-ui cannot launch the dashboard runtime", async () => {
    vi.mocked(launchDashboardRuntime).mockRejectedValue(new Error("Dashboard UI assets are unavailable."));

    await withConsoleApp(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/actions/start-ui",
        payload: {
          port: 4300
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        kind: "action",
        actionId: "start-ui",
        status: "failed",
        error: {
          message: "Dashboard UI assets are unavailable."
        }
      });
      expect(response.json().logs).toEqual(expect.arrayContaining([expect.any(String)]));
    });
  });

  it("rejects unsupported scenario ids before dispatching actions", async () => {
    await withConsoleApp(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/actions/run-scenario",
        payload: {
          scenarioId: "unknown-scenario"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        message: "Unsupported scenario id."
      });
    });
  });

  it("rejects unsupported workflow ids before running workflow orchestration", async () => {
    await withConsoleApp(async (app) => {
      const response = await app.inject({
        method: "POST",
        url: "/api/workflows/run",
        payload: {
          workflowId: "unknown-workflow"
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        message: "Unsupported workflow id."
      });
    });
  });

  it("serves the bundled console shell when console ui assets are provided", async () => {
    const consoleUiDistPath = await mkdtemp(join(tmpdir(), "devloop-console-ui-"));

    await writeFile(join(consoleUiDistPath, "index.html"), "<!doctype html><div id=\"root\">console</div>");

    const app = await buildConsoleApp({
      projectRoot: fixtureProjectRoot,
      consoleUiDistPath
    });

    try {
      const response = await app.inject({
        method: "GET",
        url: "/"
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain("id=\"root\"");
      expect(response.body).toContain("console");
    } finally {
      await app.close();
    }
  });
});
