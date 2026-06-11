# DevLoop Iteration-First PRD-Driven Testing Design

## Goal

Refocus DevLoop around the user's real testing problem:

- AI-driven projects accumulate many fast requirement changes
- the real test basis is the user's requirement intent, not only changed files
- developers lose track of what was changed, what should be tested, and which older verified flows may now regress

This redesign makes DevLoop requirement-first instead of file-first.

DevLoop should:

1. capture new development requirements as iteration PRDs
2. keep appending related requirement changes into the same iteration when appropriate
3. reopen older iteration PRDs when later follow-up changes or regression fixes belong to them
4. generate and maintain requirement-based acceptance and regression test checklists
5. use code-impact evidence as supporting input, not the primary testing key
6. decide release readiness based on iteration completion and verification evidence

## Problem Correction

The current DevLoop implementation is useful as a change-impact and verification evidence tool, but it is misaligned with the user's primary pain.

### What the current product does well

- records verification evidence
- tracks test runs
- infers changed areas from file changes
- shows release risk and status
- works without git and upgrades automatically when git later appears

### Why that is still insufficient

The user does not mainly suffer from "I do not know which files changed."

The real pain is:

- users repeatedly ask AI tools to add, adjust, refactor, and patch features
- those requests are not systematically recorded as requirements
- several days later, the team no longer knows which requirements were implemented
- therefore they do not know what to test
- hidden regressions appear because testing starts from changed files instead of requirement intent

So the product center must shift from:

- changed files
- impacted features
- suggested scenarios

to:

- requirement iteration
- PRD
- acceptance checklist
- regression checklist
- evidence attached back to the requirement

## Product Decision

DevLoop should adopt an iteration-first model.

The system's primary object is no longer a feature ledger. It is a requirement iteration with an attached PRD and verification lifecycle.

### New primary objects

- `iteration`
- `prd`
- `change_event`
- `acceptance_item`
- `regression_item`
- `test_evidence`
- `release_gate`

### Supporting objects kept from the current system

- `feature`
- `scenario`
- `test_run`
- `impact_queue`
- `release_check`

These existing objects remain useful, but their role changes from "testing basis" to "supporting evidence and automation input."

## Core Model

## Iteration PRD

An iteration PRD represents one real development objective from the user's perspective.

Examples:

- build a new feature
- perform a meaningful refactor
- improve an interaction flow
- complete a grouped set of related requirement changes

Each iteration PRD must have:

- a stable id
- a human-readable title
- a status
- the original user request
- the current objective summary
- acceptance items
- regression items
- related conversation references
- supporting impact evidence
- linked test runs

### Status model

Use these states:

- `active`
- `paused`
- `done`
- `reopened`
- `archived`

### Meaning

- `active`: current working iteration
- `paused`: temporarily inactive, but not complete
- `done`: main requirement considered complete
- `reopened`: completed before, but later reopened for follow-up adjustment or regression repair
- `archived`: historical iteration no longer expected to change

This keeps PRDs from becoming "sealed forever" after first completion, which matches real AI-driven development behavior.

## Change Events

A change event is a captured requirement-side event from an AI tool or manual input.

Examples:

- user asks for a new requirement
- user asks for a follow-up adjustment
- user asks for a refactor
- user reports a bug caused by the current iteration
- user asks for a patch on a previously completed requirement

Each event should include:

- raw user request
- source tool
- source conversation id when available
- event timestamp
- candidate iteration association
- AI intent classification
- confidence level

### Intent types

- `new_iteration`
- `iteration_extension`
- `regression_fix`
- `reopen_iteration`
- `uncertain`

## Acceptance Items

Acceptance items define what must be true for the requirement itself to count as complete.

Examples:

- user can create a project from the new wizard
- dashboard language switch applies immediately
- CLI can open the visual console through the default entry

Acceptance items are the requirement-side testing basis.

They answer:

> what did we promise to make true?

## Regression Items

Regression items define what previously working behavior might have been broken by the current iteration.

Examples:

- old onboarding flow still works after wizard refactor
- dashboard status API still loads after locale changes
- previously tested release gate behavior still passes after project model changes

Regression items are attached under the same iteration PRD, not split into separate bug PRDs by default.

This matches the approved product rule:

- later regression fixes related to the same requirement stay under the original PRD
- if an older completed iteration is changed again, the default behavior is to reopen that iteration

## Requirement Grouping Rules

DevLoop should not create a new PRD for every message, and should not merge everything from the same day into one PRD.

The correct behavior is rule-based smart grouping.

### Default grouping strategy

Use AI recommendation with deterministic product rules.

#### Create a new PRD when:

- the user starts a clearly new feature goal
- the user starts a major refactor with distinct completion criteria
- the user changes to a different module and different outcome
- the acceptance standard is clearly different from the current iteration

#### Append to the current PRD when:

- the user is refining the same feature
- the user adds follow-up adjustments to the same goal
- the user is clarifying, polishing, or extending the same iteration objective

#### Reopen an older PRD when:

- the current change clearly targets a previously completed iteration
- the new work is a follow-up tweak, correction, or regression repair on that earlier objective

#### Attach as regression item when:

- the issue is not a brand-new user goal
- the issue exists because this iteration affected previously working behavior

### Uncertain cases

AI should recommend, not decide silently.

If confidence is low, DevLoop should present a choice such as:

- continue current PRD
- reopen older PRD
- create new PRD

This avoids corrupting the testing basis through incorrect hidden grouping.

## PRD Lifecycle Rules

### Closing

An iteration may be marked `done` when its main acceptance items are considered complete.

### Reopening

If later work belongs to that iteration, the default is to reopen the original PRD rather than creating a new one.

This is especially important for:

- late follow-up adjustments
- design corrections
- regression fixes caused by subsequent work

### Archiving

Iterations can later move to `archived` when they are clearly historical and no longer active.

## Capture Architecture

## Phase 1: Generic Capture Entry

The first phase should provide a stable tool-owned requirement capture layer, independent of any one AI tool vendor.

Recommended entry capabilities:

- `devloop capture`
- or `devloop iteration start`
- plus a browser-side action inside the default console

The generic capture flow accepts:

- raw requirement text
- optional title
- optional current iteration id
- optional source metadata

Outputs:

- machine iteration record
- generated PRD markdown
- initial AI-generated acceptance and regression checklists

### Why generic capture first

- it works even without editor integration
- it stabilizes the iteration model before vendor-specific adapters
- it avoids binding core logic to one hook system

## Phase 2: Tool Adapters

After the generic layer exists, DevLoop should add adapters for:

- Codex
- Cursor
- Claude Code

Each adapter converts tool-specific hooks into one normalized capture event model.

### Normalized capture event fields

- `source`: `manual`, `codex`, `cursor`, `claude-code`
- `conversationId`
- `eventId`
- `timestamp`
- `rawRequest`
- `contextSummary`
- `intentType`
- `confidence`
- `suggestedIterationId`

### Adapter principle

Adapters do not make core product decisions. They only normalize tool events and feed them into DevLoop's iteration engine.

That keeps the logic consistent across tools.

## Automatic PRD Generation

Each iteration must produce:

1. a machine record
2. a human-readable markdown PRD

### Markdown location

Use the configured PRD root:

- `docs/prd/`

Recommended path structure:

```text
docs/prd/YYYY-MM-DD/<iteration-slug>.md
```

This keeps PRDs grouped by creation date while still being easy to browse manually.

### PRD sections

The generated markdown should include:

- title
- iteration id
- status
- source tool
- created time
- updated time
- original user request
- current goal summary
- non-goals
- scope and affected areas
- acceptance checklist
- regression checklist
- risk notes
- timeline of captured change events
- linked verification evidence summary

### Editing model

AI generates the first draft.

Users may:

- add checklist items
- remove incorrect items
- rewrite titles and summaries
- add notes

Subsequent capture events should update the same iteration instead of replacing manual edits blindly.

## Testing Model Redesign

## Current model problem

The current model effectively behaves like:

```text
changed files
-> impacted features
-> suggested scenarios
-> test runs
```

This is useful for supporting analysis but not sufficient as the main testing basis.

## New model

Testing should become:

```text
user requirement
-> iteration PRD
-> acceptance items
-> regression items
-> suggested test matrix
-> execution evidence
-> release gate
```

### Three-layer testing basis

#### Layer 1: Acceptance basis

Derived from PRD acceptance items.

Answers:

- what must be true for this requirement to count as done?

#### Layer 2: Regression basis

Derived from PRD regression items.

Answers:

- what previously working behaviors now need reconfirmation?

#### Layer 3: Impact evidence

Derived from file changes, feature mappings, previous runs, and scenarios.

Answers:

- what technical evidence suggests these older areas are at risk?

This third layer supports the first two layers. It must not replace them.

## AI-Generated Test Checklists

The approved behavior is:

- AI generates the checklist first
- user may add, edit, or remove items

### Checklist generation inputs

- original user request
- current PRD summary
- reopened history if applicable
- changed files and impacted features as supporting evidence
- previous passed runs and historical verification state

### Checklist structure

Each checklist item should capture:

- id
- title
- type: `acceptance` or `regression`
- priority
- rationale
- suggested scope
- linked evidence ids
- current status

### Status examples

- `pending`
- `in_progress`
- `verified`
- `failed`
- `waived`

## Release Gate Redesign

Release gating should no longer only ask:

- are high-risk changed features tested?

It should primarily ask:

- are the active or release-bound iteration PRDs sufficiently verified?

### Gate basis

A release gate should evaluate:

- incomplete acceptance items
- incomplete regression items
- failing evidence linked to those items
- high-risk impacted technical areas with no explicit regression coverage

### Gate result meaning

- `pass`: required iteration evidence is complete
- `warn`: mostly complete, but degraded or advisory gaps remain
- `block`: required requirement verification is missing or failing

## Data Model Changes

## New machine truth sources

Add:

```text
.devloop/
  iterations/
    index.json
    <iteration-id>.json
```

### `index.json`

Stores lightweight iteration index data for fast listing.

### `<iteration-id>.json`

Stores the machine truth record for one iteration.

Recommended fields:

- `id`
- `slug`
- `title`
- `status`
- `source`
- `conversationRefs`
- `createdAt`
- `updatedAt`
- `closedAt`
- `reopenedFrom`
- `rawUserIntent`
- `goal`
- `nonGoals`
- `acceptanceItems`
- `regressionItems`
- `affectedFeatures`
- `affectedPaths`
- `changeEvents`
- `testRunIds`
- `evidenceLinks`
- `releaseStatus`

## Existing registry role after redesign

Keep:

- `.devloop/registry.json`

But change its product meaning.

### New role for registry

Registry becomes a supporting technical evidence layer for:

- impacted feature inference
- changed path evidence
- historical verification state
- scenario recommendation

It no longer serves as the product's primary answer to:

- what was this iteration trying to accomplish?
- what should be tested?

Those answers now belong to the iteration PRD and its machine twin.

## UI and Console Redesign Direction

The default control console and dashboard should evolve from command-centric views into iteration-centric views.

### Default console priorities

Show first:

- current active iteration
- recently reopened iterations
- pending acceptance items
- pending regression items
- quick actions for capture, verify, and review

### Dashboard priorities

Show:

- active PRD list
- reopened PRDs
- requirement verification completion
- regression verification completion
- release-bound PRDs with risk summaries

### Existing actions to keep

Keep:

- sync
- smoke scenarios
- release-check
- start UI

But make them act in the context of an iteration rather than as isolated system actions whenever possible.

## Migration Strategy

This redesign should not throw away the current foundation.

### Keep and reuse

- CLI structure
- default console shell
- dashboard shell
- local API model
- test run persistence
- release-check framework
- bilingual layer
- snapshot-to-git upgrade behavior

### Refactor center

Move the product center from:

- `feature/path/state`

to:

- `iteration/prd/checklist/evidence`

### Transitional coexistence

During migration:

- old feature registry data continues to exist
- new iterations data becomes primary for testing UX
- release-check gradually reads both sources, then prioritizes iteration evidence

## Risks

### Risk 1: Wrong iteration grouping

Mitigation:

- use explicit rules
- use AI recommendation with confidence
- ask for confirmation when uncertain

### Risk 2: Checklist noise or over-generation

Mitigation:

- keep AI-generated checklist editable
- separate acceptance from regression items
- let users waive or remove irrelevant items

### Risk 3: Manual edits being overwritten

Mitigation:

- treat markdown as editable projection
- store canonical machine data separately
- merge updates rather than regenerating whole files destructively

### Risk 4: Product complexity rising too fast

Mitigation:

- phase the rollout
- generic capture first
- adapter support second
- iteration-first UI changes after the data model is stable

## Success Criteria

The redesign succeeds when:

1. new requirement work can automatically create or update an iteration PRD
2. later related changes reopen or extend the correct PRD by default
3. testing recommendations are primarily based on PRD acceptance and regression items
4. changed-file analysis is still available, but only as supporting evidence
5. a developer returning after several days can clearly see which requirements were worked on and what still needs testing
6. release decisions can reference incomplete requirement verification, not only technical change risk

## Out of Scope for This Redesign Phase

- full cloud collaboration
- enterprise approval workflows
- automatic bug fixing
- perfect vendor-neutral semantic capture across every AI tool on day one

The first target is a correct local-first requirement-driven testing core.
