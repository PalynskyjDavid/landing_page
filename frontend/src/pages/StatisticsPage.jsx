import { useI18n } from "../i18n/useI18n.js";
import { Link, useSearchParams } from "react-router-dom";
import SystemStatistics from "../components/SystemStatistics.jsx";
import ReactionLeaderboard from "../components/ReactionLeaderboard.jsx";
import ScoreDeliveryStatus from "../components/ScoreDeliveryStatus.jsx";
import ContainerLab from "../components/ContainerLab.jsx";
import { containerLabEnabled } from "../lib/containerLab.js";
import "./StatisticsPage.css";

export default function StatisticsPage() {
  const { t } = useI18n();
  const [search] = useSearchParams();
  const system = search.get("view") === "system";
  const labEnabled = containerLabEnabled();
  const reliability = labEnabled && search.get("view") === "reliability";
  const games = !system && !reliability;
  return (
    <main className="statistics-page">
      <header className="statistics-intro">
        <div>
          <h1>
            {reliability
              ? t("lab.health.title")
              : system
                ? t("System statistics")
                : t("Reaction statistics")}
          </h1>
        </div>
        <Link className="ui-btn" to="/game">
          {t("Play a game")}
        </Link>
      </header>
      <nav className="statistics-views" aria-label={t("Statistics views")}>
        <Link
          className={`ui-btn ${games ? "ui-surface-inverse" : ""}`}
          aria-current={games ? "page" : undefined}
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
        {labEnabled && (
          <Link
            className={`ui-btn ${reliability ? "ui-surface-inverse" : ""}`}
            aria-current={reliability ? "page" : undefined}
            to="?view=reliability"
          >
            {t("lab.tab")}
          </Link>
        )}
      </nav>
      <ScoreDeliveryStatus />
      {reliability ? <ContainerLab /> : system ? <SystemStatistics /> : <ReactionLeaderboard />}
    </main>
  );
}
