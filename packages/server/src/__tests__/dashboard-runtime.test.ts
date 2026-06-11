import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../app.js", () => ({
  buildServer: vi.fn()
}));

import { buildServer } from "../app.js";
import {
  launchDashboardRuntime,
  shutdownDashboardRuntimeForTests
} from "../dashboard-runtime.js";

afterEach(async () => {
  vi.clearAllMocks();
  await shutdownDashboardRuntimeForTests();
});

describe("launchDashboardRuntime", () => {
  it("reuses the active runtime when the launch request matches", async () => {
    const listen = vi.fn().mockResolvedValue("http://127.0.0.1:4300");
    const close = vi.fn().mockResolvedValue(undefined);

    vi.mocked(buildServer).mockResolvedValue({ listen, close } as never);

    const first = await launchDashboardRuntime({
      projectRoot: "/tmp/project",
      uiDistPath: "/tmp/ui",
      host: "127.0.0.1",
      port: 4300
    });
    const second = await launchDashboardRuntime({
      projectRoot: "/tmp/project",
      uiDistPath: "/tmp/ui",
      host: "127.0.0.1",
      port: 4300
    });

    expect(first).toEqual({
      url: "http://127.0.0.1:4300",
      reusedExisting: false
    });
    expect(second).toEqual({
      url: "http://127.0.0.1:4300",
      reusedExisting: true
    });
    expect(buildServer).toHaveBeenCalledTimes(1);
  });

  it("rejects a mismatched runtime request instead of silently reusing the wrong server", async () => {
    const listen = vi.fn().mockResolvedValue("http://127.0.0.1:4300");
    const close = vi.fn().mockResolvedValue(undefined);

    vi.mocked(buildServer).mockResolvedValue({ listen, close } as never);

    await launchDashboardRuntime({
      projectRoot: "/tmp/project-a",
      uiDistPath: "/tmp/ui-a",
      host: "127.0.0.1",
      port: 4300
    });

    await expect(
      launchDashboardRuntime({
        projectRoot: "/tmp/project-b",
        uiDistPath: "/tmp/ui-b",
        host: "127.0.0.1",
        port: 4301
      })
    ).rejects.toThrow("Dashboard runtime already running at http://127.0.0.1:4300");
  });
});
