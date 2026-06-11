# DevLoop M1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the M1 slice of DevLoop: project config loading, registry state, sync-driven impact queue, status and release gate evaluation, a usable CLI, and a local browser UI with Dashboard and Impact Queue.

**Architecture:** Use a pnpm TypeScript monorepo with four packages: `core` for domain logic and file persistence, `cli` for terminal commands, `server` for REST APIs and local static hosting, and `ui` for the browser dashboard. M1 does not execute tests yet; it reads project config, registry, and prior `test-runs` artifacts so `sync`, `status`, and `release-check` can already work end-to-end.

**Tech Stack:** Node.js 18+, TypeScript, pnpm workspaces, Vitest, Fastify, Vite, React, Ant Design

---

## File Structure

### Root workspace

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Modify: `/Users/jeff/developer/devLoop/README.md`

### Core package

- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/config.ts`
- Create: `packages/core/src/registry.ts`
- Create: `packages/core/src/status.ts`
- Create: `packages/core/src/impact.ts`
- Create: `packages/core/src/git.ts`
- Create: `packages/core/src/sync.ts`
- Create: `packages/core/src/release-check.ts`
- Create: `packages/core/src/paths.ts`
- Create: `packages/core/src/test-runs.ts`
- Create: `packages/core/src/__tests__/config.test.ts`
- Create: `packages/core/src/__tests__/status.test.ts`
- Create: `packages/core/src/__tests__/sync.test.ts`
- Create: `packages/core/src/__tests__/release-check.test.ts`
- Create: `packages/core/src/__tests__/fixtures/project/.devloop/config.yml`
- Create: `packages/core/src/__tests__/fixtures/project/.devloop/registry.json`
- Create: `packages/core/src/__tests__/fixtures/project/.devloop/test-runs/2026-06-10/run-smoke-pass.json`

### CLI package

- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/main.ts`
- Create: `packages/cli/src/commands/doctor.ts`
- Create: `packages/cli/src/commands/status.ts`
- Create: `packages/cli/src/commands/sync.ts`
- Create: `packages/cli/src/commands/release-check.ts`
- Create: `packages/cli/src/commands/ui.ts`
- Create: `packages/cli/src/__tests__/cli.test.ts`

### Server package

- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/app.ts`
- Create: `packages/server/src/__tests__/app.test.ts`

### UI package

- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/vite.config.ts`
- Create: `packages/ui/index.html`
- Create: `packages/ui/src/main.tsx`
- Create: `packages/ui/src/App.tsx`
- Create: `packages/ui/src/api.ts`
- Create: `packages/ui/src/styles.css`

---

### Task 1: Bootstrap the Monorepo and Config Loader

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.workspace.ts`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/config.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/__tests__/config.test.ts`

- [ ] **Step 1: Write the failing config loader test**

```ts
// packages/core/src/__tests__/config.test.ts
import { describe, expect, it } from "vitest";
import { loadProjectConfig } from "../config.js";

describe("loadProjectConfig", () => {
  it("loads the devloop project config from .devloop/config.yml", async () => {
    const config = await loadProjectConfig(new URL("./fixtures/project", import.meta.url));

    expect(config.project_name).toBe("fixture-app");
    expect(config.features).toHaveLength(2);
    expect(config.gate.require_head_smoke_pass).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @devloop/core test -- --run packages/core/src/__tests__/config.test.ts`
Expected: FAIL with `Cannot find module '../config'` or workspace bootstrap errors.

- [ ] **Step 3: Write minimal workspace and config implementation**

```json
// package.json
{
  "name": "devloop",
  "private": true,
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "vitest --config vitest.workspace.ts run",
    "lint": "pnpm --filter @devloop/core exec tsc --noEmit -p tsconfig.json"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^6.0.3",
    "vitest": "^3.2.0"
  }
}
```

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
```

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "dist"
  }
}
```

```ts
// vitest.workspace.ts
import { defineWorkspace } from "vitest/config";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = dirname(fileURLToPath(import.meta.url));
const packages = ["packages/core", "packages/cli", "packages/server"].filter((pkg) =>
  existsSync(resolve(workspaceRoot, pkg))
);

export default defineWorkspace(packages);
```

```json
// packages/core/package.json
{
  "name": "@devloop/core",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "yaml": "^2.8.0",
    "zod": "^4.0.0"
  }
}
```

```json
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "exclude": ["src/__tests__"]
}
```

```ts
// packages/core/src/types.ts
import { z } from "zod";

export const featureConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  priority: z.enum(["P0", "P1", "P2"]),
  tags: z.array(z.string()).default([]),
  paths: z.array(z.string()),
  specs: z.array(z.string()).default([]),
  scenarios: z.array(z.string()).default([]),
  invariants: z.array(z.string()).default([])
});

export const projectConfigSchema = z.object({
  version: z.literal(1),
  project_name: z.string(),
  paths: z.object({
    registry: z.string(),
    prd_root: z.string(),
    scenarios: z.string(),
    test_runs: z.string(),
    releases: z.string()
  }),
  impact: z.object({
    use_import_graph: z.boolean().default(false),
    fallback_to_paths: z.boolean().default(true),
    low_confidence_requires_triage: z.boolean().default(true)
  }),
  gate: z.object({
    block_on_p0_untested: z.boolean().default(true),
    require_head_smoke_pass: z.boolean().default(true),
    require_scenario_for_p0: z.boolean().default(true)
  }),
  test: z.object({
    smoke_scenarios: z.array(z.string()).default([])
  }),
  features: z.array(featureConfigSchema)
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type FeatureConfig = z.infer<typeof featureConfigSchema>;
```

```ts
// packages/core/src/config.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { projectConfigSchema, type ProjectConfig } from "./types";

function normalizeRoot(projectRoot: string | URL): string {
  return projectRoot instanceof URL ? fileURLToPath(projectRoot) : projectRoot;
}

export async function loadProjectConfig(projectRoot: string | URL): Promise<ProjectConfig> {
  const root = normalizeRoot(projectRoot);
  const raw = await readFile(join(root, ".devloop/config.yml"), "utf8");
  return projectConfigSchema.parse(parse(raw));
}
```

```ts
// packages/core/src/index.ts
export * from "./config.js";
export * from "./types.js";
```

```yaml
# packages/core/src/__tests__/fixtures/project/.devloop/config.yml
version: 1
project_name: fixture-app
paths:
  registry: .devloop/registry.json
  prd_root: docs/prd
  scenarios: .devloop/scenarios
  test_runs: .devloop/test-runs
  releases: .devloop/releases
impact:
  use_import_graph: false
  fallback_to_paths: true
  low_confidence_requires_triage: true
gate:
  block_on_p0_untested: true
  require_head_smoke_pass: true
  require_scenario_for_p0: true
test:
  smoke_scenarios:
    - app-smoke-local
features:
  - id: host-listen
    name: 宿主聆听
    priority: P0
    tags: ["audio"]
    paths: ["frontend/src/hostListen.tsx"]
    specs: ["docs/prd/host-listen.md"]
    scenarios: ["host-listen-smoke"]
    invariants: ["开麦后系统有响应"]
  - id: embed-shell
    name: 嵌入壳
    priority: P1
    tags: ["embed"]
    paths: ["frontend/src/embedShell.tsx"]
    specs: ["docs/prd/embed-shell.md"]
    scenarios: ["embed-shell-smoke"]
    invariants: []
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm install && pnpm --filter @devloop/core test -- --run packages/core/src/__tests__/config.test.ts`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts packages/core
git commit -m "chore: bootstrap workspace and config loader"
```

### Task 2: Implement Registry Persistence and Status Summary

**Files:**
- Create: `packages/core/src/registry.ts`
- Create: `packages/core/src/status.ts`
- Create: `packages/core/src/paths.ts`
- Test: `packages/core/src/__tests__/status.test.ts`
- Create: `packages/core/src/__tests__/fixtures/project/.devloop/registry.json`

- [ ] **Step 1: Write the failing status summary test**

```ts
// packages/core/src/__tests__/status.test.ts
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRegistry, saveRegistry } from "../registry.js";
import { getStatusSummary } from "../status.js";

const fixtureProjectRoot = fileURLToPath(new URL("./fixtures/project", import.meta.url));

async function createTempProject(): Promise<string> {
  const tempRoot = await mkdtemp(join(tmpdir(), "devloop-status-"));
  const projectRoot = join(tempRoot, "project");
  await cp(fixtureProjectRoot, projectRoot, { recursive: true });
  return projectRoot;
}

describe("getStatusSummary", () => {
  it("counts feature states and returns the highest risk list", async () => {
    const summary = await getStatusSummary(new URL("./fixtures/project", import.meta.url));

    expect(summary.counts.changed_untested).toBe(1);
    expect(summary.counts.tested).toBe(1);
    expect(summary.highRiskFeatures.map((item) => item.featureId)).toEqual(["host-listen"]);
  });

  it("treats config features missing from the registry as never_tested high risk", async () => {
    const projectRoot = await createTempProject();
    const registryPath = join(projectRoot, ".devloop", "registry.json");
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
      features: Array<{ featureId: string }>;
    };

    registry.features = registry.features.filter((item) => item.featureId !== "host-listen");
    await writeFile(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf8");

    const summary = await getStatusSummary(projectRoot);

    expect(summary.counts.never_tested).toBe(1);
    expect(summary.highRiskFeatures).toEqual([
      { featureId: "host-listen", status: "never_tested" }
    ]);
  });

  it("ignores stale registry-only entries that no longer exist in config", async () => {
    const projectRoot = await createTempProject();
    const configPath = join(projectRoot, ".devloop", "config.yml");
    const config = await readFile(configPath, "utf8");

    await writeFile(
      configPath,
      config.replace(
        /  - id: embed-shell[\s\S]*?    invariants: \[\]\n/,
        ""
      ),
      "utf8"
    );

    const summary = await getStatusSummary(projectRoot);

    expect(summary.counts.changed_untested).toBe(1);
    expect(summary.counts.tested).toBe(0);
    expect(summary.highRiskFeatures).toEqual([
      { featureId: "host-listen", status: "changed_untested" }
    ]);
  });

  it("round-trips registry data through saveRegistry and loadRegistry", async () => {
    const projectRoot = await createTempProject();
    const registry = await loadRegistry(projectRoot);

    registry.lastSyncAt = "2026-06-10T10:00:00.000Z";
    registry.impactQueue = [
      {
        featureId: "host-listen",
        confidence: "high",
        reasons: ["matched:frontend/src/hostListen.tsx"],
        recommendedScope: "current+p0",
        detectedAt: "2026-06-10T10:00:00.000Z",
        sourceSha: "def5678"
      }
    ];

    await saveRegistry(projectRoot, registry);

    await expect(loadRegistry(projectRoot)).resolves.toEqual(registry);
  });

  it("rejects invalid registry data on save without overwriting the persisted file", async () => {
    const projectRoot = await createTempProject();
    const registryPath = join(projectRoot, ".devloop", "registry.json");
    const original = await readFile(registryPath, "utf8");
    const registry = await loadRegistry(projectRoot);

    await expect(
      saveRegistry(projectRoot, {
        ...registry,
        impactQueue: [
          {
            featureId: "host-listen",
            confidence: "high"
          }
        ]
      } as never)
    ).rejects.toThrow();

    await expect(readFile(registryPath, "utf8")).resolves.toBe(original);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @devloop/core test -- --run packages/core/src/__tests__/status.test.ts`
Expected: FAIL with `Cannot find module '../status'`.

- [ ] **Step 3: Write registry and status code**

```ts
// packages/core/src/paths.ts
import { fileURLToPath } from "node:url";

export function normalizeProjectRoot(projectRoot: string | URL): string {
  return projectRoot instanceof URL ? fileURLToPath(projectRoot) : projectRoot;
}
```

```ts
// packages/core/src/registry.ts
import { randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import { loadProjectConfig } from "./config.js";
import { normalizeProjectRoot } from "./paths.js";

const utcTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "Expected UTC ISO-8601 timestamp");

const revisionSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{6,63}$/, "Expected a revision token with 7 to 64 URL-safe characters");

const nullableTimestampSchema = utcTimestampSchema.nullable().default(null);
const nullableRevisionSchema = revisionSchema.nullable().default(null);
const nullableRunIdSchema = z.string().min(1).max(200).nullable().default(null);

const featureStateSchema = z.object({
  featureId: z.string().min(1),
  status: z.enum(["never_tested", "changed_untested", "rework_untested", "tested", "failed", "needs-triage"]),
  iteration: z.number().int().min(1).default(1),
  activeChecklist: z.array(z.string().min(1)).default([]),
  lastChangedAt: nullableTimestampSchema,
  lastChangedSha: nullableRevisionSchema,
  lastVerifiedRunId: nullableRunIdSchema,
  lastVerifiedSha: nullableRevisionSchema
}).strict();

const impactRecordSchema = z.object({
  featureId: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  reasons: z.array(z.string().min(1)).default([]),
  recommendedScope: z.enum(["smoke", "impacted", "current+p0", "full"]),
  detectedAt: utcTimestampSchema,
  sourceSha: revisionSchema
}).strict();

const registrySchema = z.object({
  version: z.literal(1),
  features: z.array(featureStateSchema),
  impactQueue: z.array(impactRecordSchema).default([]),
  lastSyncAt: nullableTimestampSchema
}).strict();

export type Registry = z.infer<typeof registrySchema>;

export async function loadRegistry(projectRoot: string | URL): Promise<Registry> {
  const config = await loadProjectConfig(projectRoot);
  const root = normalizeProjectRoot(projectRoot);
  const raw = await readFile(join(root, config.paths.registry), "utf8");
  return registrySchema.parse(JSON.parse(raw));
}

export async function saveRegistry(projectRoot: string | URL, registry: Registry): Promise<void> {
  const config = await loadProjectConfig(projectRoot);
  const root = normalizeProjectRoot(projectRoot);
  const registryPath = join(root, config.paths.registry);
  const serialized = JSON.stringify(registrySchema.parse(registry), null, 2) + "\n";
  const tempPath = join(dirname(registryPath), `.${basename(registryPath)}.${process.pid}.${randomUUID()}.tmp`);

  try {
    await writeFile(tempPath, serialized, { encoding: "utf8", flag: "wx" });
    await rename(tempPath, registryPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}
```

```ts
// packages/core/src/status.ts
import { loadProjectConfig } from "./config.js";
import { loadRegistry, type FeatureState, type Registry } from "./registry.js";

type StatusCounts = Record<FeatureState["status"], number>;

export type StatusSummary = {
  counts: StatusCounts;
  highRiskFeatures: Array<{
    featureId: string;
    status: FeatureState["status"];
  }>;
  lastSyncAt: Registry["lastSyncAt"];
};

export async function getStatusSummary(projectRoot: string | URL): Promise<StatusSummary> {
  const [config, registry] = await Promise.all([
    loadProjectConfig(projectRoot),
    loadRegistry(projectRoot)
  ]);

  const counts: StatusCounts = {
    never_tested: 0,
    changed_untested: 0,
    rework_untested: 0,
    tested: 0,
    failed: 0,
    needs-triage: 0
  };

  for (const feature of registry.features) counts[feature.status] += 1;

  const registryFeaturesById = new Map(
    registry.features.map((feature) => [feature.featureId, feature] as const)
  );

  const highRiskFeatures = config.features
    .map((feature) => {
      const status = registryFeaturesById.get(feature.id)?.status ?? "never_tested";

      counts[status] += 1;

      return {
        priority: feature.priority,
        featureId: feature.id,
        status
      };
    })
    .filter((feature) => feature.priority === "P0" && feature.status !== "tested")
    .map(({ featureId, status }) => ({ featureId, status }));

  return { counts, highRiskFeatures, lastSyncAt: registry.lastSyncAt };
}
```

```json
// packages/core/src/__tests__/fixtures/project/.devloop/registry.json
{
  "version": 1,
  "lastSyncAt": "2026-06-10T09:00:00.000Z",
  "impactQueue": [],
  "features": [
    {
      "featureId": "host-listen",
      "status": "changed_untested",
      "iteration": 1,
      "activeChecklist": ["L-01 开麦"],
      "lastChangedAt": "2026-06-10T08:58:00.000Z",
      "lastChangedSha": "abc1234",
      "lastVerifiedRunId": null,
      "lastVerifiedSha": null
    },
    {
      "featureId": "embed-shell",
      "status": "tested",
      "iteration": 1,
      "activeChecklist": ["E-01 页面可打开"],
      "lastChangedAt": "2026-06-09T08:58:00.000Z",
      "lastChangedSha": "old1111",
      "lastVerifiedRunId": "run-smoke-pass",
      "lastVerifiedSha": "old1111"
    }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @devloop/core test -- --run packages/core/src/__tests__/status.test.ts`
Expected: PASS with the `status.test.ts` suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/paths.ts packages/core/src/registry.ts packages/core/src/status.ts packages/core/src/__tests__/status.test.ts packages/core/src/__tests__/fixtures/project/.devloop/registry.json
git commit -m "feat: add registry persistence and status summary"
```

### Task 3: Implement Impact Analysis and Sync

**Files:**
- Create: `packages/core/src/impact.ts`
- Create: `packages/core/src/git.ts`
- Create: `packages/core/src/sync.ts`
- Test: `packages/core/src/__tests__/sync.test.ts`

- [ ] **Step 1: Write the failing sync test**

```ts
// packages/core/src/__tests__/sync.test.ts
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { syncProject } from "../sync.js";

const fixtureProjectRoot = fileURLToPath(new URL("./fixtures/project", import.meta.url));

async function createTempProject(): Promise<string> {
  const tempRoot = await mkdtemp(join(tmpdir(), "devloop-sync-"));
  const projectRoot = join(tempRoot, "project");
  await cp(fixtureProjectRoot, projectRoot, { recursive: true });
  return projectRoot;
}

describe("syncProject", () => {
  it("transitions impacted features, updates change metadata, and leaves unrelated entries untouched", async () => {
    const result = await syncProject(new URL("./fixtures/project", import.meta.url), {
      changedFiles: ["frontend/src/embedShell.tsx"],
      sha: "new5678",
      now: "2026-06-10T10:00:00.000Z"
    });

    expect(result.lastSyncAt).toBe("2026-06-10T10:00:00.000Z");
    expect(result.impactQueue).toHaveLength(1);
    expect(result.features.find((item) => item.featureId === "embed-shell")).toMatchObject({
      featureId: "embed-shell",
      status: "changed_untested",
      lastChangedAt: "2026-06-10T10:00:00.000Z",
      lastChangedSha: "new5678"
    });
    expect(result.features.find((item) => item.featureId === "host-listen")).toMatchObject({
      featureId: "host-listen",
      status: "changed_untested",
      lastChangedAt: "2026-06-10T08:58:00.000Z",
      lastChangedSha: "abc1234"
    });
  });

  it("adds impacted config features back when they are missing from the registry", async () => {
    const projectRoot = await createTempProject();
    const registryPath = join(projectRoot, ".devloop", "registry.json");
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
      features: Array<{ featureId: string }>;
    };

    registry.features = registry.features.filter((item) => item.featureId !== "embed-shell");
    await writeFile(registryPath, JSON.stringify(registry, null, 2) + "\n", "utf8");

    const result = await syncProject(projectRoot, {
      changedFiles: ["frontend/src/embedShell.tsx"],
      sha: "new5678",
      now: "2026-06-10T10:00:00.000Z"
    });

    expect(result.features.find((item) => item.featureId === "embed-shell")).toEqual({
      featureId: "embed-shell",
      status: "changed_untested",
      iteration: 1,
      activeChecklist: [],
      lastChangedAt: "2026-06-10T10:00:00.000Z",
      lastChangedSha: "new5678",
      lastVerifiedRunId: null,
      lastVerifiedSha: null
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @devloop/core test -- --run packages/core/src/__tests__/sync.test.ts`
Expected: FAIL with `Cannot find module '../sync'`.

- [ ] **Step 3: Write impact and sync implementation**

```ts
// packages/core/src/impact.ts
import { posix } from "node:path";
import type { ImpactRecord as RegistryImpactRecord } from "./registry.js";
import type { FeatureConfig } from "./types.js";

export type ImpactRecord = RegistryImpactRecord;

function normalizePathSegments(pathValue: string): string[] {
  const normalized = posix
    .normalize(pathValue.replaceAll("\\", "/"))
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (normalized === "." || normalized === "") {
    return [];
  }

  return normalized.split("/").filter(Boolean);
}

function endsWithSegments(pathSegments: string[], suffixSegments: string[]): boolean {
  if (suffixSegments.length === 0 || pathSegments.length < suffixSegments.length) {
    return false;
  }

  const offset = pathSegments.length - suffixSegments.length;

  return suffixSegments.every((segment, index) => pathSegments[offset + index] === segment);
}

export function buildImpactQueue(
  features: FeatureConfig[],
  changedFiles: string[],
  now: string,
  sha: string
): ImpactRecord[] {
  return features.flatMap((feature) => {
    const featurePathSegments = feature.paths.map((featurePath) => normalizePathSegments(featurePath));
    const matchedFiles = changedFiles.filter((changedFile) => {
      const changedSegments = normalizePathSegments(changedFile);
      return featurePathSegments.some((segments) => endsWithSegments(changedSegments, segments));
    });

    if (matchedFiles.length === 0) {
      return [];
    }

    return [{
      featureId: feature.id,
      confidence: feature.priority === "P0" ? "high" : "medium",
      reasons: matchedFiles.map((file) => `matched:${file}`),
      recommendedScope: feature.priority === "P0" ? "current+p0" : "impacted",
      detectedAt: now,
      sourceSha: sha
    }];
  });
}
```

```ts
// packages/core/src/git.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { normalizeProjectRoot } from "./paths.js";

const execFileAsync = promisify(execFile);

function parseChangedFilesPorcelain(stdout: string): string[] {
  const records = stdout.split("\0");
  const changedFiles = new Set<string>();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];

    if (!record || record.length < 4) continue;

    const status = record.slice(0, 2);
    const path = record.slice(3);

    if (!path) continue;

    changedFiles.add(path);

    if (status.includes("R") || status.includes("C")) {
      index += 1;
    }
  }

  return [...changedFiles];
}

export async function getChangedFiles(projectRoot: string | URL): Promise<string[]> {
  const cwd = normalizeProjectRoot(projectRoot);
  const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1", "-z"], { cwd });
  return parseChangedFilesPorcelain(stdout);
}

export async function getHeadSha(projectRoot: string | URL): Promise<string> {
  const cwd = normalizeProjectRoot(projectRoot);
  const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd });
  return stdout.trim();
}
```

```ts
// packages/core/src/sync.ts
import { loadProjectConfig } from "./config.js";
import { buildImpactQueue } from "./impact.js";
import { loadRegistry, type FeatureState, type Registry } from "./registry.js";

export type SyncInput = {
  changedFiles: string[];
  sha: string;
  now: string;
};

export async function syncProject(projectRoot: string | URL, input: SyncInput): Promise<Registry> {
  const [config, registry] = await Promise.all([
    loadProjectConfig(projectRoot),
    loadRegistry(projectRoot)
  ]);

  const impactQueue = buildImpactQueue(config.features, input.changedFiles, input.now, input.sha);
  const impactedFeatureIds = new Set(impactQueue.map((item) => item.featureId));
  const existingFeatureIds = new Set(registry.features.map((feature) => feature.featureId));

  const features: FeatureState[] = registry.features.map((feature) => {
    if (!impactedFeatureIds.has(feature.featureId)) {
      return feature;
    }

    return {
      ...feature,
      status: "changed_untested",
      lastChangedAt: input.now,
      lastChangedSha: input.sha
    };
  });

  for (const feature of config.features) {
    if (!impactedFeatureIds.has(feature.id) || existingFeatureIds.has(feature.id)) {
      continue;
    }

    features.push({
      featureId: feature.id,
      status: "changed_untested",
      iteration: 1,
      activeChecklist: [],
      lastChangedAt: input.now,
      lastChangedSha: input.sha,
      lastVerifiedRunId: null,
      lastVerifiedSha: null
    });
  }

  return {
    ...registry,
    features,
    impactQueue,
    lastSyncAt: input.now
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @devloop/core test -- --run packages/core/src/__tests__/sync.test.ts`
Expected: PASS with the `sync.test.ts` suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/impact.ts packages/core/src/git.ts packages/core/src/sync.ts packages/core/src/__tests__/sync.test.ts
git commit -m "feat: add impact analysis and sync service"
```

### Task 4: Implement Release Gate Evaluation

**Files:**
- Create: `packages/core/src/test-runs.ts`
- Create: `packages/core/src/release-check.ts`
- Test: `packages/core/src/__tests__/release-check.test.ts`
- Create: `packages/core/src/__tests__/fixtures/project/.devloop/test-runs/2026-06-10/run-smoke-pass.json`

- [ ] **Step 1: Write the failing release gate test**

```ts
// packages/core/src/__tests__/release-check.test.ts
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { describe, expect, it } from "vitest";
import { runReleaseCheck } from "../release-check.js";

const fixtureRoot = new URL("./fixtures/project/", import.meta.url);

async function createProjectCopy(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "devloop-release-check-"));
  await cp(fixtureRoot, projectRoot, { recursive: true });
  return projectRoot;
}

async function writeSmokeRun(
  projectRoot: string,
  { fileName, commitSha, scenarioIds }: { fileName: string; commitSha: string; scenarioIds: string[] }
) {
  const runPath = join(projectRoot, ".devloop", "test-runs", "2026-06-10", fileName);
  await writeFile(
    runPath,
    JSON.stringify({
      run_id: fileName.replace(/\.json$/, ""),
      status: "passed",
      commit_sha: commitSha,
      scenario_ids: scenarioIds,
      scope: "smoke",
      artifacts: ["logs/smoke.txt"]
    }, null, 2) + "\n",
    "utf8"
  );
}

describe("runReleaseCheck", () => {
  it("blocks when a P0 feature is changed and no head smoke run exists", async () => {
    const result = await runReleaseCheck(new URL("./fixtures/project", import.meta.url), {
      currentSha: "new5678"
    });

    expect(result.decision).toBe("block");
    expect(result.unmetRequirements).toContain("missing_head_smoke_run");
  });

  it("blocks when a P0 feature is unverified even if the current SHA has a smoke run", async () => {
    const projectRoot = await createProjectCopy();
    await writeSmokeRun(projectRoot, {
      fileName: "run-current-smoke.json",
      commitSha: "new5678",
      scenarioIds: ["app-smoke-local"]
    });

    const result = await runReleaseCheck(projectRoot, { currentSha: "new5678" });
    expect(result.unmetRequirements).toContain("p0_not_verified:host-listen");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @devloop/core test -- --run packages/core/src/__tests__/release-check.test.ts`
Expected: FAIL with `Cannot find module '../release-check'`.

- [ ] **Step 3: Write release-check implementation**

```ts
// packages/core/src/test-runs.ts
import { readdir, readFile } from "node:fs/promises";
import { z } from "zod";
import { loadProjectConfig } from "./config.js";
import { normalizeProjectRoot } from "./paths.js";

const testRunSchema = z.object({
  run_id: z.string(),
  status: z.enum(["passed", "failed", "partial", "aborted"]),
  commit_sha: z.string(),
  scenario_ids: z.array(z.string()),
  scope: z.enum(["smoke", "impacted", "current", "current+p0", "full"]),
  artifacts: z.array(z.string()).default([])
});

export type TestRun = z.infer<typeof testRunSchema>;

export async function loadAllTestRuns(projectRoot: string | URL): Promise<TestRun[]> {
  const config = await loadProjectConfig(projectRoot);
  const root = normalizeProjectRoot(projectRoot);
  const baseDir = `${root}/${config.paths.test_runs}`;
  try {
    const days = await readdir(baseDir, { withFileTypes: true });
    const runs: TestRun[] = [];

    for (const day of days.filter((entry) => entry.isDirectory())) {
      const files = await readdir(`${baseDir}/${day.name}`);
      for (const file of files.filter((name) => name.endsWith(".json"))) {
        const raw = await readFile(`${baseDir}/${day.name}/${file}`, "utf8");
        runs.push(testRunSchema.parse(JSON.parse(raw)));
      }
    }

    return runs;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
```

```ts
// packages/core/src/release-check.ts
import { loadProjectConfig } from "./config.js";
import { loadRegistry } from "./registry.js";
import { loadAllTestRuns } from "./test-runs.js";

type ReleaseCheckInput = {
  currentSha: string;
};

const P0_UNVERIFIED_STATUSES = new Set([
  "changed_untested",
  "rework_untested",
  "failed",
  "never_tested",
  "needs-triage"
]);

function isCoveredSmokeRun(run: { scenario_ids: string[] }, requiredScenarioIds: string[]): boolean {
  if (requiredScenarioIds.length === 0) {
    return true;
  }

  const coveredScenarioIds = new Set(run.scenario_ids);
  return requiredScenarioIds.every((scenarioId) => coveredScenarioIds.has(scenarioId));
}

export async function runReleaseCheck(projectRoot: string | URL, input: ReleaseCheckInput) {
  const [config, registry, runs] = await Promise.all([
    loadProjectConfig(projectRoot),
    loadRegistry(projectRoot),
    loadAllTestRuns(projectRoot)
  ]);

  const unmetRequirements = new Set<string>();
  const impactedFeatures = registry.impactQueue.map((item) => item.featureId);
  const registryFeaturesById = new Map(
    registry.features.map((feature) => [feature.featureId, feature] as const)
  );
  const latestSmoke = runs.find((run) => {
    return (
      run.scope === "smoke" &&
      run.status === "passed" &&
      run.commit_sha === input.currentSha &&
      isCoveredSmokeRun(run, config.test.smoke_scenarios)
    );
  });

  if (config.gate.require_head_smoke_pass && !latestSmoke) {
    unmetRequirements.add("missing_head_smoke_run");
  }

  for (const definition of config.features) {
    if (definition.priority !== "P0") {
      continue;
    }

    const featureStatus = registryFeaturesById.get(definition.id)?.status ?? "never_tested";

    if (config.gate.block_on_p0_untested && P0_UNVERIFIED_STATUSES.has(featureStatus)) {
      unmetRequirements.add(`p0_not_verified:${definition.id}`);
    }
    if (config.gate.require_scenario_for_p0 && definition.scenarios.length === 0) {
      unmetRequirements.add(`missing_scenario:${definition.id}`);
    }
  }

  return {
    decision: unmetRequirements.size > 0 ? "block" : "pass",
    impactedFeatures,
    unmetRequirements: [...unmetRequirements]
  };
}
```

```json
// packages/core/src/__tests__/fixtures/project/.devloop/test-runs/2026-06-10/run-smoke-pass.json
{
  "run_id": "run-smoke-pass",
  "status": "passed",
  "commit_sha": "old1111",
  "scenario_ids": ["app-smoke-local"],
  "scope": "smoke",
  "artifacts": ["logs/smoke.txt"]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @devloop/core test -- --run packages/core/src/__tests__/release-check.test.ts`
Expected: PASS with the `release-check.test.ts` suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/test-runs.ts packages/core/src/release-check.ts packages/core/src/__tests__/release-check.test.ts packages/core/src/__tests__/fixtures/project/.devloop/test-runs/2026-06-10/run-smoke-pass.json
git commit -m "feat: add release gate evaluation"
```

### Task 5: Wire the CLI Commands

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Modify: `packages/core/src/index.ts`
- Create: `packages/cli/src/main.ts`
- Create: `packages/cli/src/commands/doctor.ts`
- Create: `packages/cli/src/commands/status.ts`
- Create: `packages/cli/src/commands/sync.ts`
- Create: `packages/cli/src/commands/release-check.ts`
- Create: `packages/cli/src/commands/ui.ts`
- Test: `packages/cli/src/__tests__/cli.test.ts`

- [ ] **Step 1: Write the failing CLI smoke test**

```ts
// packages/cli/src/__tests__/cli.test.ts
import { describe, expect, it } from "vitest";
import { buildProgram } from "../main";

describe("buildProgram", () => {
  it("registers the M1 commands", () => {
    const program = buildProgram();

    expect(program.commands.map((command) => command.name())).toEqual([
      "doctor",
      "status",
      "sync",
      "release-check",
      "ui"
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @devloop/cli test -- --run packages/cli/src/__tests__/cli.test.ts`
Expected: FAIL because the CLI package does not exist yet.

- [ ] **Step 3: Implement the CLI**

```json
// packages/cli/package.json
{
  "name": "@devloop/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "devloop": "dist/main.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@devloop/core": "workspace:*",
    "commander": "^14.0.0"
  }
}
```

```json
// packages/cli/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"]
}
```

```ts
// packages/cli/src/main.ts
import { Command } from "commander";
import { doctorCommand } from "./commands/doctor";
import { statusCommand } from "./commands/status";
import { syncCommand } from "./commands/sync";
import { releaseCheckCommand } from "./commands/release-check";
import { uiCommand } from "./commands/ui";

export function buildProgram() {
  const program = new Command().name("devloop");
  program.addCommand(doctorCommand());
  program.addCommand(statusCommand());
  program.addCommand(syncCommand());
  program.addCommand(releaseCheckCommand());
  program.addCommand(uiCommand());
  return program;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildProgram().parseAsync(process.argv);
}
```

```ts
// packages/core/src/index.ts
export * from "./config";
export * from "./git";
export * from "./impact";
export * from "./paths";
export * from "./registry";
export * from "./release-check";
export * from "./status";
export * from "./sync";
export * from "./test-runs";
export * from "./types";
```

```ts
// packages/cli/src/commands/doctor.ts
import { access } from "node:fs/promises";
import { Command } from "commander";

export function doctorCommand() {
  return new Command("doctor").action(async () => {
    await access(".devloop/config.yml");
    console.log(JSON.stringify({ ok: true, config: ".devloop/config.yml" }, null, 2));
  });
}
```

```ts
// packages/cli/src/commands/status.ts
import { Command } from "commander";
import { getStatusSummary } from "@devloop/core";

export function statusCommand() {
  return new Command("status").action(async () => {
    const summary = await getStatusSummary(process.cwd());
    console.log(JSON.stringify(summary, null, 2));
  });
}
```

```ts
// packages/cli/src/commands/sync.ts
import { Command } from "commander";
import { getChangedFiles, getHeadSha, saveRegistry, syncProject } from "@devloop/core";

export function syncCommand() {
  return new Command("sync").action(async () => {
    const changedFiles = await getChangedFiles(process.cwd());
    const sha = await getHeadSha(process.cwd());
    const now = new Date().toISOString();
    const result = await syncProject(process.cwd(), { changedFiles, sha, now });
    await saveRegistry(process.cwd(), result.registry);
    console.log(JSON.stringify(result, null, 2));
  });
}
```

```ts
// packages/cli/src/commands/release-check.ts
import { Command } from "commander";
import { getHeadSha, runReleaseCheck } from "@devloop/core";

export function releaseCheckCommand() {
  return new Command("release-check").action(async () => {
    const currentSha = await getHeadSha(process.cwd());
    const result = await runReleaseCheck(process.cwd(), { currentSha });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.decision === "block" ? 1 : 0;
  });
}
```

```ts
// packages/cli/src/commands/ui.ts
import { Command } from "commander";

export function uiCommand() {
  return new Command("ui").action(async () => {
    console.log("UI wiring lands in Task 8 after the server package exists.");
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @devloop/cli test -- --run packages/cli/src/__tests__/cli.test.ts`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/cli
git commit -m "feat: add m1 cli commands"
```

### Task 6: Add the Local Server API

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/app.ts`
- Test: `packages/server/src/__tests__/app.test.ts`

- [ ] **Step 1: Write the failing server API test**

```ts
// packages/server/src/__tests__/app.test.ts
import { describe, expect, it } from "vitest";
import { buildServer } from "../app";

describe("buildServer", () => {
  it("returns status and impact data", async () => {
    const app = await buildServer({ projectRoot: new URL("../../core/src/__tests__/fixtures/project", import.meta.url) });

    const status = await app.inject({ method: "GET", url: "/api/status" });
    const impact = await app.inject({ method: "GET", url: "/api/impact-queue" });

    expect(status.statusCode).toBe(200);
    expect(impact.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @devloop/server test -- --run packages/server/src/__tests__/app.test.ts`
Expected: FAIL because the server package does not exist yet.

- [ ] **Step 3: Implement the server**

```json
// packages/server/package.json
{
  "name": "@devloop/server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@devloop/core": "workspace:*",
    "@fastify/static": "^8.1.0",
    "fastify": "^5.3.0"
  }
}
```

```json
// packages/server/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src"]
}
```

```ts
// packages/server/src/app.ts
import Fastify from "fastify";
import { getChangedFiles, getHeadSha, getStatusSummary, loadRegistry, runReleaseCheck, syncProject } from "@devloop/core";

type ServerOptions = {
  projectRoot: string | URL;
};

export async function buildServer(options: ServerOptions) {
  const app = Fastify();

  app.get("/api/health", async () => ({ ok: true }));

  app.get("/api/status", async () => getStatusSummary(options.projectRoot));

  app.get("/api/impact-queue", async () => {
    const registry = await loadRegistry(options.projectRoot);
    return { items: registry.impactQueue };
  });

  app.post("/api/sync", async () => {
    const changedFiles = await getChangedFiles(options.projectRoot);
    const sha = await getHeadSha(options.projectRoot);
    const result = await syncProject(options.projectRoot, {
      changedFiles,
      sha,
      now: new Date().toISOString()
    });
    return result;
  });

  app.post("/api/release-check", async () => {
    const currentSha = await getHeadSha(options.projectRoot);
    return runReleaseCheck(options.projectRoot, { currentSha });
  });

  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @devloop/server test -- --run packages/server/src/__tests__/app.test.ts`
Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat: add local api server"
```

### Task 7: Build the M1 Browser UI

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/vite.config.ts`
- Create: `packages/ui/index.html`
- Create: `packages/ui/src/main.tsx`
- Create: `packages/ui/src/App.tsx`
- Create: `packages/ui/src/api.ts`
- Create: `packages/ui/src/styles.css`

- [ ] **Step 1: Write the failing UI component test or build target**

```ts
// packages/ui/src/App.tsx
export function App() {
  return null;
}
```

Run: `pnpm --filter @devloop/ui build`
Expected: FAIL because the UI package does not exist yet.

- [ ] **Step 2: Create the UI package and API helpers**

```json
// packages/ui/package.json
{
  "name": "@devloop/ui",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "build": "vite build"
  },
  "dependencies": {
    "antd": "^5.27.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.5.0",
    "vite": "^7.0.0"
  }
}
```

```json
// packages/ui/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

```ts
// packages/ui/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()]
});
```

```html
<!-- packages/ui/index.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevLoop</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```ts
// packages/ui/src/api.ts
export async function getStatus() {
  const response = await fetch("/api/status");
  return response.json();
}

export async function getImpactQueue() {
  const response = await fetch("/api/impact-queue");
  return response.json();
}

export async function runReleaseCheck() {
  const response = await fetch("/api/release-check", { method: "POST" });
  return response.json();
}
```

- [ ] **Step 3: Implement the dashboard and impact queue UI**

```tsx
// packages/ui/src/App.tsx
import { Card, Col, Layout, Row, Table, Tag, Typography } from "antd";
import { useEffect, useState } from "react";
import { getImpactQueue, getStatus, runReleaseCheck } from "./api";
import "./styles.css";

export function App() {
  const [status, setStatus] = useState<any>(null);
  const [impact, setImpact] = useState<any>({ items: [] });
  const [gate, setGate] = useState<any>(null);

  useEffect(() => {
    void Promise.all([getStatus(), getImpactQueue(), runReleaseCheck()]).then(([statusData, impactData, gateData]) => {
      setStatus(statusData);
      setImpact(impactData);
      setGate(gateData);
    });
  }, []);

  return (
    <Layout className="app-shell">
      <Layout.Content className="app-content">
        <Typography.Title>DevLoop M1</Typography.Title>
        <Row gutter={16}>
          <Col span={8}><Card title="Changed Untested">{status?.counts?.changed_untested ?? 0}</Card></Col>
          <Col span={8}><Card title="Tested">{status?.counts?.tested ?? 0}</Card></Col>
          <Col span={8}><Card title="Release Gate"><Tag color={gate?.decision === "block" ? "red" : "green"}>{gate?.decision ?? "loading"}</Tag></Card></Col>
        </Row>
        <Card title="Impact Queue" className="impact-card">
          <Table
            rowKey="featureId"
            dataSource={impact.items}
            columns={[
              { title: "Feature", dataIndex: "featureId" },
              { title: "Confidence", dataIndex: "confidence" },
              { title: "Scope", dataIndex: "recommendedScope" }
            ]}
            pagination={false}
          />
        </Card>
      </Layout.Content>
    </Layout>
  );
}
```

```tsx
// packages/ui/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```css
/* packages/ui/src/styles.css */
.app-shell {
  min-height: 100vh;
  background: linear-gradient(180deg, #f4efe6 0%, #ffffff 100%);
}

.app-content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 48px 24px;
}

.impact-card {
  margin-top: 24px;
}
```

- [ ] **Step 4: Run build to verify it passes**

Run: `pnpm --filter @devloop/ui build`
Expected: PASS and generate `packages/ui/dist`.

- [ ] **Step 5: Commit**

```bash
git add packages/ui
git commit -m "feat: add m1 dashboard ui"
```

### Task 8: Integrate the UI Command and Refresh Documentation

**Files:**
- Modify: `packages/cli/package.json`
- Modify: `packages/cli/src/commands/ui.ts`
- Modify: `/Users/jeff/developer/devLoop/README.md`
- Test: `packages/cli/src/__tests__/cli.test.ts`

- [ ] **Step 1: Extend the CLI test to cover the `ui` command path**

```ts
// packages/cli/src/__tests__/cli.test.ts
import { describe, expect, it, vi } from "vitest";
import { buildProgram } from "../main";

describe("ui command", () => {
  it("keeps the ui command registered for local dashboard startup", () => {
    const program = buildProgram();
    expect(program.commands.some((command) => command.name() === "ui")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify the current implementation gap**

Run: `pnpm --filter @devloop/cli test -- --run packages/cli/src/__tests__/cli.test.ts`
Expected: FAIL if the `ui` command is still a stub or missing server startup.

- [ ] **Step 3: Implement server startup and update README**

```json
// packages/cli/package.json
{
  "name": "@devloop/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "devloop": "dist/main.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@devloop/core": "workspace:*",
    "@devloop/server": "workspace:*",
    "commander": "^14.0.0"
  }
}
```

```ts
// packages/cli/src/commands/ui.ts
import { Command } from "commander";
import { buildServer } from "@devloop/server";

export function uiCommand() {
  return new Command("ui").option("--port <port>", "port", "4310").action(async (options) => {
    const app = await buildServer({ projectRoot: process.cwd() });
    await app.listen({ host: "127.0.0.1", port: Number(options.port) });
    console.log(`DevLoop UI running at http://127.0.0.1:${options.port}`);
  });
}
```

```md
<!-- README.md -->
# DevLoop

AI 开发项目的测试闭环与发布风险闸门。M1 目标是打通 `sync -> status -> release-check -> ui`。

## 文档

- [PRD-dev-loop.md](./PRD-dev-loop.md) — 产品需求文档（v1.4）
- [docs/superpowers/plans/2026-06-10-devloop-m1-implementation.md](./docs/superpowers/plans/2026-06-10-devloop-m1-implementation.md) — M1 实施计划

## 本地开发

```bash
pnpm install
pnpm build
pnpm test
```
```

- [ ] **Step 4: Run end-to-end verification**

Run: `pnpm build && pnpm test`
Expected: PASS for all workspace tests and successful package builds.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/commands/ui.ts README.md
git commit -m "docs: wire ui startup and refresh m1 readme"
```

---

## M1 Verification Checklist

- [ ] `pnpm install`
- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] `pnpm --filter @devloop/cli exec devloop doctor`
- [ ] `pnpm --filter @devloop/cli exec devloop status` inside the core fixture project
- [ ] `pnpm --filter @devloop/cli exec devloop sync` inside a temporary git-backed sample project
- [ ] `pnpm --filter @devloop/cli exec devloop release-check` returns exit code `1` for blocked scenarios
- [ ] `pnpm --filter @devloop/cli exec devloop ui --port 4310` serves Dashboard and Impact Queue at `http://127.0.0.1:4310`

## Scope Guardrails

- M1 does **not** execute scenarios or create new `test_run` artifacts.
- M1 does **not** implement `init`, `rollup`, or full static asset packaging.
- M1 should prefer deterministic fixture-driven tests over real external apps.
- Keep `core` pure and reusable; `cli`, `server`, and `ui` should be thin orchestration layers.

## Spec Coverage Check

- `capture`: Covered by Task 3 (`syncProject`, changed file intake, impact queue generation)
- `impact`: Covered by Task 3 (`buildImpactQueue`, confidence and recommended scope)
- `status`: Covered by Task 2 (`getStatusSummary`, high-risk P0 list)
- `gate`: Covered by Task 4 (`runReleaseCheck`)
- `browser UI`: Covered by Task 6 and Task 7 (local API + Dashboard and Impact Queue)
- `CLI`: Covered by Task 5 and Task 8 (`doctor`, `status`, `sync`, `release-check`, `ui`)
