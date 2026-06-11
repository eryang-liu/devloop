# DevLoop Bilingual Console And UI Design

## Goal

Make both DevLoop browser surfaces support bilingual usage:

- the default control console opened by `devloop`
- the dashboard opened by `devloop ui`

Users must be able to switch between Simplified Chinese and English from either surface, and the preference should stay consistent across both surfaces.

This change is meant to improve:

- first-use accessibility for Chinese-speaking users
- product consistency between the default console and the dashboard
- daily usability for teams that alternate between Chinese and English

## Product Decision

DevLoop will support two UI languages in this phase:

- `zh-CN`
- `en-US`

The default behavior will be:

1. first visit follows browser language
2. user can manually switch language from either browser surface
3. once manually switched, the preference is stored locally
4. console and dashboard share the same stored preference
5. open pages should react to changes from the other page through browser storage events

This keeps the product feeling like one system rather than two separate frontends.

## Translation Scope

The bilingual layer will cover:

- all frontend static UI copy
- frontend-owned status labels
- frontend-owned action and workflow summaries when they can be mapped deterministically
- date, time, and empty-state presentation
- Ant Design built-in locale strings used in the dashboard

The bilingual layer will not cover:

- raw backend logs
- arbitrary backend error messages that are not currently structured
- feature ids, scenario ids, revision ids, or other machine identifiers

### Why this boundary

The user explicitly wants:

- UI copy translated
- common result summaries translated
- logs kept raw

That means DevLoop should avoid pretending to fully localize backend output when it cannot do so reliably. Logs stay trustworthy, while the main workflow still feels bilingual.

## User Experience

### Shared behavior

Both browser surfaces should show a visible language switcher in the top-right action area.

The switcher should:

- show a compact bilingual affordance such as `中文 / EN`
- indicate the active language clearly
- apply immediately without reload
- sync across open DevLoop pages through `storage` events

### Console placement

In the default console, the language switcher should sit beside the existing top-right action cluster that currently contains `Help`.

### Dashboard placement

In the dashboard, the language switcher should sit in the masthead actions cluster near the refresh control.

### First-load language rules

Language resolution order:

1. stored language preference in local storage
2. browser language family
3. fallback to English if detection fails

Browser detection rule:

- values beginning with `zh` resolve to `zh-CN`
- all other values resolve to `en-US`

## Architecture

## Shared i18n Layer

Add a lightweight shared frontend module for language state and dictionary lookup instead of introducing a full internationalization framework.

The shared layer should provide:

- language type definitions
- storage key constant
- browser-language detection
- persisted language read/write helpers
- a React hook for current language and setter
- subscription to browser `storage` events
- a translation lookup helper
- locale-aware date/time formatting helpers

This module should be shared by both `packages/console` and `packages/ui`.

### Why not a heavier framework

A full i18n framework would be unnecessary for the current scope because:

- only two languages are required
- the copy surface is still relatively small
- the product needs strong shared behavior more than pluralization or namespace complexity
- the fastest maintainable path is a focused shared module

The design should still keep dictionaries isolated enough that a future migration to a fuller framework remains straightforward.

## Dictionary Design

Use explicit dictionaries keyed by stable message ids rather than inline conditional strings spread throughout components.

Dictionary categories should include:

- shell and masthead text
- action and workflow titles and descriptions
- button labels
- help modal and full-help content
- dashboard headings, metric labels, table labels, empty states, and alerts
- frontend status labels
- frontend release gate text
- frontend-known execution summaries

Message ids should be descriptive and product-oriented, for example:

- `console.hero.title`
- `console.actions.sync.title`
- `dashboard.gate.passValue`
- `shared.buttons.help`

## Result Summary Translation

Common action and workflow summaries should be translated in the frontend through structured mapping, not by attempting to translate arbitrary English text.

### Console

For console execution results, translated presentation should be driven by structured fields such as:

- `kind`
- `actionId`
- `workflowId`
- `status`

Examples:

- `actionId=sync`, `status=passed` -> localized success summary
- `workflowId=pre-release-check`, `status=passed` -> localized workflow success summary
- `actionId=start-ui`, `status=failed` -> localized UI-start failure summary

If an execution result contains a summary that the frontend cannot safely remap, it may fall back to the raw summary text.

### Dashboard

Dashboard release decisions, feature status labels, scope labels, and run-status labels are already frontend-owned and should be localized directly.

## Ant Design Locale

The dashboard already uses `ConfigProvider`. It should also switch Ant Design locale objects based on the active language:

- `enUS` for English
- `zhCN` for Simplified Chinese

This ensures built-in component text such as table empty states and future Ant Design component strings stay aligned with the selected language.

## Storage Contract

Use one shared local storage key for both surfaces.

Recommended key:

- `devloop.language`

Stored values:

- `zh-CN`
- `en-US`

The UI should never store raw browser language strings such as `zh`, `zh-Hans`, or `en-GB`. Those should only be normalized during detection.

## Formatting Rules

Locale-aware formatting should apply to:

- date/time labels
- refresh timestamps
- sync timestamps
- executed-at timestamps

Formatting should use the active language locale instead of `undefined`, so switching language also switches how timestamps are rendered.

## Testing Strategy

Implementation should follow test-first updates for both surfaces.

### Console tests

Add or extend tests to verify:

- default language follows browser language when no stored value exists
- clicking the switcher changes visible language
- the chosen language is persisted
- execution summary presentation changes with language
- log text remains raw and untranslated

### Dashboard tests

Add a first dedicated UI test file for the dashboard and verify:

- default language detection
- manual switching updates key visible labels
- shared local storage is respected
- Ant Design-facing text and page-owned text render in the active language

### Shared-state tests

At least one test path should verify that the shared language key is reused consistently by both surfaces.

## Out Of Scope

This phase will not include:

- third-language support
- server-side content negotiation
- translating persisted registry content
- translating feature names or scenario ids from config
- translating freeform backend logs
- account-level or cloud-synced language preference

## Implementation Notes

Expected touchpoints:

- `packages/console/src/App.tsx`
- `packages/console/src/__tests__/app.test.tsx`
- `packages/ui/src/App.tsx`
- `packages/ui/src/main.tsx`
- new dashboard UI test file
- a new shared frontend i18n module used by both packages

No backend API change is required for the first version. Translation of common summaries should be handled from existing structured result data on the frontend.

## Success Criteria

This feature is successful when:

1. opening the console or dashboard for the first time follows browser language
2. switching language in one surface updates that surface immediately
3. refreshing the other surface loads the same chosen language
4. open pages stay in sync after a language change via local storage events
5. UI copy is fully bilingual across console and dashboard
6. common result summaries are bilingual
7. raw logs remain unchanged
8. dashboard Ant Design component locale matches the selected language
