import { useI18n } from "../../i18n/useI18n.js";
import { useTheme } from "../../hooks/useTheme";

export default function ThemeToggle() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const label = theme === "dark" ? t("Light mode") : t("Dark mode");

  return (
    <button
      type="button"
      className="theme-toggle"
      data-theme={theme}
      aria-label={label}
      title={label}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
        focusable="false"
      >
        <g className="theme-sun">
          <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.18" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </g>
        <path
          className="theme-moon"
          d="M20.8 13.1A8.7 8.7 0 0 1 10.9 3.2a8.8 8.8 0 1 0 9.9 9.9Z"
          fill="currentColor"
          fillOpacity="0.15"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
