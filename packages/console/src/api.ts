export type ConsoleActionId =
  | "sync"
  | "status"
  | "release-check"
  | "start-ui"
  | "local-api-smoke"
  | "browser-dashboard-smoke";

export type ConsoleWorkflowId = "development-check" | "pre-release-check";
export type ConsoleActionStatus = "passed" | "failed";
export type ConsoleWorkflowStepStatus = ConsoleActionStatus | "skipped";
export type IterationStatus = "active" | "paused" | "done" | "reopened" | "archived";

export type ConsoleExecutionError = {
  message: string;
};

export type IterationSummary = {
  id: string;
  title: string;
  status: IterationStatus;
  updatedAt: string;
  source: "manual" | "codex" | "cursor" | "claude-code";
};

export type CaptureIterationResult = {
  iteration: {
    id: string;
    title: string;
    status: IterationStatus;
  };
  prdPath: string;
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

type RequestInitInput = {
  method: "GET" | "POST";
  body?: unknown;
};

async function requestJson<T>(input: RequestInfo | URL, init: RequestInitInput): Promise<T> {
  const response = await fetch(input, {
    method: init.method,
    headers: init.body ? { "content-type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined
  });

  const data = (await response.json()) as T | { message?: string };

  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
        ? data.message
        : `Request failed with ${response.status}`
    );
  }

  return data as T;
}

export function runAction(actionId: ConsoleActionId) {
  if (actionId === "local-api-smoke" || actionId === "browser-dashboard-smoke") {
    return requestJson<ActionExecutionResult>("/api/actions/run-scenario", {
      method: "POST",
      body: {
        scenarioId: actionId
      }
    });
  }

  return requestJson<ActionExecutionResult>(`/api/actions/${actionId}`, {
    method: "POST"
  });
}

export function runWorkflow(workflowId: ConsoleWorkflowId) {
  return requestJson<WorkflowExecutionResult>("/api/workflows/run", {
    method: "POST",
    body: {
      workflowId
    }
  });
}

export async function listIterations() {
  const result = await requestJson<{ items: IterationSummary[] }>("/api/iterations", {
    method: "GET"
  });
  return result.items;
}

export function captureIteration(input: {
  rawRequest: string;
  title?: string;
  suggestedIterationId?: string;
  intentType?:
    | "new_iteration"
    | "iteration_extension"
    | "regression_fix"
    | "reopen_iteration"
    | "uncertain";
}) {
  return requestJson<CaptureIterationResult>("/api/iterations/capture", {
    method: "POST",
    body: {
      source: "manual",
      rawRequest: input.rawRequest,
      title: input.title,
      suggestedIterationId: input.suggestedIterationId,
      intentType: input.intentType
    }
  });
}
