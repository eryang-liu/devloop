import { recordTestRun } from "@devloop/core";
import { buildConsoleApp, buildServer } from "@devloop/server";
import { Command } from "commander";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bundledUiDistPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist/ui");
const bundledConsoleDistPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../dist/console");

type SupportedScenarioId =
  | "local-api-smoke"
  | "browser-dashboard-smoke"
  | "default-console-smoke";

const SCENARIO_SCOPE: Record<SupportedScenarioId, "impacted"> = {
  "local-api-smoke": "impacted",
  "browser-dashboard-smoke": "impacted",
  "default-console-smoke": "impacted"
};

function assertSuccessfulResponse(
  response: { statusCode: number; body?: string },
  label: string
) {
  if (response.statusCode !== 200) {
    throw new Error(`${label} returned ${response.statusCode}`);
  }
}

async function runLocalApiSmoke(projectRoot: string) {
  const app = await buildServer({ projectRoot });

  try {
    assertSuccessfulResponse(await app.inject({ method: "GET", url: "/api/health" }), "GET /api/health");
    assertSuccessfulResponse(await app.inject({ method: "GET", url: "/api/status" }), "GET /api/status");
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/iterations" }),
      "GET /api/iterations"
    );
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/impact-queue" }),
      "GET /api/impact-queue"
    );
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/recent-runs" }),
      "GET /api/recent-runs"
    );
    assertSuccessfulResponse(
      await app.inject({ method: "POST", url: "/api/release-check" }),
      "POST /api/release-check"
    );
  } finally {
    await app.close();
  }
}

async function runBrowserDashboardSmoke(projectRoot: string) {
  const app = await buildServer({
    projectRoot,
    uiDistPath: bundledUiDistPath
  });

  try {
    const rootResponse = await app.inject({ method: "GET", url: "/" });
    assertSuccessfulResponse(rootResponse, "GET /");

    if (!rootResponse.body.includes('id="root"') && !rootResponse.body.includes("id='root'")) {
      throw new Error("GET / did not return the bundled dashboard shell");
    }

    assertSuccessfulResponse(await app.inject({ method: "GET", url: "/api/status" }), "GET /api/status");
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/iterations" }),
      "GET /api/iterations"
    );
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/impact-queue" }),
      "GET /api/impact-queue"
    );
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/recent-runs" }),
      "GET /api/recent-runs"
    );
  } finally {
    await app.close();
  }
}

async function runDefaultConsoleSmoke(projectRoot: string) {
  const app = await buildConsoleApp({
    projectRoot,
    dashboardUiDistPath: bundledUiDistPath,
    consoleUiDistPath: bundledConsoleDistPath
  });

  try {
    const rootResponse = await app.inject({ method: "GET", url: "/" });
    assertSuccessfulResponse(rootResponse, "GET /");

    if (!rootResponse.body.includes('id="root"') && !rootResponse.body.includes("id='root'")) {
      throw new Error("GET / did not return the bundled console shell");
    }

    assertSuccessfulResponse(await app.inject({ method: "GET", url: "/api/health" }), "GET /api/health");
    assertSuccessfulResponse(
      await app.inject({ method: "GET", url: "/api/iterations" }),
      "GET /api/iterations"
    );
    assertSuccessfulResponse(
      await app.inject({ method: "POST", url: "/api/actions/status" }),
      "POST /api/actions/status"
    );
    assertSuccessfulResponse(
      await app.inject({ method: "POST", url: "/api/actions/release-check" }),
      "POST /api/actions/release-check"
    );
  } finally {
    await app.close();
  }
}

async function executeScenario(projectRoot: string, scenarioId: SupportedScenarioId) {
  if (scenarioId === "local-api-smoke") {
    await runLocalApiSmoke(projectRoot);
    return;
  }

  if (scenarioId === "default-console-smoke") {
    await runDefaultConsoleSmoke(projectRoot);
    return;
  }

  await runBrowserDashboardSmoke(projectRoot);
}

export function runScenarioCommand(): Command {
  return new Command("run-scenario")
    .description("Execute a built-in DevLoop smoke scenario and persist its result automatically.")
    .argument(
      "<scenario-id>",
      "Supported ids: local-api-smoke, browser-dashboard-smoke, default-console-smoke"
    )
    .action(async (scenarioId: string) => {
      const projectRoot = process.cwd();

      if (!(scenarioId in SCENARIO_SCOPE)) {
        throw new Error(`Unsupported scenario id: ${scenarioId}`);
      }

      const typedScenarioId = scenarioId as SupportedScenarioId;

      try {
        await executeScenario(projectRoot, typedScenarioId);
      } catch (error) {
        await recordTestRun(projectRoot, {
          scope: SCENARIO_SCOPE[typedScenarioId],
          status: "failed",
          scenarioIds: [typedScenarioId],
          artifacts: []
        });
        throw error;
      }

      const result = await recordTestRun(projectRoot, {
        scope: SCENARIO_SCOPE[typedScenarioId],
        status: "passed",
        scenarioIds: [typedScenarioId],
        artifacts: []
      });

      console.log(JSON.stringify(result, null, 2));
    });
}
