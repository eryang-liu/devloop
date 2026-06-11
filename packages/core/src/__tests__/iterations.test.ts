import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { iterationRecordSchema } from "../iteration-types.js";
import {
  createIterationRecord,
  listIterations,
  loadIteration,
  saveIteration,
  saveIterationIndex
} from "../iterations.js";

describe("iteration persistence", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "devloop-iterations-"));
    await mkdir(join(projectRoot, ".devloop", "iterations"), { recursive: true });
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

  it("saves iteration records and keeps a sortable index", async () => {
    const iteration = createIterationRecord({
      title: "Refactor onboarding wizard",
      source: "manual",
      rawUserIntent: "重构 onboarding 向导并保留旧流程可用",
      createdAt: "2026-06-11T08:00:00.000Z"
    });

    await saveIteration(projectRoot, iteration);
    await saveIterationIndex(projectRoot, [iteration]);

    const loaded = await loadIteration(projectRoot, iteration.id);
    const listed = await listIterations(projectRoot);
    const indexRaw = await readFile(
      join(projectRoot, ".devloop", "iterations", "index.json"),
      "utf8"
    );

    expect(loaded.title).toBe("Refactor onboarding wizard");
    expect(loaded.status).toBe("active");
    expect(listed.map((item) => item.id)).toEqual([iteration.id]);
    expect(JSON.parse(indexRaw)[0].title).toBe("Refactor onboarding wizard");
  });

  it("rejects unsafe iteration ids before filesystem access", async () => {
    const iteration = createIterationRecord({
      title: "Safe title",
      source: "manual",
      rawUserIntent: "keep ids safe",
      createdAt: "2026-06-11T08:00:00.000Z"
    });

    await expect(
      saveIteration(projectRoot, {
        ...iteration,
        id: "../escape"
      })
    ).rejects.toThrow(/safe filename token|Path separators/);

    await expect(loadIteration(projectRoot, "../escape")).rejects.toThrow(
      /safe filename token|Path separators/
    );
  });

  it("lists multiple iteration records from most recent to oldest", async () => {
    const older = createIterationRecord({
      title: "Older iteration",
      source: "manual",
      rawUserIntent: "older request",
      createdAt: "2026-06-11T08:00:00.000Z"
    });
    const newer = createIterationRecord({
      title: "Newer iteration",
      source: "codex",
      rawUserIntent: "newer request",
      createdAt: "2026-06-11T09:00:00.000Z"
    });

    await saveIteration(projectRoot, older);
    await saveIteration(projectRoot, newer);
    await saveIterationIndex(projectRoot, [older, newer]);

    await expect(listIterations(projectRoot)).resolves.toMatchObject([
      { id: newer.id, updatedAt: "2026-06-11T09:00:00.000Z" },
      { id: older.id, updatedAt: "2026-06-11T08:00:00.000Z" }
    ]);

    const indexRaw = JSON.parse(
      await readFile(join(projectRoot, ".devloop", "iterations", "index.json"), "utf8")
    ) as Array<{ id: string }>;

    expect(indexRaw.map((item) => item.id)).toEqual([newer.id, older.id]);
  });

  it("rejects schema-invalid checklist buckets and non-normalized timestamps", () => {
    const iteration = createIterationRecord({
      title: "Invariant test",
      source: "manual",
      rawUserIntent: "validate schema invariants",
      createdAt: "2026-06-11T08:00:00.000Z"
    });

    expect(() =>
      iterationRecordSchema.parse({
        ...iteration,
        createdAt: "2026-06-11T08:00:00Z",
        acceptanceItems: [
          {
            id: "regression-item",
            title: "Wrong bucket",
            type: "regression"
          }
        ],
        changeEvents: [
          {
            id: "change-event",
            source: "manual",
            timestamp: "2026-06-11 08:00:00Z",
            rawRequest: "fix it",
            intentType: "new_iteration",
            confidence: 0.8
          }
        ]
      })
    ).toThrow();

    expect(() =>
      iterationRecordSchema.parse({
        ...iteration,
        regressionItems: [
          {
            id: "acceptance-item",
            title: "Wrong bucket",
            type: "acceptance"
          }
        ]
      })
    ).toThrow(/regressionItems must only contain regression-typed checklist items/);
  });

  it("rejects impossible timestamps even when they match the format regex", () => {
    const iteration = createIterationRecord({
      title: "Impossible timestamp",
      source: "manual",
      rawUserIntent: "reject impossible dates",
      createdAt: "2026-06-11T08:00:00.000Z"
    });

    expect(() =>
      iterationRecordSchema.parse({
        ...iteration,
        updatedAt: "2026-02-30T08:00:00.000Z"
      })
    ).toThrow(/Expected a real UTC ISO-8601 timestamp/);

    expect(() =>
      iterationRecordSchema.parse({
        ...iteration,
        changeEvents: [
          {
            id: "change-event",
            source: "manual",
            timestamp: "2026-13-01T08:00:00.000Z",
            rawRequest: "fix it",
            intentType: "new_iteration",
            confidence: 0.8
          }
        ]
      })
    ).toThrow(/Expected a real UTC ISO-8601 timestamp/);
  });

  it("rejects invalid non-null closedAt timestamps", () => {
    const iteration = createIterationRecord({
      title: "Closed timestamp invalid",
      source: "manual",
      rawUserIntent: "validate closedAt",
      createdAt: "2026-06-11T08:00:00.000Z"
    });

    expect(() =>
      iterationRecordSchema.parse({
        ...iteration,
        closedAt: "2026-11-31T08:00:00.000Z"
      })
    ).toThrow(/Expected a real UTC ISO-8601 timestamp/);
  });

  it("accepts a valid non-null closedAt timestamp", () => {
    const iteration = createIterationRecord({
      title: "Closed timestamp valid",
      source: "manual",
      rawUserIntent: "accept valid closedAt",
      createdAt: "2026-06-11T08:00:00.000Z"
    });

    const parsed = iterationRecordSchema.parse({
      ...iteration,
      status: "done",
      closedAt: "2026-06-11T09:30:00.000Z"
    });

    expect(parsed.closedAt).toBe("2026-06-11T09:30:00.000Z");
  });
});
