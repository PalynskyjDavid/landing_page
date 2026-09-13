export const LANGUAGE_STORAGE_KEY = "reactionGame.language";

export function normalizeLanguage(value) {
  if (typeof value !== "string") return null;
  const language = value.toLowerCase().split("-")[0];
  return language === "en" || language === "cs" ? language : null;
}

export function readLanguage(storage, languages = []) {
  try {
    const saved = normalizeLanguage(storage?.getItem(LANGUAGE_STORAGE_KEY));
    if (saved) return saved;
  } catch {
    /* A blocked storage area must not prevent using the site. */
  }
  return languages.map(normalizeLanguage).find(Boolean) ?? "en";
}

export function rememberLanguage(storage, language) {
  const supported = normalizeLanguage(language);
  if (!supported) return;
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, supported);
  } catch {
    /* Session-only selection. */
  }
}
