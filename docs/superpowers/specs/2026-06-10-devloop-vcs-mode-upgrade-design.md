# DevLoop VCS Mode Upgrade Design

## Goal

Define how DevLoop should work across three project states without breaking user history:

1. no local git
2. local git only
3. local git plus remote collaboration

The key requirement is continuity. A project that starts in no-git mode must keep working, and when git appears later, DevLoop must upgrade automatically instead of forcing a reset or manual migration.

## Product Decision

DevLoop project identity is rooted in the project directory and `.devloop/config.yml`, not in git.

Git is a revision source, not the definition of a project.

That means the same DevLoop project may transition through:

`snapshot mode -> git mode -> remote-aware git mode`

without losing feature state, test evidence, or release history.

## Approaches Considered

### Option A: Require git from day one

Pros:
- simpler implementation
- strong revision model from the start

Cons:
- blocks valid no-git projects
- breaks the low-friction promise
- makes DevLoop feel like a git plugin instead of a testing system

### Option B: Separate no-git and git projects

Pros:
- clearer internal implementation boundaries
- fewer mixed-state records

Cons:
- forces a migration boundary on the user
- risks duplicated history and split dashboards
- creates unnecessary setup cost

### Option C: Single project, adaptive revision mode

Pros:
- aligns with real project evolution
- preserves history across tool maturity
- supports both lightweight and rigorous workflows

Cons:
- requires a more explicit revision model
- needs a first-class upgrade event

### Recommendation

Choose Option C.

DevLoop should keep one project identity and adapt its revision source over time.

## Operating Modes

### Mode 1: Snapshot Mode

Used when no local git repository is detected.

DevLoop captures change using filesystem evidence:
- relative file paths
- file content hash
- file size
- mtime

This mode supports:
- `doctor`
- `status`
- `ui`
- `sync`
- scenario registry
- test run evidence
- release check in degraded mode

This mode does not require commit SHA.

### Mode 2: Git Mode

Used when a local git repository is detected and `HEAD` can be resolved.

DevLoop captures change using:
- `git status`
- `git diff`
- `git rev-parse HEAD`

This mode supports the full M1 flow with stronger evidence:
- impacted change detection by git state
- release checks tied to `HEAD`
- test runs tied to commit SHA

### Mode 3: Remote-Aware Git Mode

Used when git exists and remote metadata is available.

This is a future extension layer, not a prerequisite for M1.

Potential additions:
- branch tracking
- PR-aware release checks
- base branch comparison
- remote release metadata

## Detection Rules

### Project Identity

Project identity is stable if:
- `.devloop/config.yml` exists
- the project root is unchanged

Optional future field:

```json
{
  "projectId": "proj_01jx..."
}
```

`projectId` should remain stable across git initialization.

### VCS Detection

On every `sync`, `release-check`, and dashboard boot:

1. detect whether `.git` exists in or above the project root
2. if git exists, try resolving `HEAD`
3. choose mode using the following precedence:

| Condition | Mode |
|---|---|
| no `.git` found | `snapshot` |
| `.git` found but no valid `HEAD` yet | `git-pending` |
| `.git` found and `HEAD` resolves | `git` |

`git-pending` is a short-lived transition state between snapshot mode and full git mode.

## Transition Rules

### Transition A: No Git -> Snapshot Mode

This is the initial default for any project without local git.

Behavior:
- create and update snapshot-based revision metadata
- allow testing and UI flows
- mark release checks as degraded when git-level guarantees are unavailable

### Transition B: Snapshot Mode -> Git Pending

Triggered when `.git` is detected but `HEAD` is not yet available.

Typical case:
- user runs `git init`
- no first commit yet

Behavior:
- keep using snapshot-based change capture
- record that git has been detected
- show a soft warning in UI and CLI:
  `git detected but no HEAD exists yet; continuing in transitional snapshot mode`

Do not auto-fail the project.

### Transition C: Git Pending or Snapshot Mode -> Git Mode

Triggered when `.git` exists and `HEAD` resolves successfully.

This transition should happen automatically during the next `sync`, `release-check`, or UI refresh.

Behavior:
1. record a `mode_upgrade` event
2. store the first git-backed `HEAD`
3. mark prior evidence as `pre_git`
4. establish a bridge from the last snapshot revision to the first commit-backed revision
5. use git-based revision capture for all new records

No manual migration step is required.

## Data Model Changes

### Project Metadata

Introduce project metadata in registry or a dedicated metadata file.

Recommended shape:

```json
{
  "projectId": "proj_01jx8v2j9k7n4x",
  "vcs": {
    "mode": "snapshot",
    "detectedAt": "2026-06-10T14:00:00.000Z",
    "gitRoot": null,
    "headSha": null,
    "historyBridge": null
  }
}
```

When upgraded:

```json
{
  "projectId": "proj_01jx8v2j9k7n4x",
  "vcs": {
    "mode": "git",
    "detectedAt": "2026-06-12T09:12:00.000Z",
    "gitRoot": "/path/to/repo",
    "headSha": "abc1234def5678",
    "historyBridge": {
      "fromRevision": {
        "kind": "snapshot",
        "snapshotId": "snap_00012"
      },
      "toRevision": {
        "kind": "git",
        "commitSha": "abc1234def5678"
      },
      "createdAt": "2026-06-12T09:12:04.000Z"
    }
  }
}
```

### Revision Model

Replace commit-only assumptions with a generalized revision envelope.

Recommended type:

```json
{
  "revision": {
    "kind": "snapshot",
    "snapshotId": "snap_00012"
  }
}
```

or

```json
{
  "revision": {
    "kind": "git",
    "commitSha": "abc1234def5678"
  }
}
```

Optional future extension:

```json
{
  "revision": {
    "kind": "git_remote",
    "commitSha": "abc1234def5678",
    "branch": "main",
    "remote": "origin"
  }
}
```

### Test Run Model

Current `test_run` records should no longer assume `commit_sha` is always present.

Recommended shape:

```json
{
  "run_id": "run_2026_06_10_001",
  "scenario_id": "devloop-workspace-smoke",
  "status": "passed",
  "scope": "smoke",
  "revision": {
    "kind": "snapshot",
    "snapshotId": "snap_00012"
  },
  "artifacts": [],
  "executed_at": "2026-06-10T14:35:00.000Z"
}
```

Git-backed example:

```json
{
  "run_id": "run_2026_06_12_002",
  "scenario_id": "devloop-workspace-smoke",
  "status": "passed",
  "scope": "smoke",
  "revision": {
    "kind": "git",
    "commitSha": "abc1234def5678"
  },
  "artifacts": [],
  "executed_at": "2026-06-12T09:15:00.000Z"
}
```

### Sync State

`sync` output should report which evidence source was used:

```json
{
  "captureMode": "snapshot",
  "changedFiles": ["src/app.ts"],
  "revision": {
    "kind": "snapshot",
    "snapshotId": "snap_00013"
  }
}
```

Later:

```json
{
  "captureMode": "git",
  "changedFiles": ["src/app.ts"],
  "revision": {
    "kind": "git",
    "commitSha": "abc1234def5678"
  }
}
```

## Release Check Behavior

### Snapshot Mode

`release-check` must not crash just because git is absent.

Instead it should evaluate what it can and explicitly mark degraded confidence.

Recommended result shape:

```json
{
  "decision": "warn",
  "mode": "snapshot",
  "impactedFeatures": ["core-engine"],
  "unmetRequirements": [
    "missing_git_revision_evidence"
  ],
  "notes": [
    "Running in snapshot mode without commit-backed release evidence"
  ]
}
```

Rules:
- if P0 features are unverified, still `block`
- if release evidence requires commit-backed head smoke and no git exists, return `warn` or `block` depending on configured strictness
- never return an internal 500 for missing git

### Git Mode

Use existing `HEAD`-based logic.

## UI Behavior

The dashboard should surface mode explicitly.

Recommended labels:
- `Snapshot mode`
- `Git detected, awaiting first commit`
- `Git-backed mode`

The UI should also show a transition note after upgrade:

`Project upgraded from snapshot history to git-backed history on 2026-06-12`

The history view should visually separate:
- pre-git runs
- git-backed runs

## Backward Compatibility

Current M1 data assumes git-backed helpers in some places. The migration path should preserve existing records:

1. if old records contain `commit_sha`, map them to `revision.kind = git`
2. if project has no revision envelope yet, infer mode from available data
3. default missing mode to:
   - `git` if commit-backed evidence exists
   - otherwise `snapshot`

## Error Handling

### Allowed Degraded States

- no git present
- git initialized but no commit yet
- remote absent

These are valid states, not fatal errors.

### Fatal States

- missing `.devloop/config.yml`
- unreadable registry
- malformed config

## Acceptance Criteria

1. A project without local git can run `doctor`, `status`, `sync`, `ui`, and `release-check` without crashing.
2. A project in snapshot mode records snapshot-based revision evidence.
3. When local git appears later, the next sync automatically upgrades the project to git mode.
4. Pre-git test evidence remains visible after upgrade.
5. New test runs after upgrade are recorded against commit-backed revision data.
6. `release-check` no longer treats missing git as an internal server failure.
7. The dashboard clearly indicates whether evidence is snapshot-backed or git-backed.

## Recommended Implementation Sequence

1. Introduce generalized `revision` types in core schemas
2. Add mode detection helpers: snapshot, git-pending, git
3. Add snapshot capture path for `sync`
4. Make `release-check` git-optional
5. Add upgrade bridge logic from snapshot to git
6. Expose mode and transition metadata through API/UI

## Recommendation Summary

The correct model is:

- no local git: supported through snapshot mode
- local git later: automatic upgrade
- remote git later: optional future enrichment

DevLoop should never force the user to restart their project history just because the project matured from informal local work into a git-backed workflow.
