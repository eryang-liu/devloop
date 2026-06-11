# DevLoop VCS Mode Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let DevLoop work in no-git projects, degrade gracefully in `git-pending`, and auto-upgrade to git-backed evidence once `HEAD` exists.

**Architecture:** Introduce a first-class revision envelope plus persisted VCS metadata in the registry. Route `sync`, `release-check`, API responses, and UI state through a shared VCS detection helper so snapshot and git-backed projects use the same project identity and dashboard.

**Tech Stack:** TypeScript, Zod, Vitest, Fastify, React

---

### Task 1: Define generalized revision and VCS registry metadata

**Files:**
- Modify: `packages/core/src/registry.ts`
- Modify: `packages/core/src/test-runs.ts`
- Test: `packages/core/src/__tests__/release-check.test.ts`

- [ ] Write failing tests that exercise snapshot-backed test runs and registry metadata loading.
- [ ] Run the focused tests to verify schema failures happen for the new snapshot-shaped records.
- [ ] Add `revision`, `projectId`, `vcs`, and history-bridge schemas with backward-compatible parsing for old `commit_sha` records.
- [ ] Re-run the focused tests and keep legacy git fixtures green.

### Task 2: Add VCS detection and snapshot/git revision capture

**Files:**
- Modify: `packages/core/src/git.ts`
- Modify: `packages/core/src/sync.ts`
- Test: `packages/core/src/__tests__/sync.test.ts`

- [ ] Write failing tests for snapshot sync and snapshot-to-git upgrade bridge behavior.
- [ ] Run the focused sync tests to confirm the missing behavior fails for the expected assertions.
- [ ] Implement a shared VCS detector for `snapshot`, `git-pending`, and `git`, plus sync-time revision capture and registry upgrades.
- [ ] Re-run the focused sync tests until snapshot and git upgrade coverage passes.

### Task 3: Make release-check git-optional and surface mode

**Files:**
- Modify: `packages/core/src/release-check.ts`
- Modify: `packages/core/src/status.ts`
- Modify: `packages/server/src/app.ts`
- Modify: `packages/ui/src/api.ts`
- Test: `packages/core/src/__tests__/release-check.test.ts`
- Test: `packages/server/src/__tests__/app.test.ts`

- [ ] Write failing tests for snapshot-mode release checks and API sync/release-check paths without git.
- [ ] Run the focused tests to verify current git-only behavior fails.
- [ ] Implement snapshot-aware release-check decisions plus API responses that no longer require `HEAD`.
- [ ] Re-run the focused core and server tests until they pass.

### Task 4: Verify end to end

**Files:**
- Modify: `packages/ui/src/App.tsx`
- Test: `packages/cli/src/__tests__/cli.test.ts`

- [ ] Update UI types and rendering to show VCS mode and degraded release-check state without assuming git-backed evidence.
- [ ] Run targeted UI/CLI tests if needed for changed contracts.
- [ ] Run `npx -y pnpm@10.0.0 test`.
- [ ] Run `npx -y pnpm@10.0.0 build`.
