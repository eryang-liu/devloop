# DevLoop Default Console Entry Design

## Goal

Make DevLoop usable through a single memorable entry command:

`devloop`

When the user runs `devloop`, DevLoop should open a local visual control console instead of requiring the user to remember multiple CLI commands.

The console should let the user:
- run single verification actions
- run prebuilt multi-step workflows
- inspect step-by-step results and logs
- open the existing `devloop ui`
- read in-product help

This feature is aimed at reducing the current adoption friction:
- too many commands to remember
- no obvious first step after installation
- no visual way to run common workflows
- users who prefer clicking flows over composing CLI commands

## Product Decision

DevLoop should have two layers of entry:

1. `devloop`
   - the default visual control console
2. explicit subcommands such as `devloop sync`, `devloop ui`, and `devloop release-check`
   - still available for CLI-oriented users and automation

The visual console becomes the default human entrypoint.

The command `devloop start` is intentionally not the primary entrypoint because it suggests "boot the whole tool" rather than "open my working console".

## User-Facing Command Semantics

### Default behavior

Running `devloop` with no positional subcommand should:
- start the local control console server
- bind to a local host and port
- open the browser to the console
- print the local URL in terminal output

### Help behavior

These commands must still show command-line help instead of opening the console:
- `devloop --help`
- `devloop -h`
- `devloop help`
- `devloop <subcommand> --help`

### Existing commands

Existing commands remain valid:
- `devloop doctor`
- `devloop status`
- `devloop sync`
- `devloop release-check`
- `devloop record-run`
- `devloop run-scenario`
- `devloop ui`

The console does not replace these commands. It orchestrates them through product UX.

## Approaches Considered

### Option A: Keep `devloop` as help only and add `devloop start`

Pros:
- conventional CLI behavior
- small routing change

Cons:
- still requires users to remember a special startup command
- `start` feels ambiguous and heavier than the intended UX
- weakens the "one command to get going" product promise

### Option B: Make `devloop` open the console and preserve CLI help behind flags and `help`

Pros:
- strongest onboarding experience
- simplest user memory model
- aligns with DevLoop becoming a product, not just a command set

Cons:
- changes the traditional meaning of a bare CLI command
- requires explicit handling so help remains reachable

### Option C: Merge the existing dashboard and the new console into one surface immediately

Pros:
- fewer entrypoints over the long term
- one browser surface

Cons:
- blurs the distinction between "control plane" and "status dashboard"
- makes the first version larger than necessary
- conflicts with the explicit requirement that the console include an option to start `devloop ui`

### Recommendation

Choose Option B.

`devloop` should open the visual control console by default, while `--help` and `help` still provide classic command-line help.

Keep `devloop ui` as a distinct capability and expose it as an action inside the console.

## Primary User Experience

### Entry flow

1. user runs `devloop`
2. DevLoop starts a local console service
3. DevLoop opens the browser automatically
4. user lands on a control console with actions, workflows, recent outcomes, and help

### Console structure

The first version of the console should have four main areas:

1. Quick actions
2. One-click workflows
3. Execution results
4. Help

## Information Architecture

### Area 1: Quick actions

Single-step actions for users who want direct control.

Initial actions:
- `1. Sync project`
- `2. Run local-api-smoke`
- `3. Run browser-dashboard-smoke`
- `4. Show status summary`
- `5. Run release-check`
- `6. Start DevLoop UI`

Each action should have:
- title
- short explanation
- current availability state
- run button
- result summary after execution

### Area 2: One-click workflows

Prebuilt multi-step flows for common working patterns.

Initial workflows:

#### Workflow A: Development check

Step sequence:
- `sync`
- `local-api-smoke`
- `status`

Use case:
- after a development session
- before handing changes to someone else
- before deciding whether more testing is needed

#### Workflow B: Pre-release check

Step sequence:
- `sync`
- `local-api-smoke`
- `browser-dashboard-smoke`
- `release-check`

Use case:
- before a release
- before a merge gate review
- before a final verification sweep

### Area 3: Execution results

This area shows current or most recent execution state.

Default presentation:
- compact step list
- each step shows `queued`, `running`, `passed`, `failed`, or `skipped`
- each step can expand to show logs

Behavior:
- logs are hidden by default
- user can expand any completed or failed step
- failures clearly identify which step failed and why

### Area 4: Help

The console includes a visible `Help` entry.

Clicking `Help` should open a lightweight modal first.

The modal should explain:
- what DevLoop is for
- the difference between quick actions and workflows
- what `snapshot`, `git-pending`, and `git` modes mean
- when to use `Start DevLoop UI`

The modal must also include a `View full help` action.

The full help page should provide:
- daily usage guide
- pre-release usage guide
- no-git behavior explanation
- upgrade-to-git behavior explanation
- common failure cases and troubleshooting

## Execution Model

### Principle

The console must not assemble shell strings in the browser and ask the user to run them manually.

The browser calls backend action APIs.

The backend action layer invokes existing DevLoop capabilities programmatically.

This preserves:
- consistent behavior
- reuse of tested core logic
- clearer error handling
- easier future extension

### Quick action execution

Each quick action maps to exactly one backend operation:
- `sync` -> `syncProject`
- `local-api-smoke` -> scenario runner
- `browser-dashboard-smoke` -> scenario runner
- `status` -> `getStatusSummary`
- `release-check` -> `runReleaseCheck`
- `start-devloop-ui` -> UI launch helper

### Workflow execution

A workflow is a backend-owned ordered sequence of steps.

Each step produces:
- `stepId`
- `title`
- `kind`
- `status`
- `summary`
- `logs`
- `startedAt`
- `finishedAt`

Workflow behavior:
- execute steps sequentially
- stop on first failure
- mark untouched remaining steps as `skipped`
- preserve successful earlier steps in the result view

### Concurrency rule

First version scope:
- one active workflow at a time
- one action may run while no workflow is active

If an execution is already in progress, the console should disable conflicting controls and show a clear message.

## `Start DevLoop UI` Behavior

This action exists because the control console is not the same thing as the existing dashboard.

Behavior:
- backend starts a `devloop ui`-backed local server instance
- backend returns the resolved local URL
- frontend shows a clear "Open DevLoop UI" link or button
- if the UI is already running, return the existing URL instead of starting duplicate servers

This keeps `devloop ui` alive as a product capability while moving the user's default starting point to the new console.

## Backend Architecture

### Console server

Introduce a dedicated console-serving path that can:
- serve the console frontend
- expose action APIs
- expose workflow APIs
- expose help content APIs if needed

This may reuse the same server package pattern as the existing UI server, but should remain logically distinct from the status dashboard behavior.

### Suggested routes

Minimum first-version routes:
- `GET /api/health`
- `GET /api/status`
- `GET /api/impact-queue`
- `GET /api/recent-runs`
- `POST /api/release-check`
- `POST /api/actions/sync`
- `POST /api/actions/run-scenario`
- `POST /api/actions/status`
- `POST /api/actions/start-ui`
- `POST /api/workflows/run`

The exact route naming may vary during implementation, but action and workflow execution must be separate concepts.

### Execution result schema

Recommended response shape for actions:

```json
{
  "executionId": "exec_01",
  "kind": "action",
  "actionId": "sync",
  "status": "passed",
  "summary": "Registry synced successfully",
  "logs": [
    "Sync started",
    "Detected snapshot mode",
    "Registry updated"
  ],
  "startedAt": "2026-06-11T09:00:00.000Z",
  "finishedAt": "2026-06-11T09:00:01.200Z"
}
```

Recommended response shape for workflows:

```json
{
  "executionId": "exec_02",
  "kind": "workflow",
  "workflowId": "pre-release-check",
  "status": "failed",
  "startedAt": "2026-06-11T09:05:00.000Z",
  "finishedAt": "2026-06-11T09:05:07.400Z",
  "steps": [
    {
      "stepId": "sync",
      "title": "Sync project",
      "status": "passed",
      "summary": "Registry synced successfully",
      "logs": ["..."],
      "startedAt": "2026-06-11T09:05:00.000Z",
      "finishedAt": "2026-06-11T09:05:01.000Z"
    },
    {
      "stepId": "browser-dashboard-smoke",
      "title": "Run browser dashboard smoke",
      "status": "failed",
      "summary": "GET / returned 500",
      "logs": ["..."],
      "startedAt": "2026-06-11T09:05:03.000Z",
      "finishedAt": "2026-06-11T09:05:07.400Z"
    }
  ]
}
```

## Frontend Behavior

### Interaction rules

- buttons should disable while their execution is active
- workflow buttons should disable while another workflow is active
- results update in place without a full page refresh
- log panels should use progressive disclosure
- the page should remain understandable on both desktop and mobile

### Empty state

On first load before any manual execution, the console should still feel useful.

Show:
- quick explanation of what to do first
- recommended starting workflow
- current project mode
- latest status counts if available

### Failure messaging

Failure messages must be plain and actionable.

Examples:
- `browser-dashboard-smoke failed because the dashboard route returned 500`
- `release-check blocked because required verification evidence is missing`
- `DevLoop UI is already running at http://127.0.0.1:4311`

Avoid generic messages such as `Execution failed`.

## State and Compatibility Rules

### No-git compatibility

The control console must work fully in:
- `snapshot`
- `git-pending`
- `git`

The existence of workflows or console actions must not make no-git projects second-class citizens.

### Existing data compatibility

The console must read and display the existing:
- status summary
- impact queue
- recent runs
- release-check result

No migration should be required to open the console in current projects.

## Testing Strategy

### CLI tests

Add tests that verify:
- `devloop` with no subcommand launches the console entry behavior
- `devloop --help` still shows help
- `devloop help` still shows help
- existing explicit subcommands keep working

### Server tests

Add tests that verify:
- action routes return expected execution payloads
- workflow routes stop on first failure
- `start-ui` returns a stable URL when already running

### UI tests

At minimum, verify:
- quick actions render
- workflows render
- result rows expand to logs
- help modal opens
- full help view is reachable

### End-to-end smoke

Add at least one smoke path for the console itself:
- open control console
- run a workflow
- confirm final state is visible

## First-Version Scope

Included:
- `devloop` default console entry
- quick actions
- two workflows
- collapsible logs
- help modal
- full help page
- `Start DevLoop UI` action

Explicitly excluded:
- arbitrary user-defined workflows
- background job queues
- multiple concurrent workflow runners
- websocket live streaming
- historical execution center
- multi-project workspace switcher
- remote execution

## Risks and Mitigations

### Risk 1: Too much new surface area at once

Mitigation:
- keep first-version workflows fixed
- reuse existing core commands and scenario runners
- do not add custom workflow editing yet

### Risk 2: Confusion between console and existing dashboard

Mitigation:
- keep names explicit
- explain difference in Help
- make `Start DevLoop UI` a deliberate action

### Risk 3: Bare command behavior surprises existing CLI users

Mitigation:
- preserve `--help` and `help`
- document the change clearly
- keep all explicit subcommands intact

### Risk 4: UI spawn behavior causes duplicate local servers

Mitigation:
- track active UI process state
- reuse existing running instance when possible

## Acceptance Criteria

1. Running `devloop` opens a local visual control console.
2. Running `devloop --help` still shows CLI help instead of opening the console.
3. The console shows quick actions for sync, scenario runs, status, release-check, and starting `devloop ui`.
4. The console shows at least two built-in workflows: development check and pre-release check.
5. Workflow runs show step-by-step status and allow logs to be expanded.
6. A failure stops the remaining workflow steps and clearly identifies the failing step.
7. The console includes a Help modal and a link to a full help page.
8. The console works in snapshot mode as well as git-backed mode.
9. Users can launch or reopen the existing `devloop ui` from inside the console.
10. Existing explicit CLI subcommands remain available.

