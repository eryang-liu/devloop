import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api.js", () => ({
  getDashboardData: vi.fn()
}));

import App from "../App.js";
import { getDashboardData } from "../api.js";

const originalGetComputedStyle = window.getComputedStyle.bind(window);

describe("Dashboard App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, "getComputedStyle", {
      writable: true,
      value: vi.fn().mockImplementation((element: Element) => originalGetComputedStyle(element))
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "en-US"
    });

    vi.mocked(getDashboardData).mockResolvedValue({
      status: {
        counts: {
          never_tested: 0,
          changed_untested: 1,
          rework_untested: 0,
          tested: 4,
          failed: 0,
          "needs-triage": 0
        },
        highRiskFeatures: [],
        lastSyncAt: "2026-06-11T10:00:00.000Z",
        vcs: {
          mode: "snapshot",
          gitRoot: null,
          headSha: null,
          projectId: "proj_demo",
          upgradedFromSnapshotAt: null
        }
      },
      queue: [],
      runs: [],
      release: {
        decision: "pass",
        mode: "snapshot",
        impactedFeatures: [],
        unmetRequirements: [],
        notes: []
      },
      iterations: []
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("defaults to browser Chinese and can switch back to English", async () => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "zh-CN"
    });

    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole("heading", { name: "发布指挥台" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "刷新发布台" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "EN" }));

    expect(await screen.findByRole("heading", { name: "Release Command Desk" })).toBeTruthy();
    expect(window.localStorage.getItem("devloop.language")).toBe("en-US");
  });

  it("shows active iterations and requirement verification counts", async () => {
    vi.mocked(getDashboardData).mockResolvedValue({
      status: {
        counts: {
          never_tested: 0,
          changed_untested: 1,
          rework_untested: 0,
          tested: 4,
          failed: 0,
          "needs-triage": 0
        },
        highRiskFeatures: [],
        lastSyncAt: "2026-06-11T10:00:00.000Z",
        vcs: {
          mode: "snapshot",
          gitRoot: null,
          headSha: null,
          projectId: "proj_demo",
          upgradedFromSnapshotAt: null
        }
      },
      queue: [],
      runs: [],
      release: {
        decision: "warn",
        mode: "snapshot",
        impactedFeatures: [],
        unmetRequirements: ["iteration_pending:iter_001"],
        notes: []
      },
      iterations: [
        {
          id: "iter_001",
          title: "Wizard refactor",
          status: "reopened",
          acceptancePending: 2,
          regressionPending: 1,
          updatedAt: "2026-06-11T10:00:00.000Z"
        }
      ]
    });

    render(<App />);

    expect(await screen.findByText("Wizard refactor")).toBeTruthy();
    expect(screen.getByText("2 acceptance pending")).toBeTruthy();
    expect(screen.getByText("1 regression pending")).toBeTruthy();
  });
});
