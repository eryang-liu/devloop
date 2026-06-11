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
export {
  getLanguageToggleLabel,
  MESSAGES,
  t,
  translateConsoleActionSummary,
  translateConsoleIterationStatus,
  translateConsoleWorkflowSummary,
  translateDashboardConfidence,
  translateDashboardFeatureStatus,
  translateDashboardMode,
  translateDashboardRequirement,
  translateDashboardRunStatus,
  translateDashboardScope
} from "./messages.js";
export type { MessageDictionary } from "./messages.js";
