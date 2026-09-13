import { useTranslation } from "react-i18next";
import { errorTranslationKey, formatDate, formatNumber } from "./format.js";

export function useI18n() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  return {
    t,
    i18n,
    language,
    n: (value, options) => formatNumber(value, language, options),
    date: (value) => formatDate(value, language),
    errorText: (error) => t(errorTranslationKey(error)),
  };
}
