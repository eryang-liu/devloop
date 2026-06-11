import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
const expectedUiDistPath = fileURLToPath(new URL("../../dist/ui", import.meta.url));
const expectedConsoleDistPath = fileURLToPath(new URL("../../dist/console", import.meta.url));

async function importCli() {
  return import("../main.js");
}

afterEach(() => {
  process.chdir(originalCwd);
  process.exitCode = undefined;
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unmock("@devloop/core");
  vi.unmock("@devloop/server");
  vi.unmock("../commands/console.js");
});

describe("buildProgram", () => {
  it("registers the M1 commands", async () => {
    const { buildProgram } = await importCli();
    const program = buildProgram();

    expect(program.commands.map((command) => command.name())).toEqual([
      "capture",
      "doctor",
      "iteration",
      "status",
      "sync",
      "release-check",
      "record-run",
      "run-scenario",
      "ui"
    ]);
  });
});

describe("runCli", () => {
  it("launches the console for a bare devloop invocation", async () => {
    const launchConsole = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../commands/console.js", () => ({
      launchConsole
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli(["node", "devloop"]);

    expect(exitCode).toBe(0);
    expect(process.exitCode).toBe(0);
    expect(launchConsole).toHaveBeenCalledWith({ projectRoot: originalCwd });
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["--help"],
    ["-h"],
    ["help"]
  ])("preserves Commander help for devloop %s", async (helpArg) => {
    const launchConsole = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../commands/console.js", () => ({
      launchConsole
    }));

    const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli(["node", "devloop", helpArg]);

    expect(exitCode).toBe(0);
    expect(process.exitCode).toBe(0);
    expect(launchConsole).not.toHaveBeenCalled();
    expect(stdoutSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("returns a stable non-zero error for unknown commands", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli(["node", "devloop", "nope"]);

    expect(exitCode).toBe(1);
    expect(process.exitCode).toBe(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("devloop: Unknown command 'nope'.");
  });

  it("returns a stable non-zero error for doctor outside a devloop project", async () => {
    process.chdir(await mkdtemp(join(tmpdir(), "devloop-cli-doctor-")));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli(["node", "devloop", "doctor"]);

    expect(exitCode).toBe(1);
    expect(process.exitCode).toBe(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "devloop: Missing .devloop/config.yml in the current directory."
    );
  });

  it("returns a non-zero exit code for blocked release checks without printing an error", async () => {
    const releaseResult = {
      decision: "block" as const,
      mode: "git" as const,
      impactedFeatures: ["host-listen"],
      unmetRequirements: ["p0_not_verified:host-listen"],
      notes: []
    };

    vi.doMock("@devloop/core", () => ({
      getStatusSummary: vi.fn(),
      runReleaseCheck: vi.fn().mockResolvedValue(releaseResult),
      saveRegistry: vi.fn(),
      syncProject: vi.fn()
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli(["node", "devloop", "release-check"]);

    expect(exitCode).toBe(1);
    expect(process.exitCode).toBe(1);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(releaseResult, null, 2));
  });

  it("passes strict-snapshot override through to release checks", async () => {
    const releaseResult = {
      decision: "pass" as const,
      mode: "snapshot" as const,
      impactedFeatures: [],
      unmetRequirements: [],
      notes: ["Snapshot git evidence requirement skipped by strict-snapshot override"]
    };
    const runReleaseCheck = vi.fn().mockResolvedValue(releaseResult);

    vi.doMock("@devloop/core", () => ({
      getStatusSummary: vi.fn(),
      runReleaseCheck,
      saveRegistry: vi.fn(),
      syncProject: vi.fn()
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli([
      "node",
      "devloop",
      "release-check",
      "--strict-snapshot=false"
    ]);

    expect(exitCode).toBe(0);
    expect(process.exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(runReleaseCheck).toHaveBeenCalledWith(originalCwd, {
      strictSnapshot: false
    });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(releaseResult, null, 2));
  });

  it("starts the local ui server on the requested port with the bundled ui dist path", async () => {
    const launchDashboardRuntime = vi.fn().mockResolvedValue({
      url: "http://127.0.0.1:4310",
      reusedExisting: false
    });

    vi.doMock("@devloop/server", () => ({
      launchDashboardRuntime
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli(["node", "devloop", "ui", "--port", "4310"]);

    expect(exitCode).toBe(0);
    expect(process.exitCode).toBe(0);
    expect(launchDashboardRuntime).toHaveBeenCalledWith({
      projectRoot: originalCwd,
      host: "127.0.0.1",
      port: 4310,
      uiDistPath: expectedUiDistPath
    });
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("DevLoop UI available at http://127.0.0.1:4310");
  });

  it("records a test run from repeated scenario flags and prints the persisted payload", async () => {
    const recordResult = {
      run: {
        run_id: "run-smoke-current",
        status: "passed" as const,
        revision: {
          kind: "snapshot" as const,
          snapshotId: "snap_000001"
        },
        scenario_ids: ["devloop-workspace-smoke", "cli-command-smoke"],
        scope: "smoke" as const,
        artifacts: []
      }
    };

    vi.doMock("@devloop/core", () => ({
      getStatusSummary: vi.fn(),
      recordTestRun: vi.fn().mockResolvedValue(recordResult),
      runReleaseCheck: vi.fn(),
      saveRegistry: vi.fn(),
      syncProject: vi.fn()
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli([
      "node",
      "devloop",
      "record-run",
      "--scope",
      "smoke",
      "--status",
      "passed",
      "--scenario",
      "devloop-workspace-smoke",
      "--scenario",
      "cli-command-smoke"
    ]);

    const core = await import("@devloop/core");

    expect(exitCode).toBe(0);
    expect(process.exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(vi.mocked(core.recordTestRun)).toHaveBeenCalledWith(originalCwd, {
      scope: "smoke",
      status: "passed",
      scenarioIds: ["devloop-workspace-smoke", "cli-command-smoke"],
      artifacts: []
    });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(recordResult, null, 2));
  });

  it("captures a requirement from CLI flags and prints the persisted iteration payload", async () => {
    const captureResult = {
      iteration: {
        id: "iter_capture_demo",
        slug: "capture-demo",
        title: "Capture demo",
        status: "active",
        source: "manual",
        createdAt: "2026-06-11T08:00:00.000Z",
        updatedAt: "2026-06-11T08:00:00.000Z",
        closedAt: null,
        reopenedFrom: null,
        rawUserIntent: "Need a new smoke test",
        goal: "Need a new smoke test",
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
      prdPath: "/tmp/capture-demo.md"
    };
    const captureRequirement = vi.fn().mockResolvedValue(captureResult);

    vi.doMock("@devloop/core", () => ({
      captureRequirement,
      getStatusSummary: vi.fn(),
      runReleaseCheck: vi.fn(),
      saveRegistry: vi.fn(),
      syncProject: vi.fn()
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli([
      "node",
      "devloop",
      "capture",
      "--source",
      "cli",
      "--title",
      "Capture demo",
      "--raw-request",
      "Need a new smoke test",
      "--timestamp",
      "2026-06-11T08:00:00.000Z",
      "--intent-type",
      "new_iteration",
      "--confidence",
      "0.65",
      "--suggested-iteration-id",
      "iter_existing"
    ]);

    expect(exitCode).toBe(0);
    expect(process.exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(captureRequirement).toHaveBeenCalledWith(originalCwd, {
      source: "manual",
      title: "Capture demo",
      rawRequest: "Need a new smoke test",
      timestamp: "2026-06-11T08:00:00.000Z",
      intentType: "new_iteration",
      confidence: 0.65,
      suggestedIterationId: "iter_existing"
    });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(captureResult, null, 2));
  });

  it("lists iterations and prints the returned payload", async () => {
    const iterations = [
      {
        id: "iter_b",
        slug: "b",
        title: "Second",
        status: "reopened",
        source: "manual",
        createdAt: "2026-06-11T09:00:00.000Z",
        updatedAt: "2026-06-11T10:00:00.000Z",
        closedAt: null,
        reopenedFrom: null,
        rawUserIntent: "Second request",
        goal: "Second request",
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
    ];
    const listIterations = vi.fn().mockResolvedValue(iterations);

    vi.doMock("@devloop/core", () => ({
      getStatusSummary: vi.fn(),
      listIterations,
      runReleaseCheck: vi.fn(),
      saveRegistry: vi.fn(),
      syncProject: vi.fn()
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli(["node", "devloop", "iteration", "list"]);

    expect(exitCode).toBe(0);
    expect(process.exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(listIterations).toHaveBeenCalledWith(originalCwd);
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(iterations, null, 2));
  });

  it("loads a single iteration by id and prints the returned payload", async () => {
    const iteration = {
      id: "iter_show_demo",
      slug: "show-demo",
      title: "Show demo",
      status: "active",
      source: "manual",
      createdAt: "2026-06-11T08:00:00.000Z",
      updatedAt: "2026-06-11T08:30:00.000Z",
      closedAt: null,
      reopenedFrom: null,
      rawUserIntent: "Inspect iteration details",
      goal: "Inspect iteration details",
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
    };
    const loadIteration = vi.fn().mockResolvedValue(iteration);

    vi.doMock("@devloop/core", () => ({
      getStatusSummary: vi.fn(),
      loadIteration,
      runReleaseCheck: vi.fn(),
      saveRegistry: vi.fn(),
      syncProject: vi.fn()
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli(["node", "devloop", "iteration", "show", "iter_show_demo"]);

    expect(exitCode).toBe(0);
    expect(process.exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(loadIteration).toHaveBeenCalledWith(originalCwd, "iter_show_demo");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(iteration, null, 2));
  });

  it("runs local-api-smoke checks and records a passed run automatically", async () => {
    const inject = vi
      .fn()
      .mockResolvedValueOnce({ statusCode: 200, json: () => ({ ok: true }) })
      .mockResolvedValueOnce({ statusCode: 200, json: () => ({ counts: {} }) })
      .mockResolvedValueOnce({ statusCode: 200, json: () => ({ items: [] }) })
      .mockResolvedValueOnce({ statusCode: 200, json: () => ({ items: [] }) })
      .mockResolvedValueOnce({ statusCode: 200, json: () => ({ items: [] }) })
      .mockResolvedValueOnce({ statusCode: 200, json: () => ({ decision: "warn" }) });
    const close = vi.fn().mockResolvedValue(undefined);
    const buildServer = vi.fn().mockResolvedValue({ inject, close });
    const recordTestRun = vi.fn().mockResolvedValue({
      run: {
        run_id: "run_local_api_smoke",
        status: "passed",
        revision: { kind: "snapshot", snapshotId: "snap_000001" },
        scenario_ids: ["local-api-smoke"],
        scope: "impacted",
        artifacts: []
      }
    });

    vi.doMock("@devloop/server", () => ({ buildServer }));
    vi.doMock("@devloop/core", () => ({
      getStatusSummary: vi.fn(),
      recordTestRun,
      runReleaseCheck: vi.fn(),
      saveRegistry: vi.fn(),
      syncProject: vi.fn()
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli(["node", "devloop", "run-scenario", "local-api-smoke"]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(buildServer).toHaveBeenCalledWith({ projectRoot: originalCwd });
    expect(inject).toHaveBeenNthCalledWith(1, { method: "GET", url: "/api/health" });
    expect(inject).toHaveBeenNthCalledWith(2, { method: "GET", url: "/api/status" });
    expect(inject).toHaveBeenNthCalledWith(3, { method: "GET", url: "/api/iterations" });
    expect(inject).toHaveBeenNthCalledWith(5, { method: "GET", url: "/api/recent-runs" });
    expect(inject).toHaveBeenNthCalledWith(6, { method: "POST", url: "/api/release-check" });
    expect(recordTestRun).toHaveBeenCalledWith(originalCwd, {
      scope: "impacted",
      status: "passed",
      scenarioIds: ["local-api-smoke"],
      artifacts: []
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          run: {
            run_id: "run_local_api_smoke",
            status: "passed",
            revision: { kind: "snapshot", snapshotId: "snap_000001" },
            scenario_ids: ["local-api-smoke"],
            scope: "impacted",
            artifacts: []
          }
        },
        null,
        2
      )
    );
  });

  it("records a failed run when scenario checks fail", async () => {
    const inject = vi.fn().mockResolvedValue({ statusCode: 500, body: "boom" });
    const close = vi.fn().mockResolvedValue(undefined);
    const buildServer = vi.fn().mockResolvedValue({ inject, close });
    const recordTestRun = vi.fn().mockResolvedValue({
      run: {
        run_id: "run_browser_failed",
        status: "failed",
        revision: { kind: "snapshot", snapshotId: "snap_000001" },
        scenario_ids: ["browser-dashboard-smoke"],
        scope: "impacted",
        artifacts: []
      }
    });

    vi.doMock("@devloop/server", () => ({ buildServer }));
    vi.doMock("@devloop/core", () => ({
      getStatusSummary: vi.fn(),
      recordTestRun,
      runReleaseCheck: vi.fn(),
      saveRegistry: vi.fn(),
      syncProject: vi.fn()
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli(["node", "devloop", "run-scenario", "browser-dashboard-smoke"]);

    expect(exitCode).toBe(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(recordTestRun).toHaveBeenCalledWith(originalCwd, {
      scope: "impacted",
      status: "failed",
      scenarioIds: ["browser-dashboard-smoke"],
      artifacts: []
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("runs default-console-smoke checks and records a passed run automatically", async () => {
    const inject = vi
      .fn()
      .mockResolvedValueOnce({
        statusCode: 200,
        body: "<!doctype html><html><body><div id=\"root\"></div></body></html>"
      })
      .mockResolvedValueOnce({ statusCode: 200, body: "{\"ok\":true}" })
      .mockResolvedValueOnce({ statusCode: 200, body: "{\"items\":[]}" })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({
          kind: "action",
          actionId: "status",
          status: "passed"
        })
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        body: JSON.stringify({
          kind: "action",
          actionId: "release-check",
          status: "passed"
        })
      });
    const close = vi.fn().mockResolvedValue(undefined);
    const buildConsoleApp = vi.fn().mockResolvedValue({ inject, close });
    const recordTestRun = vi.fn().mockResolvedValue({
      run: {
        run_id: "run_default_console_smoke",
        status: "passed",
        revision: { kind: "snapshot", snapshotId: "snap_000001" },
        scenario_ids: ["default-console-smoke"],
        scope: "impacted",
        artifacts: []
      }
    });

    vi.doMock("@devloop/server", () => ({
      buildConsoleApp
    }));
    vi.doMock("@devloop/core", () => ({
      getStatusSummary: vi.fn(),
      recordTestRun,
      runReleaseCheck: vi.fn(),
      saveRegistry: vi.fn(),
      syncProject: vi.fn()
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { runCli } = await importCli();

    const exitCode = await runCli(["node", "devloop", "run-scenario", "default-console-smoke"]);

    expect(exitCode).toBe(0);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(buildConsoleApp).toHaveBeenCalledWith(
      expect.objectContaining({
        projectRoot: originalCwd,
        consoleUiDistPath: expectedConsoleDistPath,
        dashboardUiDistPath: expectedUiDistPath
      })
    );
    expect(inject).toHaveBeenNthCalledWith(1, { method: "GET", url: "/" });
    expect(inject).toHaveBeenNthCalledWith(2, { method: "GET", url: "/api/health" });
    expect(inject).toHaveBeenNthCalledWith(3, { method: "GET", url: "/api/iterations" });
    expect(inject).toHaveBeenNthCalledWith(4, { method: "POST", url: "/api/actions/status" });
    expect(inject).toHaveBeenNthCalledWith(5, { method: "POST", url: "/api/actions/release-check" });
    expect(recordTestRun).toHaveBeenCalledWith(originalCwd, {
      scope: "impacted",
      status: "passed",
      scenarioIds: ["default-console-smoke"],
      artifacts: []
    });
    expect(close).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          run: {
            run_id: "run_default_console_smoke",
            status: "passed",
            revision: { kind: "snapshot", snapshotId: "snap_000001" },
            scenario_ids: ["default-console-smoke"],
            scope: "impacted",
            artifacts: []
          }
        },
        null,
        2
      )
    );
  });
});
