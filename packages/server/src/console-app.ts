import { captureRequirement, listIterations } from "@devloop/core";
import fastifyStatic from "@fastify/static";
import fastify from "fastify";
import { runConsoleAction } from "./console-actions.js";
import { runConsoleWorkflow } from "./console-workflows.js";

export type BuildConsoleAppOptions = {
  projectRoot: string | URL;
  dashboardUiDistPath?: string;
  consoleUiDistPath?: string;
};

export async function buildConsoleApp(options: BuildConsoleAppOptions) {
  const app = fastify();

  const scenarioIds = new Set(["local-api-smoke", "browser-dashboard-smoke"]);
  const workflowIds = new Set(["development-check", "pre-release-check"]);

  app.get("/api/health", async () => ({ ok: true }));
  app.get("/api/iterations", async () => ({
    items: await listIterations(options.projectRoot)
  }));
  app.post("/api/iterations/capture", async (request) => {
    const payload = request.body as {
      source: "manual" | "codex" | "cursor" | "claude-code";
      rawRequest: string;
      timestamp?: string;
      title?: string;
      suggestedIterationId?: string;
      intentType?:
        | "new_iteration"
        | "iteration_extension"
        | "regression_fix"
        | "reopen_iteration"
        | "uncertain";
      confidence?: number;
    };

    return captureRequirement(options.projectRoot, {
      source: payload.source,
      rawRequest: payload.rawRequest,
      timestamp: payload.timestamp ?? new Date().toISOString(),
      title: payload.title,
      suggestedIterationId: payload.suggestedIterationId,
      intentType: payload.intentType,
      confidence: payload.confidence
    });
  });

  app.post("/api/actions/sync", async () => runConsoleAction("sync", options));
  app.post("/api/actions/status", async () => runConsoleAction("status", options));
  app.post("/api/actions/release-check", async () => runConsoleAction("release-check", options));
  app.post("/api/actions/start-ui", async (request) =>
    runConsoleAction("start-ui", options, request.body)
  );
  app.post("/api/actions/run-scenario", async (request, reply) => {
    const payload = request.body as { scenarioId: "local-api-smoke" | "browser-dashboard-smoke" };

    if (!payload || !scenarioIds.has(payload.scenarioId)) {
      reply.code(400);
      return { message: "Unsupported scenario id." };
    }

    return runConsoleAction(payload.scenarioId, options);
  });
  app.post("/api/workflows/run", async (request, reply) => {
    const payload = request.body as { workflowId: "development-check" | "pre-release-check" };

    if (!payload || !workflowIds.has(payload.workflowId)) {
      reply.code(400);
      return { message: "Unsupported workflow id." };
    }

    return runConsoleWorkflow(payload.workflowId, options);
  });

  if (options.consoleUiDistPath) {
    await app.register(fastifyStatic, {
      root: options.consoleUiDistPath,
      prefix: "/"
    });

    app.get("/", async (_request, reply) => reply.sendFile("index.html"));
  }

  return app;
}
