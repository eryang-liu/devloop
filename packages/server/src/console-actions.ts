import {
  getStatusSummary,
  recordTestRun,
  runReleaseCheck,
  saveRegistry,
  syncProject
} from "@devloop/core";
import { buildServer } from "./app.js";
import {
  launchDashboardRuntime,
  type LaunchDashboardRuntimeResult
} from "./dashboard-runtime.js";
import type { ActionExecutionResult, ConsoleActionId } from "./console-types.js";

type ConsoleActionContext = {
  projectRoot: string | URL;
  dashboardUiDistPath?: string;
};

type RunScenarioPayload = {
  scenarioId: "local-api-smoke" | "browser-dashboard-smoke";
};

type StartUiPayload = {
  port?: number;
};

function createExecutionId() {
  return `exec_${Date.now().toString(36)}`;
}

function buildActionResult(
  actionId: ConsoleActionId,
  startedAt: string,
  status: ActionExecutionResult["status"],
  summary: string,
  logs: string[],
  data?: unknown,
  error?: { message: string }
): ActionExecutionResult {
  return {
    executionId: createExecutionId(),
    kind: "action",
    actionId,
    status,
    summary,
    logs,
    startedAt,
    finishedAt: new Date().toISOString(),
    data,
    error
  };
}

function assertSuccessfulResponse(
  response: { statusCode: number; body?: string },
  label: string,
  logs: string[]
) {
  logs.push(`${label} -> ${response.statusCode}`);

  if (response.statusCode !== 200) {
    throw new Error(`${label} returned ${response.statusCode}`);
  }
}

async function runLocalApiSmoke(projectRoot: string | URL, logs: string[]) {
  const app = await buildServer({ projectRoot });

  try {
    assertSuccessfulResponse(await app.inject({ method: "GET", url: "/api/health" }), "GET /api/health", logs);
    assertSuccessfulResponse(await app.inject({ method: "GET", url: "/api/status" }), "GET /api/status", logs);
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/iterations" }),
      "GET /api/iterations",
      logs
    );
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/impact-queue" }),
      "GET /api/impact-queue",
      logs
    );
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/recent-runs" }),
      "GET /api/recent-runs",
      logs
    );
    assertSuccessfulResponse(
      await app.inject({ method: "POST", url: "/api/release-check" }),
      "POST /api/release-check",
      logs
    );
  } finally {
    await app.close();
  }
}

async function runBrowserDashboardSmoke(
  projectRoot: string | URL,
  dashboardUiDistPath: string | undefined,
  logs: string[]
) {
  if (!dashboardUiDistPath) {
    throw new Error("Dashboard UI assets are unavailable.");
  }

  const app = await buildServer({
    projectRoot,
    uiDistPath: dashboardUiDistPath
  });

  try {
    const rootResponse = await app.inject({ method: "GET", url: "/" });
    assertSuccessfulResponse(rootResponse, "GET /", logs);

    if (!rootResponse.body.includes('id="root"') && !rootResponse.body.includes("id='root'")) {
      throw new Error("GET / did not return the bundled dashboard shell");
    }

    logs.push("Dashboard shell contains root element");

    assertSuccessfulResponse(await app.inject({ method: "GET", url: "/api/status" }), "GET /api/status", logs);
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/iterations" }),
      "GET /api/iterations",
      logs
    );
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/impact-queue" }),
      "GET /api/impact-queue",
      logs
    );
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/recent-runs" }),
      "GET /api/recent-runs",
      logs
    );
  } finally {
    await app.close();
  }
}

async function recordScenarioResult(
  projectRoot: string | URL,
  scenarioId: RunScenarioPayload["scenarioId"],
  status: "passed" | "failed"
) {
  return recordTestRun(projectRoot, {
    scope: "impacted",
    status,
    scenarioIds: [scenarioId],
    artifacts: []
  });
}

async function runScenarioAction(
  context: ConsoleActionContext,
  payload: RunScenarioPayload
): Promise<ActionExecutionResult> {
  const startedAt = new Date().toISOString();
  const logs: string[] = [`Starting ${payload.scenarioId}`];

  try {
    if (payload.scenarioId === "local-api-smoke") {
      await runLocalApiSmoke(context.projectRoot, logs);
    } else {
      await runBrowserDashboardSmoke(context.projectRoot, context.dashboardUiDistPath, logs);
    }

    const result = await recordScenarioResult(context.projectRoot, payload.scenarioId, "passed");
    logs.push(`Recorded passed run ${result.run.run_id}`);

    return buildActionResult(
      payload.scenarioId,
      startedAt,
      "passed",
      `${payload.scenarioId} completed successfully`,
      logs,
      result
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scenario execution failed";
    logs.push(message);
    await recordScenarioResult(context.projectRoot, payload.scenarioId, "failed");

    return buildActionResult(
      payload.scenarioId,
      startedAt,
      "failed",
      `${payload.scenarioId} failed`,
      logs,
      undefined,
      { message }
    );
  }
}

async function startUiAction(
  context: ConsoleActionContext,
  payload: StartUiPayload | undefined
): Promise<ActionExecutionResult> {
  const startedAt = new Date().toISOString();
  const logs: string[] = ["Starting shared DevLoop UI runtime"];

  try {
    const result: LaunchDashboardRuntimeResult = await launchDashboardRuntime({
      projectRoot: context.projectRoot,
      uiDistPath: context.dashboardUiDistPath ?? "",
      host: "127.0.0.1",
      port: payload?.port ?? 4300
    });

    logs.push(result.reusedExisting ? `Reused ${result.url}` : `Started ${result.url}`);

    return buildActionResult(
      "start-ui",
      startedAt,
      "passed",
      "DevLoop UI is available",
      logs,
      result
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start DevLoop UI";
    logs.push(message);
    return buildActionResult(
      "start-ui",
      startedAt,
      "failed",
      "DevLoop UI could not be started",
      logs,
      undefined,
      { message }
    );
  }
}

export async function runConsoleAction(
  actionId: ConsoleActionId,
  context: ConsoleActionContext,
  payload?: unknown
): Promise<ActionExecutionResult> {
  if (actionId === "local-api-smoke" || actionId === "browser-dashboard-smoke") {
    return runScenarioAction(context, { scenarioId: actionId });
  }

  if (actionId === "start-ui") {
    return startUiAction(context, payload as StartUiPayload | undefined);
  }

  const startedAt = new Date().toISOString();
  const logs: string[] = [`Starting ${actionId}`];

  try {
    if (actionId === "sync") {
      const registry = await syncProject(context.projectRoot, {
        now: new Date().toISOString()
      });
      await saveRegistry(context.projectRoot, registry);
      logs.push("Registry synced successfully");
      return buildActionResult(actionId, startedAt, "passed", "Registry synced successfully", logs, registry);
    }

    if (actionId === "status") {
      const status = await getStatusSummary(context.projectRoot);
      logs.push("Loaded status summary");
      return buildActionResult(actionId, startedAt, "passed", "Loaded status summary", logs, status);
    }

    if (actionId !== "release-check") {
      throw new Error(`Unknown action id: ${actionId}`);
    }

    const releaseCheck = await runReleaseCheck(context.projectRoot);
    logs.push(`Release check decision: ${releaseCheck.decision}`);

    return buildActionResult(
      actionId,
      startedAt,
      releaseCheck.decision === "block" ? "failed" : "passed",
      `Release check ${releaseCheck.decision}`,
      logs,
      releaseCheck,
      releaseCheck.decision !== "block"
        ? undefined
        : { message: releaseCheck.notes[0] ?? "Release check failed" }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    logs.push(message);
    return buildActionResult(actionId, startedAt, "failed", `${actionId} failed`, logs, undefined, {
      message
    });
  }
}
