import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { captureRequirement } from "../capture.js";

describe("captureRequirement", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "devloop-capture-"));
    await mkdir(join(projectRoot, ".devloop"), { recursive: true });
    await writeFile(
      join(projectRoot, ".devloop", "config.yml"),
      [
        "version: 1",
        "project_name: demo",
        "paths:",
        "  registry: .devloop/registry.json",
        "  prd_root: docs/prd",
        "  scenarios: .devloop/scenarios",
        "  test_runs: .devloop/test-runs",
        "  releases: .devloop/releases",
        "impact:",
        "  use_import_graph: false",
        "  fallback_to_paths: true",
        "  low_confidence_requires_triage: true",
        "gate:",
        "  block_on_p0_untested: true",
        "  require_head_smoke_pass: true",
        "  require_scenario_for_p0: true",
        "  strict_snapshot: false",
        "test:",
        "  smoke_scenarios: []",
        "features: []"
      ].join("\n"),
      "utf8"
    );
  });

  it("creates a new PRD and later reopens it for a related follow-up patch", async () => {
    const first = await captureRequirement(projectRoot, {
      source: "manual",
      rawRequest: "重构 onboarding 向导",
      title: "Onboarding wizard refactor",
      timestamp: "2026-06-11T08:00:00.000Z"
    });

    const reopened = await captureRequirement(projectRoot, {
      source: "manual",
      rawRequest: "顺手修一下这个向导改动导致的旧流程回归",
      timestamp: "2026-06-11T10:00:00.000Z",
      suggestedIterationId: first.iteration.id,
      intentType: "reopen_iteration",
      confidence: 0.94
    });

    const prdMarkdown = await readFile(reopened.prdPath, "utf8");

    expect(first.iteration.status).toBe("active");
    expect(reopened.iteration.id).toBe(first.iteration.id);
    expect(reopened.iteration.status).toBe("reopened");
    expect(reopened.iteration.regressionItems.length).toBeGreaterThan(0);
    expect(reopened.iteration.changeEvents.at(-1)?.intentType).toBe("reopen_iteration");
    expect(reopened.prdPath.endsWith(".md")).toBe(true);
    expect(prdMarkdown).toContain("## Regression Checklist");
  });

  it("surfaces corrupted iteration records instead of silently starting fresh", async () => {
    await mkdir(join(projectRoot, ".devloop", "iterations"), { recursive: true });
    await writeFile(
      join(projectRoot, ".devloop", "iterations", "broken.json"),
      "{ not-valid-json",
      "utf8"
    );

    await expect(
      captureRequirement(projectRoot, {
        source: "manual",
        rawRequest: "继续补充需求",
        timestamp: "2026-06-11T11:00:00.000Z"
      })
    ).rejects.toThrow();
  });
});
