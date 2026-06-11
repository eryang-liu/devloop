export type ConsoleActionId =
  | "sync"
  | "status"
  | "release-check"
  | "start-ui"
  | "local-api-smoke"
  | "browser-dashboard-smoke";

export type ConsoleActionStatus = "passed" | "failed";
export type ConsoleWorkflowStepStatus = ConsoleActionStatus | "skipped";
export type ConsoleWorkflowId = "development-check" | "pre-release-check";

export type ConsoleExecutionError = {
  message: string;
};

export type ActionExecutionResult = {
  executionId: string;
  kind: "action";
  actionId: ConsoleActionId;
  status: ConsoleActionStatus;
  summary: string;
  logs: string[];
  startedAt: string;
  finishedAt: string;
  data?: unknown;
  error?: ConsoleExecutionError;
};

export type WorkflowStepResult = {
  stepId: ConsoleActionId;
  actionId: ConsoleActionId;
  status: ConsoleWorkflowStepStatus;
  summary: string;
  logs: string[];
  startedAt: string | null;
  finishedAt: string | null;
  data?: unknown;
  error?: ConsoleExecutionError;
};

export type WorkflowExecutionResult = {
  executionId: string;
  kind: "workflow";
  workflowId: ConsoleWorkflowId;
  status: ConsoleActionStatus;
  startedAt: string;
  finishedAt: string;
  steps: WorkflowStepResult[];
};
