import {
  type ConsoleActionId,
  type ConsoleWorkflowId,
  type WorkflowExecutionResult,
  type WorkflowStepResult
} from "./console-types.js";
import { runConsoleAction } from "./console-actions.js";

type WorkflowContext = {
  projectRoot: string | URL;
  dashboardUiDistPath?: string;
};

const WORKFLOWS: Record<ConsoleWorkflowId, ConsoleActionId[]> = {
  "development-check": ["sync", "local-api-smoke", "status"],
  "pre-release-check": ["sync", "local-api-smoke", "browser-dashboard-smoke", "release-check"]
};

let workflowInProgress = false;

function createExecutionId() {
  return `workflow_${Date.now().toString(36)}`;
}

function buildSkippedStep(actionId: ConsoleActionId): WorkflowStepResult {
  return {
    stepId: actionId,
    actionId,
    status: "skipped",
    summary: `${actionId} skipped`,
    logs: [`Skipped because an earlier workflow step failed.`],
    startedAt: null,
    finishedAt: null
  };
}

export async function runConsoleWorkflow(
  workflowId: ConsoleWorkflowId,
  context: WorkflowContext
): Promise<WorkflowExecutionResult> {
  if (workflowInProgress) {
    throw new Error("A workflow is already running.");
  }

  workflowInProgress = true;
  const startedAt = new Date().toISOString();
  const steps: WorkflowStepResult[] = [];

  try {
    const actionIds = WORKFLOWS[workflowId];

    if (!actionIds) {
      throw new Error(`Unknown workflow id: ${workflowId}`);
    }

    for (const actionId of actionIds) {
      const result = await runConsoleAction(actionId, context);

      steps.push({
        stepId: actionId,
        actionId,
        status: result.status,
        summary: result.summary,
        logs: result.logs,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        data: result.data,
        error: result.error
      });

      if (result.status === "failed") {
        const remainingActionIds = actionIds.slice(steps.length);

        for (const remainingActionId of remainingActionIds) {
          steps.push(buildSkippedStep(remainingActionId));
        }

        return {
          executionId: createExecutionId(),
          kind: "workflow",
          workflowId,
          status: "failed",
          startedAt,
          finishedAt: new Date().toISOString(),
          steps
        };
      }
    }

    return {
      executionId: createExecutionId(),
      kind: "workflow",
      workflowId,
      status: "passed",
      startedAt,
      finishedAt: new Date().toISOString(),
      steps
    };
  } finally {
    workflowInProgress = false;
  }
}
