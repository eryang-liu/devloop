# DevLoop Iteration-First PRD-Driven Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild DevLoop around iteration PRDs so requirement capture, acceptance items, regression items, evidence, and release gating are driven by user intent rather than only changed files.

**Architecture:** Keep the current CLI, server, console, dashboard, test-run persistence, and release-check foundation, but add a new iteration data model as the product primary key. First implement generic requirement capture and PRD generation in `core`, then expose it through CLI and APIs, then pivot the console and dashboard UX to iteration-centric flows, and finally integrate release gating and hook adapters.

**Tech Stack:** TypeScript monorepo, pnpm, Node.js, Fastify, React, Vitest, existing DevLoop core persistence under `.devloop/`

---

## File Structure

### New core files

- `packages/core/src/iteration-types.ts`
  Defines iteration schemas, checklist item schemas, change-event schemas, and normalized adapter event schemas.
- `packages/core/src/iterations.ts`
  Loads, saves, indexes, lists, reopens, and updates iteration machine records under `.devloop/iterations/`.
- `packages/core/src/prd.ts`
  Generates and merges human-readable PRD markdown projections from machine iteration records.
- `packages/core/src/capture.ts`
  Owns generic requirement capture flow, grouping logic, reopen logic, checklist generation orchestration, and PRD write-back.
- `packages/core/src/release-iterations.ts`
  Computes requirement-first release gate inputs from active or release-bound iterations.

### New core tests

- `packages/core/src/__tests__/iterations.test.ts`
- `packages/core/src/__tests__/capture.test.ts`
- `packages/core/src/__tests__/prd.test.ts`
- `packages/core/src/__tests__/release-iterations.test.ts`

### Core files to modify

- `packages/core/src/types.ts`
- `packages/core/src/config.ts`
- `packages/core/src/paths.ts`
- `packages/core/src/index.ts`
- `packages/core/src/release-check.ts`
- `packages/core/src/status.ts`

### New CLI files

- `packages/cli/src/commands/capture.ts`
- `packages/cli/src/commands/iteration.ts`

### CLI files to modify

- `packages/cli/src/main.ts`
- `packages/cli/src/__tests__/cli.test.ts`

### Server files to modify

- `packages/server/src/app.ts`
- `packages/server/src/console-app.ts`
- `packages/server/src/console-actions.ts`
- `packages/server/src/__tests__/app.test.ts`
- `packages/server/src/__tests__/console-app.test.ts`

### Console files to modify

- `packages/console/src/App.tsx`
- `packages/console/src/api.ts`
- `packages/console/src/styles.css`
- `packages/console/src/__tests__/app.test.tsx`

### Dashboard files to modify

- `packages/ui/src/App.tsx`
- `packages/ui/src/api.ts`
- `packages/ui/src/styles.css`
- `packages/ui/src/__tests__/app.test.tsx`

### Docs to modify

- `README.md`
- `.devloop/config.yml`

### New hook adapter scaffolding

- `packages/core/src/adapters.ts`
- `packages/core/src/__tests__/adapters.test.ts`

---

### Task 1: Add Iteration Persistence And Schemas

**Files:**
- Create: `packages/core/src/iteration-types.ts`
- Create: `packages/core/src/iterations.ts`
- Test: `packages/core/src/__tests__/iterations.test.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing iteration persistence test**

```ts
// packages/core/src/__tests__/iterations.test.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
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
      ].join("\n")
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx -y pnpm@10.0.0 --filter @devloop/core test -- --run packages/core/src/__tests__/iterations.test.ts`

Expected: FAIL with module-not-found errors for `iterations.ts` exports.

- [ ] **Step 3: Write minimal iteration schemas and persistence**

```ts
// packages/core/src/iteration-types.ts
import { z } from "zod";

export const iterationStatusSchema = z.enum([
  "active",
  "paused",
  "done",
  "reopened",
  "archived"
]);

export const iterationSourceSchema = z.enum(["manual", "codex", "cursor", "claude-code"]);

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(["acceptance", "regression"]),
  priority: z.enum(["P0", "P1", "P2"]).default("P1"),
  rationale: z.string().default(""),
  suggestedScope: z.enum(["smoke", "impacted", "current+p0", "full"]).default("impacted"),
  status: z.enum(["pending", "in_progress", "verified", "failed", "waived"]).default("pending"),
  evidenceLinks: z.array(z.string()).default([])
});

export const changeEventSchema = z.object({
  id: z.string().min(1),
  source: iterationSourceSchema,
  timestamp: z.string().min(1),
  rawRequest: z.string().min(1),
  contextSummary: z.string().default(""),
  intentType: z.enum([
    "new_iteration",
    "iteration_extension",
    "regression_fix",
    "reopen_iteration",
    "uncertain"
  ]),
  confidence: z.number().min(0).max(1),
  conversationId: z.string().nullable().default(null)
});

export const iterationRecordSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  status: iterationStatusSchema,
  source: iterationSourceSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  closedAt: z.string().nullable().default(null),
  reopenedFrom: z.string().nullable().default(null),
  rawUserIntent: z.string().min(1),
  goal: z.string().default(""),
  nonGoals: z.array(z.string()).default([]),
  acceptanceItems: z.array(checklistItemSchema).default([]),
  regressionItems: z.array(checklistItemSchema).default([]),
  affectedFeatures: z.array(z.string()).default([]),
  affectedPaths: z.array(z.string()).default([]),
  changeEvents: z.array(changeEventSchema).default([]),
  testRunIds: z.array(z.string()).default([]),
  evidenceLinks: z.array(z.string()).default([]),
  releaseStatus: z.enum(["unknown", "pass", "warn", "block"]).default("unknown"),
  conversationRefs: z.array(z.string()).default([])
});

export type IterationRecord = z.infer<typeof iterationRecordSchema>;
```

```ts
// packages/core/src/iterations.ts
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { loadProjectConfig } from "./config.js";
import { normalizeProjectRoot } from "./paths.js";
import { iterationRecordSchema, type IterationRecord } from "./iteration-types.js";

export function createIterationRecord(input: {
  title: string;
  source: IterationRecord["source"];
  rawUserIntent: string;
  createdAt: string;
}): IterationRecord {
  const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return {
    id: `iter_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
    slug: slug || "iteration",
    title: input.title,
    status: "active",
    source: input.source,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    closedAt: null,
    reopenedFrom: null,
    rawUserIntent: input.rawUserIntent,
    goal: "",
    nonGoals: [],
    acceptanceItems: [],
    regressionItems: [],
    affectedFeatures: [],
    affectedPaths: [],
    changeEvents: [],
    testRunIds: [],
    evidenceLinks: [],
    releaseStatus: "unknown",
    conversationRefs: []
  };
}

async function getIterationsDir(projectRoot: string | URL) {
  const config = await loadProjectConfig(projectRoot);
  const root = normalizeProjectRoot(projectRoot);
  return join(root, dirname(config.paths.registry), "iterations");
}

export async function saveIteration(projectRoot: string | URL, iteration: IterationRecord) {
  const dir = await getIterationsDir(projectRoot);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${iteration.id}.json`);
  const tempPath = join(dir, `.${basename(filePath)}.${process.pid}.tmp`);
  await writeFile(tempPath, JSON.stringify(iterationRecordSchema.parse(iteration), null, 2) + "\n", "utf8");
  await rename(tempPath, filePath);
  await rm(tempPath, { force: true });
}

export async function loadIteration(projectRoot: string | URL, iterationId: string) {
  const dir = await getIterationsDir(projectRoot);
  const raw = await readFile(join(dir, `${iterationId}.json`), "utf8");
  return iterationRecordSchema.parse(JSON.parse(raw));
}

export async function saveIterationIndex(projectRoot: string | URL, iterations: IterationRecord[]) {
  const dir = await getIterationsDir(projectRoot);
  await mkdir(dir, { recursive: true });
  const indexPath = join(dir, "index.json");
  const payload = iterations
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      status: item.status,
      updatedAt: item.updatedAt,
      source: item.source
    }));
  await writeFile(indexPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

export async function listIterations(projectRoot: string | URL) {
  const dir = await getIterationsDir(projectRoot);
  const files = (await readdir(dir)).filter((name) => name.endsWith(".json") && name !== "index.json");
  const records = await Promise.all(files.map((name) => loadIteration(projectRoot, name.replace(/\.json$/, ""))));
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
```

- [ ] **Step 4: Export the new iteration API**

```ts
// packages/core/src/index.ts
export {
  createIterationRecord,
  listIterations,
  loadIteration,
  saveIteration,
  saveIterationIndex
} from "./iterations.js";
export { changeEventSchema, checklistItemSchema, iterationRecordSchema } from "./iteration-types.js";
export type { IterationRecord } from "./iteration-types.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx -y pnpm@10.0.0 --filter @devloop/core test -- --run packages/core/src/__tests__/iterations.test.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/iteration-types.ts packages/core/src/iterations.ts packages/core/src/index.ts packages/core/src/__tests__/iterations.test.ts
git commit -m "feat: add iteration persistence model"
```

### Task 2: Add Generic Requirement Capture And PRD Generation

**Files:**
- Create: `packages/core/src/prd.ts`
- Create: `packages/core/src/capture.ts`
- Test: `packages/core/src/__tests__/prd.test.ts`
- Test: `packages/core/src/__tests__/capture.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write the failing PRD projection test**

```ts
// packages/core/src/__tests__/prd.test.ts
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
```

- [ ] **Step 2: Write the failing capture grouping test**

```ts
// packages/core/src/__tests__/capture.test.ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
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
      ].join("\n")
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

    expect(first.iteration.status).toBe("active");
    expect(reopened.iteration.id).toBe(first.iteration.id);
    expect(reopened.iteration.status).toBe("reopened");
    expect(reopened.iteration.regressionItems.length).toBeGreaterThan(0);
    expect(reopened.prdPath.endsWith(".md")).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx -y pnpm@10.0.0 --filter @devloop/core test -- --run packages/core/src/__tests__/prd.test.ts packages/core/src/__tests__/capture.test.ts`

Expected: FAIL with missing module exports for `prd.ts` and `capture.ts`.

- [ ] **Step 4: Write minimal PRD renderer**

```ts
// packages/core/src/prd.ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { loadProjectConfig } from "./config.js";
import type { IterationRecord } from "./iteration-types.js";
import { normalizeProjectRoot } from "./paths.js";

export function renderIterationPrd(iteration: IterationRecord): string {
  const acceptanceLines = iteration.acceptanceItems.map((item) => `- [ ] ${item.title}`);
  const regressionLines = iteration.regressionItems.map((item) => `- [ ] ${item.title}`);

  return [
    `# ${iteration.title}`,
    "",
    `- Iteration ID: \`${iteration.id}\``,
    `- Status: \`${iteration.status}\``,
    `- Source: \`${iteration.source}\``,
    `- Created At: \`${iteration.createdAt}\``,
    `- Updated At: \`${iteration.updatedAt}\``,
    "",
    "## Original User Intent",
    "",
    iteration.rawUserIntent,
    "",
    "## Goal",
    "",
    iteration.goal || "_Pending AI summary_",
    "",
    "## Non-Goals",
    "",
    ...(iteration.nonGoals.length ? iteration.nonGoals.map((item) => `- ${item}`) : ["- None recorded"]),
    "",
    "## Affected Areas",
    "",
    ...(iteration.affectedPaths.length ? iteration.affectedPaths.map((item) => `- ${item}`) : ["- None recorded"]),
    "",
    "## Acceptance Checklist",
    "",
    ...(acceptanceLines.length ? acceptanceLines : ["- [ ] Pending checklist generation"]),
    "",
    "## Regression Checklist",
    "",
    ...(regressionLines.length ? regressionLines : ["- [ ] Pending regression generation"]),
    ""
  ].join("\n");
}

export async function writeIterationPrd(projectRoot: string | URL, iteration: IterationRecord) {
  const config = await loadProjectConfig(projectRoot);
  const root = normalizeProjectRoot(projectRoot);
  const datePrefix = iteration.createdAt.slice(0, 10);
  const prdPath = join(root, config.paths.prd_root, datePrefix, `${iteration.slug}.md`);
  await mkdir(dirname(prdPath), { recursive: true });
  await writeFile(prdPath, renderIterationPrd(iteration), "utf8");
  return prdPath;
}
```

- [ ] **Step 5: Write minimal capture service**

```ts
// packages/core/src/capture.ts
import { createIterationRecord, listIterations, saveIteration, saveIterationIndex } from "./iterations.js";
import type { IterationRecord } from "./iteration-types.js";
import { writeIterationPrd } from "./prd.js";

export async function captureRequirement(
  projectRoot: string | URL,
  input: {
    source: IterationRecord["source"];
    rawRequest: string;
    timestamp: string;
    title?: string;
    suggestedIterationId?: string;
    intentType?: "new_iteration" | "iteration_extension" | "regression_fix" | "reopen_iteration" | "uncertain";
    confidence?: number;
  }
) {
  const existing = await listIterations(projectRoot).catch(() => []);
  let iteration =
    input.suggestedIterationId && existing.find((item) => item.id === input.suggestedIterationId)
      ? existing.find((item) => item.id === input.suggestedIterationId)!
      : createIterationRecord({
          title: input.title ?? input.rawRequest.slice(0, 48),
          source: input.source,
          rawUserIntent: input.rawRequest,
          createdAt: input.timestamp
        });

  const intentType = input.intentType ?? "new_iteration";
  const confidence = input.confidence ?? (intentType === "new_iteration" ? 1 : 0.8);

  if (intentType === "reopen_iteration" && iteration.status !== "active") {
    iteration = {
      ...iteration,
      status: "reopened",
      updatedAt: input.timestamp,
      regressionItems: [
        ...iteration.regressionItems,
        {
          id: `reg_${iteration.regressionItems.length + 1}`,
          title: input.rawRequest,
          type: "regression",
          priority: "P1",
          rationale: "Captured from follow-up reopened requirement",
          suggestedScope: "current+p0",
          status: "pending",
          evidenceLinks: []
        }
      ]
    };
  } else {
    iteration = {
      ...iteration,
      updatedAt: input.timestamp,
      goal: iteration.goal || input.rawRequest,
      acceptanceItems:
        iteration.acceptanceItems.length > 0
          ? iteration.acceptanceItems
          : [
              {
                id: "acc_1",
                title: input.title ?? input.rawRequest.slice(0, 48),
                type: "acceptance",
                priority: "P0",
                rationale: "Initial generated acceptance item",
                suggestedScope: "smoke",
                status: "pending",
                evidenceLinks: []
              }
            ],
      changeEvents: [
        ...iteration.changeEvents,
        {
          id: `evt_${iteration.changeEvents.length + 1}`,
          source: input.source,
          timestamp: input.timestamp,
          rawRequest: input.rawRequest,
          contextSummary: "",
          intentType,
          confidence,
          conversationId: null
        }
      ]
    };
  }

  await saveIteration(projectRoot, iteration);
  const merged = [iteration, ...existing.filter((item) => item.id !== iteration.id)];
  await saveIterationIndex(projectRoot, merged);
  const prdPath = await writeIterationPrd(projectRoot, iteration);

  return { iteration, prdPath };
}
```

- [ ] **Step 6: Export capture and PRD helpers**

```ts
// packages/core/src/index.ts
export { captureRequirement } from "./capture.js";
export { renderIterationPrd, writeIterationPrd } from "./prd.js";
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx -y pnpm@10.0.0 --filter @devloop/core test -- --run packages/core/src/__tests__/prd.test.ts packages/core/src/__tests__/capture.test.ts`

Expected: PASS with `2 passed`.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/prd.ts packages/core/src/capture.ts packages/core/src/index.ts packages/core/src/__tests__/prd.test.ts packages/core/src/__tests__/capture.test.ts
git commit -m "feat: add generic requirement capture and PRD generation"
```

### Task 3: Expose Iteration Capture Through The CLI

**Files:**
- Create: `packages/cli/src/commands/capture.ts`
- Create: `packages/cli/src/commands/iteration.ts`
- Modify: `packages/cli/src/main.ts`
- Test: `packages/cli/src/__tests__/cli.test.ts`

- [ ] **Step 1: Write failing CLI tests for capture and iteration list**

```ts
// packages/cli/src/__tests__/cli.test.ts
it("captures a requirement and prints the new PRD path", async () => {
  vi.doMock("@devloop/core", () => ({
    captureRequirement: vi.fn().mockResolvedValue({
      iteration: { id: "iter_001", title: "Wizard refactor", status: "active" },
      prdPath: "/tmp/project/docs/prd/2026-06-11/wizard-refactor.md"
    })
  }));

  const exitCode = await runCli([
    "node",
    "devloop",
    "capture",
    "--title",
    "Wizard refactor",
    "--text",
    "重构向导并补回归项"
  ]);

  expect(exitCode).toBe(0);
  expect(logSpy).toHaveBeenCalledWith(
    JSON.stringify(
      {
        iterationId: "iter_001",
        title: "Wizard refactor",
        status: "active",
        prdPath: "/tmp/project/docs/prd/2026-06-11/wizard-refactor.md"
      },
      null,
      2
    )
  );
});

it("lists iterations from most recent to oldest", async () => {
  vi.doMock("@devloop/core", () => ({
    listIterations: vi.fn().mockResolvedValue([
      { id: "iter_002", title: "B", status: "reopened", updatedAt: "2026-06-11T10:00:00.000Z" },
      { id: "iter_001", title: "A", status: "done", updatedAt: "2026-06-11T08:00:00.000Z" }
    ])
  }));

  const exitCode = await runCli(["node", "devloop", "iteration", "list"]);

  expect(exitCode).toBe(0);
  expect(logSpy).toHaveBeenCalledWith(
    JSON.stringify(
      [
        { id: "iter_002", title: "B", status: "reopened", updatedAt: "2026-06-11T10:00:00.000Z" },
        { id: "iter_001", title: "A", status: "done", updatedAt: "2026-06-11T08:00:00.000Z" }
      ],
      null,
      2
    )
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx -y pnpm@10.0.0 --filter @devloop/cli test -- --run packages/cli/src/__tests__/cli.test.ts`

Expected: FAIL because the `capture` and `iteration` commands do not exist.

- [ ] **Step 3: Add the capture command**

```ts
// packages/cli/src/commands/capture.ts
import { captureRequirement } from "@devloop/core";
import { Command } from "commander";

export function captureCommand(): Command {
  return new Command("capture")
    .description("Capture a requirement iteration and generate or update its PRD.")
    .requiredOption("--text <text>", "Raw user requirement text.")
    .option("--title <title>", "Optional requirement title.")
    .option("--source <source>", "Capture source.", "manual")
    .action(async (options) => {
      const result = await captureRequirement(process.cwd(), {
        source: options.source,
        rawRequest: options.text,
        title: options.title,
        timestamp: new Date().toISOString()
      });

      console.log(
        JSON.stringify(
          {
            iterationId: result.iteration.id,
            title: result.iteration.title,
            status: result.iteration.status,
            prdPath: result.prdPath
          },
          null,
          2
        )
      );
    });
}
```

- [ ] **Step 4: Add the iteration command group**

```ts
// packages/cli/src/commands/iteration.ts
import { listIterations, loadIteration } from "@devloop/core";
import { Command } from "commander";

export function iterationCommand(): Command {
  const command = new Command("iteration").description("Inspect captured DevLoop iterations.");

  command
    .command("list")
    .description("List captured iterations.")
    .action(async () => {
      console.log(JSON.stringify(await listIterations(process.cwd()), null, 2));
    });

  command
    .command("show")
    .argument("<iteration-id>", "Iteration id")
    .description("Show one iteration machine record.")
    .action(async (iterationId: string) => {
      console.log(JSON.stringify(await loadIteration(process.cwd(), iterationId), null, 2));
    });

  return command;
}
```

- [ ] **Step 5: Register the new commands**

```ts
// packages/cli/src/main.ts
import { captureCommand } from "./commands/capture.js";
import { iterationCommand } from "./commands/iteration.js";

program.addCommand(captureCommand());
program.addCommand(iterationCommand());
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx -y pnpm@10.0.0 --filter @devloop/cli test -- --run packages/cli/src/__tests__/cli.test.ts`

Expected: PASS with the CLI suite green.

- [ ] **Step 7: Commit**

```bash
git add packages/cli/src/commands/capture.ts packages/cli/src/commands/iteration.ts packages/cli/src/main.ts packages/cli/src/__tests__/cli.test.ts
git commit -m "feat: expose iteration capture commands"
```

### Task 4: Add Iteration APIs To The Local Server

**Files:**
- Modify: `packages/server/src/app.ts`
- Test: `packages/server/src/__tests__/app.test.ts`

- [ ] **Step 1: Write failing API tests for iteration listing and capture**

```ts
// packages/server/src/__tests__/app.test.ts
it("lists iterations through the API", async () => {
  vi.mocked(core.listIterations).mockResolvedValue([
    { id: "iter_001", title: "Wizard refactor", status: "active", updatedAt: "2026-06-11T08:00:00.000Z" }
  ] as never);

  const app = await buildServer({ projectRoot: "/tmp/project" });
  const response = await app.inject({ method: "GET", url: "/api/iterations" });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    items: [{ id: "iter_001", title: "Wizard refactor", status: "active", updatedAt: "2026-06-11T08:00:00.000Z" }]
  });
});

it("captures a new iteration through the API", async () => {
  vi.mocked(core.captureRequirement).mockResolvedValue({
    iteration: { id: "iter_001", title: "Wizard refactor", status: "active" },
    prdPath: "/tmp/project/docs/prd/2026-06-11/wizard-refactor.md"
  } as never);

  const app = await buildServer({ projectRoot: "/tmp/project" });
  const response = await app.inject({
    method: "POST",
    url: "/api/iterations/capture",
    payload: {
      source: "manual",
      rawRequest: "重构向导"
    }
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    iteration: { id: "iter_001", title: "Wizard refactor", status: "active" },
    prdPath: "/tmp/project/docs/prd/2026-06-11/wizard-refactor.md"
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx -y pnpm@10.0.0 --filter @devloop/server test -- --run packages/server/src/__tests__/app.test.ts`

Expected: FAIL because the iteration routes do not exist.

- [ ] **Step 3: Add iteration routes**

```ts
// packages/server/src/app.ts
import {
  captureRequirement,
  getStatusSummary,
  listIterations,
  loadIteration,
  loadRegistry,
  loadRecentTestRuns,
  runReleaseCheck,
  saveRegistry,
  syncProject
} from "@devloop/core";

app.get("/api/iterations", async () => ({
  items: await listIterations(options.projectRoot)
}));

app.get("/api/iterations/:iterationId", async (request) => {
  const params = request.params as { iterationId: string };
  return loadIteration(options.projectRoot, params.iterationId);
});

app.post("/api/iterations/capture", async (request) => {
  const body = request.body as {
    source?: "manual" | "codex" | "cursor" | "claude-code";
    rawRequest: string;
    title?: string;
    suggestedIterationId?: string;
    intentType?: "new_iteration" | "iteration_extension" | "regression_fix" | "reopen_iteration" | "uncertain";
    confidence?: number;
  };

  return captureRequirement(options.projectRoot, {
    source: body.source ?? "manual",
    rawRequest: body.rawRequest,
    title: body.title,
    suggestedIterationId: body.suggestedIterationId,
    intentType: body.intentType,
    confidence: body.confidence,
    timestamp: new Date().toISOString()
  });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx -y pnpm@10.0.0 --filter @devloop/server test -- --run packages/server/src/__tests__/app.test.ts`

Expected: PASS with the API suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/app.ts packages/server/src/__tests__/app.test.ts
git commit -m "feat: add iteration capture APIs"
```

### Task 5: Make The Default Console Iteration-Centric

**Files:**
- Modify: `packages/console/src/api.ts`
- Modify: `packages/console/src/App.tsx`
- Modify: `packages/console/src/styles.css`
- Test: `packages/console/src/__tests__/app.test.tsx`

- [ ] **Step 1: Write failing console test for active iteration capture**

```tsx
// packages/console/src/__tests__/app.test.tsx
vi.mock("../api.js", () => ({
  runAction: vi.fn(),
  runWorkflow: vi.fn(),
  captureIteration: vi.fn(),
  listIterations: vi.fn().mockResolvedValue([
    { id: "iter_001", title: "Wizard refactor", status: "active", updatedAt: "2026-06-11T08:00:00.000Z" }
  ])
}));

it("shows the active iteration and captures a requirement from the console", async () => {
  vi.mocked(captureIteration).mockResolvedValue({
    iteration: { id: "iter_002", title: "Add locale capture", status: "active" },
    prdPath: "/tmp/project/docs/prd/2026-06-11/add-locale-capture.md"
  });

  const user = userEvent.setup();
  render(<App />);

  expect(await screen.findByText("Wizard refactor")).toBeTruthy();

  await user.type(screen.getByLabelText("Requirement input"), "补一个需求自动生成 PRD 的入口");
  await user.click(screen.getByRole("button", { name: "Capture requirement" }));

  expect(await screen.findByText("Add locale capture")).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx -y pnpm@10.0.0 --filter @devloop/console test -- --run packages/console/src/__tests__/app.test.tsx`

Expected: FAIL because the console has no iteration API or capture form.

- [ ] **Step 3: Add iteration API helpers**

```ts
// packages/console/src/api.ts
export type IterationSummary = {
  id: string;
  title: string;
  status: "active" | "paused" | "done" | "reopened" | "archived";
  updatedAt: string;
};

export async function listIterations() {
  const response = await fetch("/api/iterations");
  const data = (await response.json()) as { items: IterationSummary[] };
  return data.items;
}

export async function captureIteration(input: { title?: string; rawRequest: string }) {
  const response = await fetch("/api/iterations/capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source: "manual", title: input.title, rawRequest: input.rawRequest })
  });

  if (!response.ok) {
    throw new Error(`Capture failed with ${response.status}`);
  }

  return response.json() as Promise<{
    iteration: { id: string; title: string; status: string };
    prdPath: string;
  }>;
}
```

- [ ] **Step 4: Add a lightweight active iteration rail and capture composer**

```tsx
// packages/console/src/App.tsx
const [iterations, setIterations] = useState<IterationSummary[]>([]);
const [requirementDraft, setRequirementDraft] = useState("");

useEffect(() => {
  void listIterations().then(setIterations).catch(() => setIterations([]));
}, []);

async function handleCaptureRequirement() {
  if (!requirementDraft.trim()) {
    return;
  }

  const result = await captureIteration({ rawRequest: requirementDraft.trim() });
  setIterations((current) => [
    {
      id: result.iteration.id,
      title: result.iteration.title,
      status: result.iteration.status as IterationSummary["status"],
      updatedAt: new Date().toISOString()
    },
    ...current.filter((item) => item.id !== result.iteration.id)
  ]);
  setRequirementDraft("");
}

<section className="panel">
  <div className="panel__header">
    <span className="panel__eyebrow">Current iterations</span>
    <h2>Requirement workspace</h2>
  </div>
  <label className="composer">
    <span>Requirement input</span>
    <textarea value={requirementDraft} onChange={(event) => setRequirementDraft(event.target.value)} />
  </label>
  <button type="button" onClick={() => void handleCaptureRequirement()}>
    Capture requirement
  </button>
  <div className="iteration-list">
    {iterations.map((item) => (
      <article key={item.id} className="iteration-card">
        <strong>{item.title}</strong>
        <span>{item.status}</span>
      </article>
    ))}
  </div>
</section>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx -y pnpm@10.0.0 --filter @devloop/console test -- --run packages/console/src/__tests__/app.test.tsx`

Expected: PASS with the console suite green.

- [ ] **Step 6: Commit**

```bash
git add packages/console/src/api.ts packages/console/src/App.tsx packages/console/src/styles.css packages/console/src/__tests__/app.test.tsx
git commit -m "feat: pivot console to active iterations"
```

### Task 6: Make The Dashboard Show Iteration Verification Progress

**Files:**
- Modify: `packages/ui/src/api.ts`
- Modify: `packages/ui/src/App.tsx`
- Modify: `packages/ui/src/styles.css`
- Test: `packages/ui/src/__tests__/app.test.tsx`

- [ ] **Step 1: Write failing dashboard test for iteration-first panels**

```tsx
// packages/ui/src/__tests__/app.test.tsx
vi.mock("../api.js", () => ({
  getDashboardData: vi.fn().mockResolvedValue({
    status: {
      counts: {
        never_tested: 0,
        changed_untested: 1,
        rework_untested: 0,
        tested: 4,
        failed: 0,
        "needs-triage": 0
      },
      highRiskFeatures: [],
      lastSyncAt: "2026-06-11T10:00:00.000Z",
      vcs: {
        mode: "snapshot",
        gitRoot: null,
        headSha: null,
        projectId: "proj_demo",
        upgradedFromSnapshotAt: null
      }
    },
    queue: [],
    runs: [],
    release: {
      decision: "warn",
      mode: "snapshot",
      impactedFeatures: [],
      unmetRequirements: ["iteration_pending:iter_001"],
      notes: []
    },
    iterations: [
      {
        id: "iter_001",
        title: "Wizard refactor",
        status: "reopened",
        acceptancePending: 2,
        regressionPending: 1
      }
    ]
  })
}));

it("shows active iterations and requirement verification counts", async () => {
  render(<App />);

  expect(await screen.findByText("Wizard refactor")).toBeTruthy();
  expect(screen.getByText("2 acceptance pending")).toBeTruthy();
  expect(screen.getByText("1 regression pending")).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx -y pnpm@10.0.0 --filter @devloop/ui test -- --run packages/ui/src/__tests__/app.test.tsx`

Expected: FAIL because the dashboard data model has no iteration section.

- [ ] **Step 3: Extend dashboard API types**

```ts
// packages/ui/src/api.ts
export type IterationOverview = {
  id: string;
  title: string;
  status: "active" | "paused" | "done" | "reopened" | "archived";
  acceptancePending: number;
  regressionPending: number;
};

export type DashboardData = {
  status: StatusSummary;
  queue: ImpactRecord[];
  runs: TestRun[];
  release: ReleaseCheckResult;
  iterations: IterationOverview[];
};
```

- [ ] **Step 4: Render an iteration overview panel**

```tsx
// packages/ui/src/App.tsx
<article className="panel">
  <div className="panel__header">
    <div>
      <span className="panel-label">Active iterations</span>
      <h2>Requirement verification</h2>
    </div>
  </div>
  <div className="watchlist">
    {snapshot.iterations.map((iteration) => (
      <div key={iteration.id} className="watchlist__item">
        <div>
          <strong>{iteration.title}</strong>
          <p>
            {iteration.acceptancePending} acceptance pending · {iteration.regressionPending} regression pending
          </p>
        </div>
        <Tag>{iteration.status}</Tag>
      </div>
    ))}
  </div>
</article>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx -y pnpm@10.0.0 --filter @devloop/ui test -- --run packages/ui/src/__tests__/app.test.tsx`

Expected: PASS with the dashboard suite green.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/api.ts packages/ui/src/App.tsx packages/ui/src/styles.css packages/ui/src/__tests__/app.test.tsx
git commit -m "feat: show iteration verification in dashboard"
```

### Task 7: Make Release Gate Read Iteration Completion

**Files:**
- Create: `packages/core/src/release-iterations.ts`
- Test: `packages/core/src/__tests__/release-iterations.test.ts`
- Modify: `packages/core/src/release-check.ts`
- Modify: `packages/core/src/__tests__/release-check.test.ts`

- [ ] **Step 1: Write failing release-iterations test**

```ts
// packages/core/src/__tests__/release-iterations.test.ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx -y pnpm@10.0.0 --filter @devloop/core test -- --run packages/core/src/__tests__/release-iterations.test.ts`

Expected: FAIL with missing module exports.

- [ ] **Step 3: Write minimal iteration release evaluator**

```ts
// packages/core/src/release-iterations.ts
import type { IterationRecord } from "./iteration-types.js";

export function evaluateIterationReleaseStatus(iterations: IterationRecord[]) {
  const unmetRequirements = iterations.flatMap((iteration) => {
    const pendingAcceptance = iteration.acceptanceItems.some((item) => item.status !== "verified" && item.status !== "waived");
    const pendingRegression = iteration.regressionItems.some((item) => item.status !== "verified" && item.status !== "waived");

    return pendingAcceptance || pendingRegression ? [`iteration_pending:${iteration.id}`] : [];
  });

  return {
    decision: unmetRequirements.length > 0 ? "block" : "pass",
    unmetRequirements
  } as const;
}
```

- [ ] **Step 4: Integrate iteration signals into release-check**

```ts
// packages/core/src/release-check.ts
import { listIterations } from "./iterations.js";
import { evaluateIterationReleaseStatus } from "./release-iterations.js";

const iterations = await listIterations(projectRoot).catch(() => []);
const relevantIterations = iterations.filter((item) => item.status === "active" || item.status === "reopened");
const iterationGate = evaluateIterationReleaseStatus(relevantIterations);

if (iterationGate.unmetRequirements.length > 0) {
  blockingRequirements = new Set([...blockingRequirements, ...iterationGate.unmetRequirements]);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx -y pnpm@10.0.0 --filter @devloop/core test -- --run packages/core/src/__tests__/release-iterations.test.ts packages/core/src/__tests__/release-check.test.ts`

Expected: PASS with both suites green.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/release-iterations.ts packages/core/src/release-check.ts packages/core/src/__tests__/release-iterations.test.ts packages/core/src/__tests__/release-check.test.ts
git commit -m "feat: gate releases with iteration completion"
```

### Task 8: Add Normalized Adapter Scaffolding For Codex, Cursor, And Claude Code

**Files:**
- Create: `packages/core/src/adapters.ts`
- Test: `packages/core/src/__tests__/adapters.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `README.md`

- [ ] **Step 1: Write failing adapter normalization test**

```ts
// packages/core/src/__tests__/adapters.test.ts
import { describe, expect, it } from "vitest";
import { normalizeAdapterEvent } from "../adapters.js";

describe("normalizeAdapterEvent", () => {
  it("normalizes Codex, Cursor, and Claude Code payloads into one capture model", () => {
    expect(
      normalizeAdapterEvent("codex", {
        conversationId: "conv_1",
        userMessage: "新增一个需求自动生成 PRD 的入口"
      })
    ).toMatchObject({
      source: "codex",
      conversationId: "conv_1",
      rawRequest: "新增一个需求自动生成 PRD 的入口"
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx -y pnpm@10.0.0 --filter @devloop/core test -- --run packages/core/src/__tests__/adapters.test.ts`

Expected: FAIL because the adapter module does not exist.

- [ ] **Step 3: Add adapter normalization scaffolding**

```ts
// packages/core/src/adapters.ts
export function normalizeAdapterEvent(
  source: "codex" | "cursor" | "claude-code",
  payload: Record<string, unknown>
) {
  if (source === "codex") {
    return {
      source,
      conversationId: String(payload.conversationId ?? ""),
      rawRequest: String(payload.userMessage ?? ""),
      contextSummary: String(payload.contextSummary ?? "")
    };
  }

  if (source === "cursor") {
    return {
      source,
      conversationId: String(payload.conversationId ?? ""),
      rawRequest: String(payload.prompt ?? ""),
      contextSummary: String(payload.contextSummary ?? "")
    };
  }

  return {
    source,
    conversationId: String(payload.conversationId ?? ""),
    rawRequest: String(payload.userPrompt ?? ""),
    contextSummary: String(payload.contextSummary ?? "")
  };
}
```

- [ ] **Step 4: Export adapter helpers and document phased adapter support**

```ts
// packages/core/src/index.ts
export { normalizeAdapterEvent } from "./adapters.js";
```

```md
<!-- README.md -->
- `devloop capture` is the stable generic requirement capture entry.
- Codex, Cursor, and Claude Code hook adapters normalize into the same iteration capture model.
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx -y pnpm@10.0.0 --filter @devloop/core test -- --run packages/core/src/__tests__/adapters.test.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/adapters.ts packages/core/src/index.ts packages/core/src/__tests__/adapters.test.ts README.md
git commit -m "feat: add normalized adapter scaffolding"
```

### Task 9: Full Verification And Docs Refresh

**Files:**
- Modify: `README.md`
- Modify: `.devloop/config.yml`

- [ ] **Step 1: Update project docs for iteration-first usage**

```md
<!-- README.md -->
## Requirement-first workflow

```bash
devloop capture --title "Wizard refactor" --text "重构 onboarding 向导并补回归验证"
devloop iteration list
devloop
devloop ui --port 4310
```

- Iteration PRDs are generated under `docs/prd/YYYY-MM-DD/`
- Machine iteration truth is stored under `.devloop/iterations/`
- Acceptance and regression items drive testing and release gating
```

- [ ] **Step 2: Add an example iteration-aware config comment**

```yml
# .devloop/config.yml
paths:
  prd_root: docs/prd
  registry: .devloop/registry.json
  scenarios: .devloop/scenarios
  test_runs: .devloop/test-runs
  releases: .devloop/releases
# Iteration machine data is stored under .devloop/iterations/
```

- [ ] **Step 3: Run the full workspace test suite**

Run: `npx -y pnpm@10.0.0 test`

Expected: PASS with all workspace suites green.

- [ ] **Step 4: Run the full workspace build**

Run: `npx -y pnpm@10.0.0 build`

Expected: PASS with all workspace packages built successfully.

- [ ] **Step 5: Run a manual capture smoke**

Run: `node packages/cli/dist/main.js capture --title "Requirement capture smoke" --text "验证迭代 PRD 自动生成"` 

Expected: JSON output containing `iterationId`, `status`, and a `prdPath` ending in `.md`.

- [ ] **Step 6: Run the console and dashboard smoke**

Run: `node packages/cli/dist/main.js`
Expected: terminal prints `DevLoop console available at http://127.0.0.1:4301`

Run: `node packages/cli/dist/main.js ui --port 4310`
Expected: terminal prints `DevLoop UI available at http://127.0.0.1:4310`

- [ ] **Step 7: Commit**

```bash
git add README.md .devloop/config.yml
git commit -m "docs: explain iteration-first workflow"
```
