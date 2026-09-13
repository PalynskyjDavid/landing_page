import { useI18n } from "../../i18n/useI18n.js";
import { useTheme } from "../../hooks/useTheme";

export default function ThemeToggle() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <button
      className="ui-btn ui-surface-inverse theme-toggle"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? t("Light mode") : t("Dark mode")}
    </button>
  );
}
