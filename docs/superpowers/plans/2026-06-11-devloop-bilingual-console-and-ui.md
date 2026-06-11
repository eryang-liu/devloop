# DevLoop Bilingual Console And UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared Chinese and English language switching to both the default DevLoop console and the DevLoop dashboard UI, with one persisted preference and localized frontend-owned summaries.

**Architecture:** Introduce a small shared browser i18n module inside the workspace and consume it from both frontend packages. Keep backend APIs unchanged, translate frontend-owned strings and structured execution summaries in the browser, and wire Ant Design locale selection from the shared language state.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Testing Library, Ant Design

---

## File Structure Map

### New files

- `packages/shared-frontend/package.json`
  - Shared package manifest for browser-side helpers used by multiple frontends.
- `packages/shared-frontend/tsconfig.json`
  - TypeScript config for the shared frontend package.
- `packages/shared-frontend/src/index.ts`
  - Public exports for language helpers, dictionaries, and summary translators.
- `packages/shared-frontend/src/language.ts`
  - Shared language types, storage key, detection, and hook utilities.
- `packages/shared-frontend/src/messages.ts`
  - Shared translation dictionaries and lookup helpers.
- `packages/ui/src/__tests__/app.test.tsx`
  - Dashboard language-switch tests.

### Modified files

- `packages/console/package.json`
  - Add dependency on the shared frontend package if needed by workspace resolution.
- `packages/console/src/App.tsx`
  - Replace inline strings with shared translations and add the console language switcher.
- `packages/console/src/__tests__/app.test.tsx`
  - Add red/green tests for browser-language detection, persistence, and bilingual summaries.
- `packages/ui/package.json`
  - Add dependency on the shared frontend package if needed by workspace resolution.
- `packages/ui/src/App.tsx`
  - Replace inline strings with shared translations and add the dashboard language switcher.
- `packages/ui/src/main.tsx`
  - Bind Ant Design locale to the shared language state.
- `README.md`
  - Document bilingual switching in console and dashboard.

### Optional small follow-up edits

- `packages/console/src/styles.css`
  - Only if the new switcher needs small layout support.
- `packages/ui/src/styles.css`
  - Only if the masthead language switcher needs spacing/polish.

---

### Task 1: Create the shared language and message layer

**Files:**
- Create: `packages/shared-frontend/package.json`
- Create: `packages/shared-frontend/tsconfig.json`
- Create: `packages/shared-frontend/src/index.ts`
- Create: `packages/shared-frontend/src/language.ts`
- Create: `packages/shared-frontend/src/messages.ts`
- Test: `npx -y pnpm@10.0.0 build`

- [ ] **Step 1: Add the new shared frontend package to the workspace with no runtime framework dependencies**

Create `packages/shared-frontend/package.json`:

```json
{
  "name": "@devloop/shared-frontend",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "peerDependencies": {
    "react": "^19.2.0"
  }
}
```

- [ ] **Step 2: Add a matching TypeScript config**

Create `packages/shared-frontend/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Write the shared language utilities**

Create `packages/shared-frontend/src/language.ts` with:

```ts
import { useEffect, useState } from "react";

export type DevLoopLanguage = "en-US" | "zh-CN";

export const DEVLOOP_LANGUAGE_STORAGE_KEY = "devloop.language";

export function normalizeLanguage(value: string | null | undefined): DevLoopLanguage {
  if (typeof value === "string" && value.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }

  return "en-US";
}

export function detectPreferredLanguage(): DevLoopLanguage {
  if (typeof window === "undefined") {
    return "en-US";
  }

  return normalizeLanguage(window.navigator.language);
}

export function getStoredLanguage(): DevLoopLanguage | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(DEVLOOP_LANGUAGE_STORAGE_KEY);

  if (value === "en-US" || value === "zh-CN") {
    return value;
  }

  return null;
}

export function resolveInitialLanguage(): DevLoopLanguage {
  return getStoredLanguage() ?? detectPreferredLanguage();
}

export function setStoredLanguage(language: DevLoopLanguage) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEVLOOP_LANGUAGE_STORAGE_KEY, language);
}

export function useLanguage() {
  const [language, setLanguageState] = useState<DevLoopLanguage>(() => resolveInitialLanguage());

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== DEVLOOP_LANGUAGE_STORAGE_KEY) {
        return;
      }

      setLanguageState(resolveInitialLanguage());
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function setLanguage(languageValue: DevLoopLanguage) {
    setStoredLanguage(languageValue);
    setLanguageState(languageValue);
  }

  return { language, setLanguage };
}

export function formatLocaleDateTime(
  language: DevLoopLanguage,
  value: string,
  options: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat(language, options).format(new Date(value));
}
```

- [ ] **Step 4: Write the shared dictionaries and translators**

Create `packages/shared-frontend/src/messages.ts` with:

```ts
import type { DevLoopLanguage } from "./language.js";

export type MessageDictionary = Record<string, string>;

const EN_MESSAGES: MessageDictionary = {};
const ZH_MESSAGES: MessageDictionary = {};

export const MESSAGES: Record<DevLoopLanguage, MessageDictionary> = {
  "en-US": EN_MESSAGES,
  "zh-CN": ZH_MESSAGES
};

export function t(language: DevLoopLanguage, key: string) {
  return MESSAGES[language][key] ?? MESSAGES["en-US"][key] ?? key;
}
```

Populate the dictionaries with actual keys for:

- shared language toggle labels
- console headings, help, buttons, and summaries
- dashboard headings, labels, gate copy, and empty states

- [ ] **Step 5: Export the shared helpers**

Create `packages/shared-frontend/src/index.ts`:

```ts
export {
  DEVLOOP_LANGUAGE_STORAGE_KEY,
  detectPreferredLanguage,
  formatLocaleDateTime,
  getStoredLanguage,
  normalizeLanguage,
  resolveInitialLanguage,
  setStoredLanguage,
  useLanguage
} from "./language.js";
export type { DevLoopLanguage } from "./language.js";
export { MESSAGES, t } from "./messages.js";
export type { MessageDictionary } from "./messages.js";
```

- [ ] **Step 6: Run the workspace build to ensure the new package compiles**

Run:

```bash
npx -y pnpm@10.0.0 build
```

Expected:
- `packages/shared-frontend/dist` is produced
- no import-resolution errors for the new workspace package

---

### Task 2: Add test-first bilingual behavior to the console

**Files:**
- Modify: `packages/console/package.json`
- Modify: `packages/console/src/__tests__/app.test.tsx`
- Modify: `packages/console/src/App.tsx`
- Test: `npx -y pnpm@10.0.0 --filter @devloop/console test`

- [ ] **Step 1: Add the shared package dependency to the console package**

Update `packages/console/package.json` dependencies:

```json
{
  "dependencies": {
    "@devloop/shared-frontend": "workspace:*",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

- [ ] **Step 2: Write the failing console language tests**

Extend `packages/console/src/__tests__/app.test.tsx` with tests that verify:

```tsx
it("defaults to browser Chinese and can switch to English while persisting the preference", async () => {
  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: "zh-CN"
  });

  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByRole("heading", { name: "DevLoop 控制台" })).toBeTruthy();

  await user.click(screen.getByRole("button", { name: "EN" }));

  expect(screen.getByRole("heading", { name: "DevLoop control console" })).toBeTruthy();
  expect(window.localStorage.getItem("devloop.language")).toBe("en-US");
});

it("localizes known execution summaries but leaves raw logs unchanged", async () => {
  vi.mocked(runAction).mockResolvedValue({
    executionId: "exec_sync",
    kind: "action",
    actionId: "sync",
    status: "passed",
    summary: "Registry synced successfully",
    logs: ["Sync started", "Registry updated"],
    startedAt: "2026-06-11T10:00:00.000Z",
    finishedAt: "2026-06-11T10:00:01.000Z"
  });

  Object.defineProperty(window.navigator, "language", {
    configurable: true,
    value: "zh-CN"
  });

  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole("button", { name: "同步项目" }));

  expect(await screen.findByText("项目状态已同步")).toBeTruthy();

  const resultsPanel = screen.getByRole("heading", { name: "最近一次运行详情" }).closest("section");
  expect(resultsPanel).toBeTruthy();

  await user.click(within(resultsPanel as HTMLElement).getByRole("button", { name: "查看日志" }));

  expect(within(resultsPanel as HTMLElement).getByText("Sync started")).toBeTruthy();
});
```

- [ ] **Step 3: Run the focused console test file and verify the new cases fail first**

Run:

```bash
npx -y pnpm@10.0.0 --filter @devloop/console test
```

Expected before implementation:
- new language-switch tests fail
- existing console tests may still pass

- [ ] **Step 4: Implement the console language switcher and dictionary-backed copy**

Update `packages/console/src/App.tsx` to:

- replace inline English strings with `t(language, "...")`
- use `useLanguage()` from `@devloop/shared-frontend`
- render a language toggle in the hero actions
- translate known action/workflow summaries from structured fields
- keep raw logs untouched

Core implementation shape:

```tsx
const { language, setLanguage } = useLanguage();

function toggleLanguage() {
  setLanguage(language === "zh-CN" ? "en-US" : "zh-CN");
}

function getActionSummary(
  language: DevLoopLanguage,
  execution: ActionExecutionResult
) {
  if (execution.actionId === "sync" && execution.status === "passed") {
    return t(language, "console.summary.sync.passed");
  }

  return execution.summary;
}
```

- [ ] **Step 5: Re-run the focused console tests and verify they pass**

Run:

```bash
npx -y pnpm@10.0.0 --filter @devloop/console test
```

Expected:
- all console tests pass
- new language tests are green

---

### Task 3: Add test-first bilingual behavior to the dashboard UI

**Files:**
- Modify: `packages/ui/package.json`
- Create: `packages/ui/src/__tests__/app.test.tsx`
- Modify: `packages/ui/src/App.tsx`
- Modify: `packages/ui/src/main.tsx`
- Test: `npx -y pnpm@10.0.0 --filter @devloop/ui test`

- [ ] **Step 1: Add the shared package dependency and a UI test script**

Update `packages/ui/package.json`:

```json
{
  "scripts": {
    "test": "vitest run --environment jsdom"
  },
  "dependencies": {
    "@devloop/shared-frontend": "workspace:*",
    "antd": "^5.28.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^29.1.1",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Write the failing dashboard language tests**

Create `packages/ui/src/__tests__/app.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api.js", () => ({
  getDashboardData: vi.fn()
}));

import App from "../App.js";
import { getDashboardData } from "../api.js";

describe("Dashboard App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("defaults to Chinese from browser settings and can switch to English", async () => {
    Object.defineProperty(window.navigator, "language", {
      configurable: true,
      value: "zh-CN"
    });

    vi.mocked(getDashboardData).mockResolvedValue(/* fixture */);
    const user = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole("heading", { name: "发布指挥台" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "EN" }));

    expect(await screen.findByRole("heading", { name: "Release Command Desk" })).toBeTruthy();
    expect(window.localStorage.getItem("devloop.language")).toBe("en-US");
  });
});
```

- [ ] **Step 3: Run the focused UI tests and verify they fail first**

Run:

```bash
npx -y pnpm@10.0.0 --filter @devloop/ui test
```

Expected before implementation:
- the new dashboard test fails because no switcher or dictionaries exist yet

- [ ] **Step 4: Implement bilingual copy in the dashboard**

Update `packages/ui/src/App.tsx` to:

- use `useLanguage()` and `t()`
- translate all page-owned text
- format timestamps using the active locale
- translate release gate and status labels
- add a top-right language switcher

Implementation shape:

```tsx
const { language, setLanguage } = useLanguage();

function toggleLanguage() {
  setLanguage(language === "zh-CN" ? "en-US" : "zh-CN");
}

function formatRelativeStamp(language: DevLoopLanguage, value: string | null) {
  if (!value) {
    return t(language, "dashboard.timestamps.none");
  }

  return formatLocaleDateTime(language, value, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
```

- [ ] **Step 5: Bind Ant Design locale in the dashboard root**

Update `packages/ui/src/main.tsx` so `ConfigProvider` uses shared language state and Ant Design locale:

```tsx
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { useLanguage } from "@devloop/shared-frontend";

function Root() {
  const { language } = useLanguage();

  return (
    <ConfigProvider locale={language === "zh-CN" ? zhCN : enUS} theme={...}>
      <App />
    </ConfigProvider>
  );
}
```

- [ ] **Step 6: Re-run the focused UI tests and verify they pass**

Run:

```bash
npx -y pnpm@10.0.0 --filter @devloop/ui test
```

Expected:
- dashboard language tests pass

---

### Task 4: Polish shared behavior, docs, and final verification

**Files:**
- Modify: `README.md`
- Possibly modify: `packages/console/src/styles.css`
- Possibly modify: `packages/ui/src/styles.css`
- Test: `npx -y pnpm@10.0.0 test`
- Test: `npx -y pnpm@10.0.0 build`

- [ ] **Step 1: Add any minimal styling needed for the switchers**

If needed, add compact switcher styles only:

```css
.language-toggle {
  display: inline-flex;
  gap: 0.5rem;
  align-items: center;
}
```

- [ ] **Step 2: Update README to document bilingual support**

Add concise usage notes covering:

- browser-language default behavior
- manual switching in console and dashboard
- shared preference across both pages

- [ ] **Step 3: Run the full test suite**

Run:

```bash
npx -y pnpm@10.0.0 test
```

Expected:
- all workspace tests pass

- [ ] **Step 4: Run the full workspace build**

Run:

```bash
npx -y pnpm@10.0.0 build
```

Expected:
- all workspace packages build successfully

- [ ] **Step 5: Smoke the built browser surfaces manually**

Run:

```bash
node packages/cli/dist/main.js
node packages/cli/dist/main.js ui --port 4310
```

Verify:
- console opens with browser-language default
- toggling language updates visible copy immediately
- dashboard uses the same stored language after refresh
- Ant Design table empty state and page copy match the active language

