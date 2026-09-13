import { useI18n } from "../../i18n/useI18n.js";

export default function LanguageSwitcher() {
  const { t, i18n, language } = useI18n();
  return (
    <div className="language-switcher" role="group" aria-label={t("Language")}>
      {[
        { code: "en", label: "EN", name: "English" },
        { code: "cs", label: "CZ", name: "Čeština" },
      ].map(({ code, label, name }) => (
        <button
          key={code}
          type="button"
          className="ui-btn"
          lang={code}
          aria-label={name}
          title={name}
          aria-pressed={language === code}
          onClick={() => void i18n.changeLanguage(code)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
