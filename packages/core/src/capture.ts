import {
  createIterationRecord,
  listIterations,
  saveIteration,
  saveIterationIndex
} from "./iterations.js";
import type { IterationRecord } from "./iteration-types.js";
import { writeIterationPrd } from "./prd.js";

type CaptureIntentType =
  | "new_iteration"
  | "iteration_extension"
  | "regression_fix"
  | "reopen_iteration"
  | "uncertain";

export type CaptureRequirementInput = {
  source: IterationRecord["source"];
  rawRequest: string;
  timestamp: string;
  title?: string;
  suggestedIterationId?: string;
  intentType?: CaptureIntentType;
  confidence?: number;
};

export type CaptureRequirementResult = {
  iteration: IterationRecord;
  prdPath: string;
};

function createAcceptanceItem(title: string) {
  return {
    id: "acc_1",
    title,
    type: "acceptance" as const,
    priority: "P0" as const,
    rationale: "Initial generated acceptance item",
    suggestedScope: "smoke" as const,
    status: "pending" as const,
    evidenceLinks: []
  };
}

function createRegressionItem(iteration: IterationRecord, rawRequest: string) {
  return {
    id: `reg_${iteration.regressionItems.length + 1}`,
    title: rawRequest,
    type: "regression" as const,
    priority: "P1" as const,
    rationale: "Captured from follow-up reopened requirement",
    suggestedScope: "current+p0" as const,
    status: "pending" as const,
    evidenceLinks: []
  };
}

function createChangeEvent(
  iteration: IterationRecord,
  input: CaptureRequirementInput,
  intentType: CaptureIntentType,
  confidence: number
) {
  return {
    id: `evt_${iteration.changeEvents.length + 1}`,
    source: input.source,
    timestamp: input.timestamp,
    rawRequest: input.rawRequest,
    contextSummary: "",
    intentType,
    confidence,
    conversationId: null
  };
}

export async function captureRequirement(
  projectRoot: string | URL,
  input: CaptureRequirementInput
): Promise<CaptureRequirementResult> {
  const existing = await listIterations(projectRoot);
  const matchedIteration = input.suggestedIterationId
    ? existing.find((item) => item.id === input.suggestedIterationId)
    : undefined;
  const intentType = input.intentType ?? "new_iteration";
  const confidence = input.confidence ?? (intentType === "new_iteration" ? 1 : 0.8);

  let iteration = matchedIteration
    ? matchedIteration
    : createIterationRecord({
        title: input.title ?? input.rawRequest.slice(0, 48),
        source: input.source,
        rawUserIntent: input.rawRequest,
        createdAt: input.timestamp
      });

  const nextChangeEvents = [
    ...iteration.changeEvents,
    createChangeEvent(iteration, input, intentType, confidence)
  ];

  if (intentType === "reopen_iteration" && matchedIteration) {
    iteration = {
      ...iteration,
      status: "reopened",
      updatedAt: input.timestamp,
      regressionItems: [...iteration.regressionItems, createRegressionItem(iteration, input.rawRequest)],
      changeEvents: nextChangeEvents
    };
  } else {
    iteration = {
      ...iteration,
      updatedAt: input.timestamp,
      goal: iteration.goal || input.rawRequest,
      acceptanceItems:
        iteration.acceptanceItems.length > 0
          ? iteration.acceptanceItems
          : [createAcceptanceItem(input.title ?? input.rawRequest.slice(0, 48))],
      changeEvents: nextChangeEvents
    };
  }

  await saveIteration(projectRoot, iteration);
  const merged = [iteration, ...existing.filter((item) => item.id !== iteration.id)];
  await saveIterationIndex(projectRoot, merged);
  const prdPath = await writeIterationPrd(projectRoot, iteration);

  return { iteration, prdPath };
}
