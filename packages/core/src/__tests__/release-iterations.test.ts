import { describe, expect, it } from "vitest";
import { evaluateIterationReleaseStatus } from "../release-iterations.js";

describe("evaluateIterationReleaseStatus", () => {
  it("blocks when acceptance or regression items are still pending", () => {
    const result = evaluateIterationReleaseStatus([
      {
        id: "iter_001",
        title: "Wizard refactor",
        status: "active",
        acceptanceItems: [{ status: "verified" }, { status: "pending" }],
        regressionItems: [{ status: "pending" }]
      }
    ] as never);

    expect(result.decision).toBe("block");
    expect(result.unmetRequirements).toContain("iteration_pending:iter_001");
  });

  it("passes when remaining checklist items are verified or waived", () => {
    const result = evaluateIterationReleaseStatus([
      {
        id: "iter_002",
        title: "Locale polish",
        status: "reopened",
        acceptanceItems: [{ status: "verified" }],
        regressionItems: [{ status: "waived" }]
      }
    ] as never);

    expect(result.decision).toBe("pass");
    expect(result.unmetRequirements).toEqual([]);
  });
});
