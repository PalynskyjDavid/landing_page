import { Outlet } from "react-router-dom";
import { useI18n } from "../i18n/useI18n.js";
import LanguageSwitcher from "./ui/LanguageSwitcher.jsx";
import ThemeSwitch from "./ui/ThemeToggleBtn.jsx";
import TopLink from "./ui/TopLink.jsx";

export default function Shell() {
  const { t } = useI18n();
  return (
    <div className="shell-div">
      <header className="shell-header">
        <div className="shell-header-inner">
          <div className="shell-controls">
            <ThemeSwitch />
            <LanguageSwitcher />
          </div>
          <nav className="shell-nav" aria-label={t("Main navigation")}>
            <TopLink to="/">{t("Home")}</TopLink>
            <TopLink to="/game">{t("Game")}</TopLink>
            <TopLink to="/statistics">{t("Statistics")}</TopLink>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
