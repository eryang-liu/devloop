import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api.js", () => ({
  captureIteration: vi.fn(),
  listIterations: vi.fn().mockResolvedValue([]),
  runAction: vi.fn(),
  runWorkflow: vi.fn()
}));

import App from "../App.js";
import { captureIteration, listIterations, runAction, runWorkflow } from "../api.js";

describe("Console App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "en-US"
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders quick actions and workflows", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "DevLoop control console" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sync project" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run local-api-smoke" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Development check" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Pre-release check" })).toBeTruthy();
  });

  it("shows the active iteration rail and captures a requirement from the console", async () => {
    const user = userEvent.setup();

    vi.mocked(listIterations).mockResolvedValue([
      {
        id: "iter_001",
        title: "Wizard refactor",
        status: "active",
        updatedAt: "2026-06-11T08:00:00.000Z",
        source: "manual"
      }
    ]);
    vi.mocked(captureIteration).mockResolvedValue({
      iteration: {
        id: "iter_002",
        title: "Add locale capture",
        status: "active"
      },
      prdPath: "/tmp/project/docs/prd/2026-06-11/add-locale-capture.md"
    });

    render(<App />);

    expect(await screen.findByText("Wizard refactor")).toBeTruthy();

    await user.type(screen.getByLabelText("Requirement input"), "补一个需求自动生成 PRD 的入口");
    await user.click(screen.getByRole("button", { name: "Capture requirement" }));

    expect(captureIteration).toHaveBeenCalledWith({
      rawRequest: "补一个需求自动生成 PRD 的入口",
      title: undefined,
      suggestedIterationId: "iter_001",
      intentType: "iteration_extension"
    });
    expect(await screen.findByText("Add locale capture")).toBeTruthy();
  });

  it("opens the help modal and the full help view", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Help" }));

    expect(screen.getByText("Quick actions run one step at a time.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View full help" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "View full help" }));

    expect(screen.getByRole("heading", { name: "Full help" })).toBeTruthy();
    expect(screen.getByText("Daily usage guide")).toBeTruthy();
    expect(screen.getByText("Pre-release guidance")).toBeTruthy();
  });

  it("runs a quick action and expands its logs", async () => {
    const user = userEvent.setup();

    vi.mocked(runAction).mockResolvedValue({
      executionId: "exec_sync",
      kind: "action",
      actionId: "sync",
      status: "passed",
      summary: "Registry synced successfully",
      logs: ["Sync started", "Registry updated"],
      startedAt: "2026-06-11T10:00:00.000Z",
      finishedAt: "2026-06-11T10:00:01.000Z",
      data: {
        lastSyncAt: "2026-06-11T10:00:01.000Z"
      }
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Sync project" }));

    expect(runAction).toHaveBeenCalledWith("sync");
    const resultsPanel = screen.getByRole("heading", { name: "Latest run details" }).closest("section");

    expect(resultsPanel).toBeTruthy();
    expect(
      await within(resultsPanel as HTMLElement).findByText("Registry synced successfully")
    ).toBeTruthy();

    await user.click(within(resultsPanel as HTMLElement).getByRole("button", { name: "Show logs" }));

    expect(within(resultsPanel as HTMLElement).getByText("Sync started")).toBeTruthy();
    expect(within(resultsPanel as HTMLElement).getByText("Registry updated")).toBeTruthy();
  });

  it("runs a workflow and reveals step-level logs", async () => {
    const user = userEvent.setup();

    vi.mocked(runWorkflow).mockResolvedValue({
      executionId: "workflow_pre_release",
      kind: "workflow",
      workflowId: "pre-release-check",
      status: "passed",
      startedAt: "2026-06-11T10:05:00.000Z",
      finishedAt: "2026-06-11T10:05:05.000Z",
      steps: [
        {
          stepId: "sync",
          actionId: "sync",
          status: "passed",
          summary: "Registry synced successfully",
          logs: ["Sync started", "Registry updated"],
          startedAt: "2026-06-11T10:05:00.000Z",
          finishedAt: "2026-06-11T10:05:01.000Z"
        },
        {
          stepId: "local-api-smoke",
          actionId: "local-api-smoke",
          status: "passed",
          summary: "local-api-smoke completed successfully",
          logs: ["GET /api/health -> 200"],
          startedAt: "2026-06-11T10:05:01.000Z",
          finishedAt: "2026-06-11T10:05:02.000Z"
        }
      ]
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Pre-release check" }));

    expect(runWorkflow).toHaveBeenCalledWith("pre-release-check");
    const resultsPanel = screen.getByRole("heading", { name: "Latest run details" }).closest("section");

    expect(resultsPanel).toBeTruthy();
    expect(
      await within(resultsPanel as HTMLElement).findByText("Workflow completed successfully")
    ).toBeTruthy();
    expect(within(resultsPanel as HTMLElement).getByText("Registry synced successfully")).toBeTruthy();

    await user.click(within(resultsPanel as HTMLElement).getAllByRole("button", { name: "Show logs" })[1]);

    expect(within(resultsPanel as HTMLElement).getByText("GET /api/health -> 200")).toBeTruthy();
  });

  it("opens the dashboard url after the start-ui action succeeds", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    vi.mocked(runAction).mockResolvedValue({
      executionId: "exec_start_ui",
      kind: "action",
      actionId: "start-ui",
      status: "passed",
      summary: "DevLoop UI is ready",
      logs: ["Dashboard server started"],
      startedAt: "2026-06-11T10:10:00.000Z",
      finishedAt: "2026-06-11T10:10:01.000Z",
      data: {
        url: "http://127.0.0.1:4318"
      }
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "Start DevLoop UI" }));

    expect(runAction).toHaveBeenCalledWith("start-ui");
    expect(openSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:4318",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it("defaults to browser Chinese and can switch back to English while persisting the preference", async () => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "zh-CN"
    });

    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByRole("heading", { name: "DevLoop 控制台" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "同步项目" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "EN" }));

    expect(screen.getByRole("heading", { name: "DevLoop control console" })).toBeTruthy();
    expect(window.localStorage.getItem("devloop.language")).toBe("en-US");
  });

  it("localizes known execution summaries but keeps raw logs unchanged", async () => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "zh-CN"
    });

    const user = userEvent.setup();

    vi.mocked(runAction).mockResolvedValue({
      executionId: "exec_sync",
      kind: "action",
      actionId: "sync",
      status: "passed",
      summary: "Registry synced successfully",
      logs: ["Sync started", "Registry updated"],
      startedAt: "2026-06-11T10:00:00.000Z",
      finishedAt: "2026-06-11T10:00:01.000Z",
      data: {
        lastSyncAt: "2026-06-11T10:00:01.000Z"
      }
    });

    render(<App />);

    await user.click(screen.getByRole("button", { name: "同步项目" }));

    const resultsPanel = screen.getByRole("heading", { name: "最近一次运行详情" }).closest("section");

    expect(resultsPanel).toBeTruthy();
    expect(await within(resultsPanel as HTMLElement).findByText("项目状态已同步")).toBeTruthy();

    await user.click(within(resultsPanel as HTMLElement).getByRole("button", { name: "查看日志" }));

    expect(within(resultsPanel as HTMLElement).getByText("Sync started")).toBeTruthy();
    expect(within(resultsPanel as HTMLElement).getByText("Registry updated")).toBeTruthy();
  });
});
