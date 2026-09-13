import { useI18n } from "../i18n/useI18n.js";
import { Link, useSearchParams } from "react-router-dom";
import SystemStatistics from "../components/SystemStatistics.jsx";
import ReactionLeaderboard from "../components/ReactionLeaderboard.jsx";
import ScoreDeliveryStatus from "../components/ScoreDeliveryStatus.jsx";
import "./StatisticsPage.css";

export default function StatisticsPage() {
  const { t } = useI18n();
  const [search] = useSearchParams();
  const system = search.get("view") === "system";
  return (
    <main className="statistics-page">
      <header className="statistics-intro">
        <div>
          <h1>{system ? t("System statistics") : t("Reaction statistics")}</h1>
          <p>
            {system
              ? t("Explore recorded API traffic and response times.")
              : t("Explore saved games or compare players. Lower reaction times are better.")}
          </p>
        </div>
        <Link className="ui-btn" to="/game">
          {t("Play a game")}
        </Link>
      </header>
      <nav className="statistics-views" aria-label={t("Statistics views")}>
        <Link
          className={`ui-btn ${!system ? "ui-surface-inverse" : ""}`}
          aria-current={!system ? "page" : undefined}
          to="?view=games"
        >
          {t("Game statistics")}
        </Link>
        <Link
          className={`ui-btn ${system ? "ui-surface-inverse" : ""}`}
          aria-current={system ? "page" : undefined}
          to="?view=system"
        >
          {t("System statistics")}
        </Link>
      </nav>
      {!system && (
        <p className="statistics-note">
          {t(
            "Scores are browser-reported, not verified competitive results. “My scores” uses this browser’s anonymous cookie, not a login.",
          )}
        </p>
      )}
      <ScoreDeliveryStatus />
      {system ? <SystemStatistics /> : <ReactionLeaderboard />}
    </main>
  );
}
