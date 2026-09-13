import en from "./locales/en.json";
import cs from "./locales/cs.json";
import { formatNumber } from "./format.js";

export const resources = { en: { translation: en }, cs: { translation: cs } };

export function translationOptions(language = "en") {
  return {
    resources,
    lng: language,
    fallbackLng: "en",
    supportedLngs: ["en", "cs"],
    // Readable English source keys; dots and colons are ordinary text, not paths.
    keySeparator: false,
    nsSeparator: false,
    initAsync: false,
    returnEmptyString: false,
    interpolation: {
      escapeValue: false, // React escapes the resulting text; do not inject HTML.
      alwaysFormat: true,
      format: (value, _format, lng) =>
        typeof value === "number" ? formatNumber(value, lng) : value,
    },
    react: { useSuspense: false }, // Both small catalogs are bundled, including offline.
  };
}
