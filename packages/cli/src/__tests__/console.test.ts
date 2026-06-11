import { beforeEach, describe, expect, it, vi } from "vitest";
import { fileURLToPath } from "node:url";

const expectedConsoleDistPath = fileURLToPath(new URL("../../dist/console", import.meta.url));
const expectedDashboardDistPath = fileURLToPath(new URL("../../dist/ui", import.meta.url));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unmock("@devloop/server");
  vi.unmock("node:child_process");
});

describe("launchConsole", () => {
  it("starts the console server with bundled assets, prints the url, and opens the browser", async () => {
    const listen = vi.fn().mockResolvedValue("http://127.0.0.1:4301");
    const close = vi.fn().mockResolvedValue(undefined);
    const buildConsoleApp = vi.fn().mockResolvedValue({ listen, close });
    const unref = vi.fn();
    const spawn = vi.fn().mockReturnValue({ unref });

    vi.doMock("@devloop/server", () => ({
      buildConsoleApp
    }));
    vi.doMock("node:child_process", () => ({
      spawn
    }));

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { launchConsole } = await import("../commands/console.js");

    await launchConsole({ projectRoot: "/tmp/devloop-project" });

    expect(buildConsoleApp).toHaveBeenCalledWith({
      projectRoot: "/tmp/devloop-project",
      dashboardUiDistPath: expectedDashboardDistPath,
      consoleUiDistPath: expectedConsoleDistPath
    });
    expect(listen).toHaveBeenCalledWith({
      host: "127.0.0.1",
      port: 4301
    });
    expect(logSpy).toHaveBeenCalledWith("DevLoop console available at http://127.0.0.1:4301");
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls.flat().join(" ")).toContain("http://127.0.0.1:4301");
    expect(unref).toHaveBeenCalledTimes(1);
  });
});
