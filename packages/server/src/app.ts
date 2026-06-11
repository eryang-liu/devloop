import {
  captureRequirement,
  getStatusSummary,
  listIterations,
  loadIteration,
  loadRegistry,
  loadRecentTestRuns,
  runReleaseCheck,
  saveRegistry,
  syncProject
} from "@devloop/core";
import fastifyStatic from "@fastify/static";
import fastify from "fastify";

export type BuildServerOptions = {
  projectRoot: string | URL;
  uiDistPath?: string;
};

export async function buildServer(options: BuildServerOptions) {
  const app = fastify();

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/status", async () => getStatusSummary(options.projectRoot));

  app.get("/api/impact-queue", async () => {
    const registry = await loadRegistry(options.projectRoot);
    return { items: registry.impactQueue };
  });

  app.get("/api/recent-runs", async () => ({
    items: await loadRecentTestRuns(options.projectRoot, 5)
  }));

  app.get("/api/iterations", async () => ({
    items: await listIterations(options.projectRoot)
  }));

  app.get("/api/iterations/:iterationId", async (request) => {
    const params = request.params as { iterationId: string };
    return loadIteration(options.projectRoot, params.iterationId);
  });

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

  app.post("/api/sync", async () => {
    const registry = await syncProject(options.projectRoot, {
      now: new Date().toISOString()
    });

    await saveRegistry(options.projectRoot, registry);

    return registry;
  });

  app.post("/api/release-check", async () => runReleaseCheck(options.projectRoot));

  if (options.uiDistPath) {
    await app.register(fastifyStatic, {
      root: options.uiDistPath,
      prefix: "/"
    });

    app.get("/", async (_request, reply) => reply.sendFile("index.html"));
  }

  return app;
}
