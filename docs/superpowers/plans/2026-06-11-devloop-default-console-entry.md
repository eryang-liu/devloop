# DevLoop Default Console Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `devloop` open a visual control console by default while preserving explicit CLI subcommands and keeping `devloop ui` available as a launchable dashboard from inside the console.

**Architecture:** Add a new console frontend package and a console-serving API surface instead of overloading the existing dashboard package. Route bare `devloop` invocations to the console launch path, keep `--help` and subcommands intact, and add backend-owned action/workflow execution so the browser triggers tested DevLoop capabilities instead of constructing shell commands.

**Tech Stack:** TypeScript, Commander, Fastify, Vitest, React, Vite, Ant Design

---

## File Structure Map

### New files

- `packages/console/package.json`
  - Dedicated frontend package for the default control console.
- `packages/console/tsconfig.json`
  - TypeScript config aligned with the existing frontend package.
- `packages/console/index.html`
  - Console shell entry document.
- `packages/console/vite.config.ts`
  - Build config for the control console.
- `packages/console/src/main.tsx`
  - React bootstrap for the control console.
- `packages/console/src/App.tsx`
  - Main console surface: actions, workflows, results, help.
- `packages/console/src/api.ts`
  - Browser API client for console actions/workflows/help data.
- `packages/console/src/styles.css`
  - Console-specific visual styling.
- `packages/server/src/console-app.ts`
  - Fastify app builder dedicated to the new console.
- `packages/server/src/console-types.ts`
  - Shared server-side action/workflow result schemas.
- `packages/server/src/console-actions.ts`
  - Single-step action execution handlers.
- `packages/server/src/console-workflows.ts`
  - Sequential workflow orchestration.
- `packages/server/src/dashboard-runtime.ts`
  - Singleton helper to launch and reuse the existing dashboard server.
- `packages/server/src/__tests__/console-app.test.ts`
  - Route tests for the new console API surface.
- `packages/console/src/__tests__/app.test.tsx`
  - UI tests for actions, workflows, help, and logs.

### Modified files

- `packages/cli/package.json`
  - Copy both dashboard and console build outputs into the CLI bundle.
- `packages/cli/src/main.ts`
  - Launch console on bare `devloop`, preserve help behavior.
- `packages/cli/src/__tests__/cli.test.ts`
  - Cover bare command routing and preserved help behavior.
- `packages/cli/src/commands/ui.ts`
  - Reuse shared dashboard launch helper instead of owning runtime logic.
- `packages/server/package.json`
  - Export new console app entry points if needed.
- `packages/server/src/app.ts`
  - Keep existing dashboard server focused on `devloop ui`.
- `packages/server/src/__tests__/app.test.ts`
  - Keep dashboard tests green after runtime extraction.
- `README.md`
  - Update default usage path from `devloop ui` to bare `devloop`.

### Optional follow-up file

- `packages/cli/src/commands/run-scenario.ts`
  - Only if a new `console-smoke` scenario is added in this implementation.

---

### Task 1: Create the console package and bundle pipeline

**Files:**
- Create: `packages/console/package.json`
- Create: `packages/console/tsconfig.json`
- Create: `packages/console/index.html`
- Create: `packages/console/vite.config.ts`
- Create: `packages/console/src/main.tsx`
- Modify: `packages/cli/package.json`
- Test: `npx -y pnpm@10.0.0 build`

- [ ] **Step 1: Add the failing build expectation**

Document the intended bundle copy targets in the CLI package:

```json
{
  "files": ["dist"],
  "bin": {
    "devloop": "dist/main.js"
  }
}
```

Expected new behavior after implementation:
- CLI build copies `../ui/dist` to `dist/ui`
- CLI build copies `../console/dist` to `dist/console`

- [ ] **Step 2: Run the current build to confirm the console bundle does not exist yet**

Run:

```bash
npx -y pnpm@10.0.0 build
```

Expected before implementation:
- workspace build passes without any `packages/console` output
- CLI bundle contains dashboard assets only

- [ ] **Step 3: Create the new console frontend package skeleton**

Use the same dependency family as `packages/ui`:

```json
{
  "name": "@devloop/console",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node ./node_modules/vite/bin/vite.js --configLoader runner",
    "build": "node ./node_modules/vite/bin/vite.js build --configLoader runner",
    "preview": "node ./node_modules/vite/bin/vite.js preview --configLoader runner",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "antd": "^5.28.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^5.1.0",
    "vite": "^7.2.0"
  }
}
```

Bootstrap with a minimal placeholder app:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";

function Placeholder() {
  return <main>DevLoop control console</main>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Placeholder />
  </React.StrictMode>
);
```

- [ ] **Step 4: Update the CLI build script to bundle both frontends**

Adjust `packages/cli/package.json` build script to copy both outputs:

```json
{
  "scripts": {
    "build": "node --input-type=module -e \"import { rm } from 'node:fs/promises'; await rm('dist', { recursive: true, force: true });\" && tsc -p tsconfig.json && node --input-type=module -e \"import { cp } from 'node:fs/promises'; await cp('../ui/dist', 'dist/ui', { recursive: true }); await cp('../console/dist', 'dist/console', { recursive: true });\""
  }
}
```

- [ ] **Step 5: Re-run the build and verify both asset trees are produced**

Run:

```bash
npx -y pnpm@10.0.0 build
```

Expected after implementation:
- `packages/console/dist` exists
- `packages/cli/dist/console` exists
- existing `packages/cli/dist/ui` remains intact

- [ ] **Step 6: Commit the packaging slice**

```bash
git add packages/console packages/cli/package.json
git commit -m "feat: scaffold default console frontend bundle"
```

### Task 2: Route bare `devloop` invocations to the console while preserving help

**Files:**
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/cli/src/__tests__/cli.test.ts`
- Possibly create: `packages/cli/src/commands/console.ts`
- Test: `packages/cli/src/__tests__/cli.test.ts`

- [ ] **Step 1: Write failing CLI tests for bare command and help preservation**

Add tests that express the new routing contract:

```ts
it("launches the console when devloop runs without a subcommand", async () => {
  const launchConsole = vi.fn().mockResolvedValue(undefined);
  vi.doMock("./commands/console.js", () => ({ launchConsole }));

  const { runCli } = await importCli();
  const exitCode = await runCli(["node", "devloop"]);

  expect(exitCode).toBe(0);
  expect(launchConsole).toHaveBeenCalledWith({ projectRoot: originalCwd });
});

it("preserves help output for devloop --help", async () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const { runCli } = await importCli();

  const exitCode = await runCli(["node", "devloop", "--help"]);

  expect(exitCode).toBe(0);
  expect(logSpy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused CLI tests and verify the bare command case fails first**

Run:

```bash
npx -y pnpm@10.0.0 test packages/cli/src/__tests__/cli.test.ts
```

Expected before implementation:
- new bare command test fails because no console launch path exists
- existing command tests still pass

- [ ] **Step 3: Add a dedicated console launch helper**

If a helper module is created, keep it tiny and explicit:

```ts
export async function launchConsole(input: { projectRoot: string }) {
  // Build server with bundled console assets and open local URL.
}
```

Keep `runCli()` decision logic narrow:

```ts
const userArgs = argv.slice(2);
const opensHelp =
  userArgs.includes("--help") || userArgs.includes("-h") || userArgs[0] === "help";

if (userArgs.length === 0) {
  await launchConsole({ projectRoot: process.cwd() });
  return 0;
}

if (!opensHelp) {
  await program.parseAsync(argv);
  return process.exitCode ?? 0;
}
```

Important rule:
- only bare `devloop` launches the console
- unknown commands still fail as unknown commands

- [ ] **Step 4: Re-run the focused CLI tests**

Run:

```bash
npx -y pnpm@10.0.0 test packages/cli/src/__tests__/cli.test.ts
```

Expected after implementation:
- bare command test passes
- help tests pass
- unknown command behavior remains unchanged

- [ ] **Step 5: Commit the CLI routing slice**

```bash
git add packages/cli/src/main.ts packages/cli/src/__tests__/cli.test.ts packages/cli/src/commands
git commit -m "feat: launch control console from bare devloop command"
```

### Task 3: Add console server APIs for actions, workflows, and dashboard launch reuse

**Files:**
- Create: `packages/server/src/console-types.ts`
- Create: `packages/server/src/console-actions.ts`
- Create: `packages/server/src/console-workflows.ts`
- Create: `packages/server/src/console-app.ts`
- Create: `packages/server/src/dashboard-runtime.ts`
- Create: `packages/server/src/__tests__/console-app.test.ts`
- Modify: `packages/cli/src/commands/ui.ts`
- Test: `packages/server/src/__tests__/console-app.test.ts`

- [ ] **Step 1: Write failing server tests for action and workflow endpoints**

Add tests for the first-version contract:

```ts
it("runs sync via POST /api/actions/sync", async () => {
  const response = await app.inject({ method: "POST", url: "/api/actions/sync" });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    kind: "action",
    actionId: "sync",
    status: "passed"
  });
});

it("stops a workflow when a step fails", async () => {
  vi.mocked(runAction).mockResolvedValueOnce(passResult).mockResolvedValueOnce(failResult);

  const response = await app.inject({
    method: "POST",
    url: "/api/workflows/run",
    payload: { workflowId: "pre-release-check" }
  });

  expect(response.json().steps[2].status).toBe("skipped");
});
```

- [ ] **Step 2: Run the focused server tests and confirm the new endpoints are missing**

Run:

```bash
npx -y pnpm@10.0.0 test packages/server/src/__tests__/console-app.test.ts
```

Expected before implementation:
- route-not-found failures for action/workflow endpoints

- [ ] **Step 3: Define a small shared execution schema**

Start with stable primitives in `console-types.ts`:

```ts
export type ExecutionStatus = "queued" | "running" | "passed" | "failed" | "skipped";

export type ActionExecutionResult = {
  executionId: string;
  kind: "action";
  actionId: "sync" | "run-scenario" | "status" | "release-check" | "start-ui";
  status: Exclude<ExecutionStatus, "queued" | "running" | "skipped">;
  summary: string;
  logs: string[];
  startedAt: string;
  finishedAt: string;
  data?: unknown;
};
```

- [ ] **Step 4: Implement console actions by reusing existing core and server logic**

Map actions directly to code, not shell commands:

```ts
if (actionId === "sync") {
  const registry = await syncProject(projectRoot, { now: new Date().toISOString() });
  await saveRegistry(projectRoot, registry);
  return {
    executionId,
    kind: "action",
    actionId: "sync",
    status: "passed",
    summary: "Registry synced successfully",
    logs,
    startedAt,
    finishedAt: new Date().toISOString(),
    data: registry
  };
}
```

Implementation requirements:
- `run-scenario` reuses the same scenario logic as `devloop run-scenario`
- `status` returns `getStatusSummary(projectRoot)`
- `release-check` returns `runReleaseCheck(projectRoot)`
- `start-ui` uses a shared runtime helper and returns the dashboard URL

- [ ] **Step 5: Implement workflow orchestration with stop-on-failure behavior**

Keep the workflow table fixed in code:

```ts
const WORKFLOWS = {
  "development-check": ["sync", "local-api-smoke", "status"],
  "pre-release-check": ["sync", "local-api-smoke", "browser-dashboard-smoke", "release-check"]
} as const;
```

Workflow runner requirements:
- one active workflow at a time
- later steps become `skipped` if an earlier step fails
- keep per-step logs for the UI

- [ ] **Step 6: Extract reusable dashboard launch runtime**

`dashboard-runtime.ts` should own the singleton:

```ts
let activeDashboard: { url: string; close: () => Promise<void> } | null = null;

export async function ensureDashboardRunning(input: { projectRoot: string; uiDistPath: string }) {
  if (activeDashboard) {
    return activeDashboard.url;
  }
  // build existing dashboard server, listen, remember URL
}
```

Then update `devloop ui` to call the same helper rather than owning launch state itself.

- [ ] **Step 7: Re-run focused server tests**

Run:

```bash
npx -y pnpm@10.0.0 test packages/server/src/__tests__/console-app.test.ts
```

Expected after implementation:
- all action routes pass
- workflow failure test passes
- repeated `start-ui` requests return a stable URL

- [ ] **Step 8: Commit the console backend slice**

```bash
git add packages/server packages/cli/src/commands/ui.ts
git commit -m "feat: add control console action and workflow backend"
```

### Task 4: Build the visual control console UI

**Files:**
- Create: `packages/console/src/api.ts`
- Create: `packages/console/src/App.tsx`
- Create: `packages/console/src/styles.css`
- Create: `packages/console/src/__tests__/app.test.tsx`
- Possibly modify: `packages/console/src/main.tsx`
- Test: `packages/console/src/__tests__/app.test.tsx`

- [ ] **Step 1: Write failing UI tests for actions, workflows, help, and expandable logs**

Add behavior-driven tests like:

```tsx
it("renders quick actions and workflows", async () => {
  render(<App />);
  expect(screen.getByText("Sync project")).toBeInTheDocument();
  expect(screen.getByText("Development check")).toBeInTheDocument();
});

it("opens help modal and links to full help", async () => {
  render(<App />);
  await user.click(screen.getByRole("button", { name: "Help" }));
  expect(screen.getByText("snapshot, git-pending, and git")).toBeInTheDocument();
  expect(screen.getByText("View full help")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused UI tests and verify they fail with the placeholder console**

Run:

```bash
npx -y pnpm@10.0.0 --filter @devloop/console test
```

Expected before implementation:
- missing controls
- no help modal
- no workflow result view

- [ ] **Step 3: Implement the browser API client for actions and workflows**

Provide explicit API helpers:

```ts
export function runAction(actionId: string, payload?: unknown) {
  return requestJson<ActionExecutionResult>(`/api/actions/${actionId}`, {
    method: "POST",
    body: payload ? JSON.stringify(payload) : undefined,
    headers: payload ? { "content-type": "application/json" } : undefined
  });
}

export function runWorkflow(workflowId: string) {
  return requestJson<WorkflowExecutionResult>("/api/workflows/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workflowId })
  });
}
```

- [ ] **Step 4: Implement the console surface with four sections**

`App.tsx` should render:
- quick actions
- one-click workflows
- execution results
- help entry

State model should stay small:

```ts
const [execution, setExecution] = useState<ExecutionResult | null>(null);
const [helpOpen, setHelpOpen] = useState(false);
const [fullHelpOpen, setFullHelpOpen] = useState(false);
const [isBusy, setIsBusy] = useState(false);
```

Key UI requirements:
- actions and workflows disable while conflicting work is running
- logs are collapsed by default
- expanding a step reveals the stored logs
- "Start DevLoop UI" shows a returned URL button

- [ ] **Step 5: Implement the help modal and full help view**

The lightweight help content must include:

```tsx
<ul>
  <li>Quick actions run one step at a time.</li>
  <li>Workflows run a checked sequence for you.</li>
  <li>Snapshot mode works without git.</li>
  <li>Git-pending means git exists but the first commit does not.</li>
  <li>Start DevLoop UI opens the existing dashboard view.</li>
</ul>
```

The full help view must include:
- daily workflow guidance
- pre-release guidance
- no-git to git upgrade explanation
- failure troubleshooting

- [ ] **Step 6: Re-run focused UI tests**

Run:

```bash
npx -y pnpm@10.0.0 --filter @devloop/console test
```

Expected after implementation:
- quick action rendering passes
- help modal passes
- workflow/log expansion passes

- [ ] **Step 7: Commit the console UI slice**

```bash
git add packages/console
git commit -m "feat: build default control console UI"
```

### Task 5: Launch the console server from the CLI and ship the help/docs path

**Files:**
- Modify: `packages/cli/src/commands/console.ts` or console launch helper file
- Modify: `packages/server/src/console-app.ts`
- Modify: `README.md`
- Test: `packages/cli/src/__tests__/cli.test.ts`
- Test: `packages/server/src/__tests__/console-app.test.ts`

- [ ] **Step 1: Write failing tests for console launch output**

Add CLI expectation coverage:

```ts
it("prints the console url when devloop launches the default console", async () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const { runCli } = await importCli();

  const exitCode = await runCli(["node", "devloop"]);

  expect(exitCode).toBe(0);
  expect(logSpy).toHaveBeenCalledWith(
    expect.stringContaining("DevLoop console available at http://127.0.0.1:")
  );
});
```

- [ ] **Step 2: Run the focused CLI tests and confirm launch messaging is still missing**

Run:

```bash
npx -y pnpm@10.0.0 test packages/cli/src/__tests__/cli.test.ts
```

Expected before implementation:
- no console launch message yet

- [ ] **Step 3: Implement the console launch path**

The launch helper should:
- resolve bundled console dist from CLI `dist/console`
- build the console Fastify app
- listen on a local port
- print the URL
- attempt to open the browser

Keep the browser opener isolated:

```ts
export async function openLocalUrl(url: string) {
  // best-effort open on macOS first, do not fail console startup if browser open fails
}
```

- [ ] **Step 4: Update README to make bare `devloop` the primary path**

README changes must include:
- install/build steps
- `devloop` as default entry
- what the quick actions and workflows do
- how `devloop ui` now fits into the experience
- reminder that no-git projects still work in snapshot mode

- [ ] **Step 5: Re-run the focused CLI tests**

Run:

```bash
npx -y pnpm@10.0.0 test packages/cli/src/__tests__/cli.test.ts
```

Expected after implementation:
- bare `devloop` route passes
- help still works
- launch message prints

- [ ] **Step 6: Commit the launch-and-docs slice**

```bash
git add packages/cli README.md
git commit -m "feat: ship default devloop console entrypoint"
```

### Task 6: Verify the whole flow end to end

**Files:**
- Test: `packages/cli/src/__tests__/cli.test.ts`
- Test: `packages/server/src/__tests__/console-app.test.ts`
- Test: `packages/server/src/__tests__/app.test.ts`
- Test: `packages/console/src/__tests__/app.test.tsx`
- Optionally modify: `packages/cli/src/commands/run-scenario.ts`

- [ ] **Step 1: Add or update one smoke path for the new console**

If a scenario is added, use a fixed verification target:

```ts
type SupportedScenarioId =
  | "local-api-smoke"
  | "browser-dashboard-smoke"
  | "browser-console-smoke";
```

Minimal `browser-console-smoke` checks:
- `GET /` returns HTML shell with `id="root"`
- `POST /api/workflows/run` accepts a known workflow
- `POST /api/actions/start-ui` returns a URL payload

- [ ] **Step 2: Run the focused tests for any new smoke scenario**

Run:

```bash
npx -y pnpm@10.0.0 test packages/cli/src/__tests__/cli.test.ts packages/server/src/__tests__/console-app.test.ts
```

Expected:
- smoke-related tests pass

- [ ] **Step 3: Run the full test suite**

Run:

```bash
npx -y pnpm@10.0.0 test
```

Expected:
- all workspace tests pass

- [ ] **Step 4: Run the full build**

Run:

```bash
npx -y pnpm@10.0.0 build
```

Expected:
- CLI, core, server, dashboard UI, and console UI all build

- [ ] **Step 5: Perform a live manual check**

Run:

```bash
node packages/cli/dist/main.js
```

Then verify manually:
- browser opens to the control console
- quick actions render
- help modal opens
- full help page opens
- `Start DevLoop UI` returns an openable dashboard URL
- at least one workflow completes and shows collapsible logs

- [ ] **Step 6: Commit the verification slice**

```bash
git add packages/cli packages/server packages/console README.md
git commit -m "test: verify default console entry end to end"
```

## Self-Review

### Spec coverage

- Bare `devloop` entry: Task 2 and Task 5
- Preserved `--help` and `help`: Task 2 and Task 5
- Quick actions: Task 3 and Task 4
- Two workflows: Task 3 and Task 4
- Collapsible logs: Task 4
- Help modal and full help page: Task 4
- `Start DevLoop UI` action: Task 3 and Task 4
- No-git compatibility: Task 3 and Task 4, via reuse of current core behavior
- Documentation changes: Task 5
- End-to-end verification: Task 6

### Placeholder scan

No `TODO`, `TBD`, or "implement later" placeholders remain in the task steps. Optional smoke work is explicitly bounded and tied to concrete files and commands.

### Type consistency

The plan consistently uses:
- `ActionExecutionResult`
- `WorkflowExecutionResult`
- `development-check`
- `pre-release-check`
- `start-ui`

Keep these identifiers stable during implementation unless all tasks and tests are updated together.

