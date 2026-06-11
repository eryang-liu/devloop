import { describe, expect, it } from "vitest";
import { renderIterationPrd } from "../prd.js";

describe("renderIterationPrd", () => {
  it("renders requirement, acceptance, and regression sections", () => {
    const markdown = renderIterationPrd({
      id: "iter_001",
      slug: "wizard-refactor",
      title: "Wizard refactor",
      status: "active",
      source: "manual",
      createdAt: "2026-06-11T08:00:00.000Z",
      updatedAt: "2026-06-11T08:05:00.000Z",
      closedAt: null,
      reopenedFrom: null,
      rawUserIntent: "重构向导并补充回归测试",
      goal: "让新向导更清晰，同时保住旧流程",
      nonGoals: ["不改支付流程"],
      acceptanceItems: [
        {
          id: "acc_1",
          title: "新向导首屏可正常进入",
          type: "acceptance",
          priority: "P0",
          rationale: "主目标入口",
          suggestedScope: "smoke",
          status: "pending",
          evidenceLinks: []
        }
      ],
      regressionItems: [
        {
          id: "reg_1",
          title: "旧 onboarding 流程仍可完成",
          type: "regression",
          priority: "P0",
          rationale: "避免重构打坏老流程",
          suggestedScope: "current+p0",
          status: "pending",
          evidenceLinks: []
        }
      ],
      affectedFeatures: ["default-console"],
      affectedPaths: ["packages/console/src/App.tsx"],
      changeEvents: [],
      testRunIds: [],
      evidenceLinks: [],
      releaseStatus: "unknown",
      conversationRefs: []
    });

    expect(markdown).toContain("# Wizard refactor");
    expect(markdown).toContain("## Original User Intent");
    expect(markdown).toContain("## Acceptance Checklist");
    expect(markdown).toContain("## Regression Checklist");
  });
});
