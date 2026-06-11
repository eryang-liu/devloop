import type { IterationRecord } from "./iteration-types.js";

function hasUnverifiedChecklistItem(
  items: Array<Pick<IterationRecord["acceptanceItems"][number], "status">>
) {
  return items.some((item) => item.status !== "verified" && item.status !== "waived");
}

export function evaluateIterationReleaseStatus(iterations: IterationRecord[]) {
  const unmetRequirements = iterations.flatMap((iteration) => {
    const acceptancePending = hasUnverifiedChecklistItem(iteration.acceptanceItems);
    const regressionPending = hasUnverifiedChecklistItem(iteration.regressionItems);

    return acceptancePending || regressionPending ? [`iteration_pending:${iteration.id}`] : [];
  });

  return {
    decision: unmetRequirements.length > 0 ? "block" : "pass",
    unmetRequirements
  } as const;
}
