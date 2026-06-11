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

  return {
    language,
    setLanguage
  };
}

export function formatLocaleDateTime(
  language: DevLoopLanguage,
  value: string,
  options: Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat(language, options).format(new Date(value));
}
