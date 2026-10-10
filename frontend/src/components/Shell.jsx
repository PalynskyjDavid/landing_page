import { Outlet } from "react-router-dom";
import { useI18n } from "../i18n/useI18n.js";
import LanguageSwitcher from "./ui/LanguageSwitcher.jsx";
import ThemeSwitch from "./ui/ThemeToggleBtn.jsx";
import TopLink from "./ui/TopLink.jsx";
import "./ui/NavGlow.css";

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
          <nav className="shell-nav nav-glow" aria-label={t("Main navigation")}>
            <TopLink to="/" glowOrder={0}>
              {t("Home")}
            </TopLink>
            <TopLink to="/game" glowOrder={1}>
              {t("Game")}
            </TopLink>
            <TopLink to="/statistics" glowOrder={2}>
              {t("Statistics")}
            </TopLink>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
