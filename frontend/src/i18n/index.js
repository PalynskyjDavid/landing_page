import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { translationOptions } from "./config.js";
import { normalizeLanguage, readLanguage, rememberLanguage } from "./preferences.js";

function storage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const i18n = createInstance();
i18n
  .use(initReactI18next)
  .init(translationOptions(readLanguage(storage(), navigator.languages ?? [navigator.language])));

function applyLanguage(language) {
  const supported = normalizeLanguage(language) ?? "en";
  document.documentElement.lang = supported;
  document.title = i18n.t("David Palynskyj | Reaction game");
  rememberLanguage(storage(), supported);
}
applyLanguage(i18n.resolvedLanguage);
i18n.on("languageChanged", applyLanguage);
if (import.meta.hot) import.meta.hot.dispose(() => i18n.off("languageChanged", applyLanguage));
export default i18n;
