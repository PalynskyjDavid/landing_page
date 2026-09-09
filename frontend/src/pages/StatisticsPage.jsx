import { Link, useSearchParams } from "react-router-dom";
import SystemStatistics from "../components/SystemStatistics.jsx";
import ReactionLeaderboard from "../components/ReactionLeaderboard.jsx";
import ScoreDeliveryStatus from "../components/ScoreDeliveryStatus.jsx";
import "./StatisticsPage.css";

export default function StatisticsPage() {
  const [search] = useSearchParams();
  const system = search.get("view") === "system";
  return (
    <main className="statistics-page">
      <header className="statistics-intro">
        <div>
          <h1>{system ? "System statistics" : "Reaction statistics"}</h1>
          <p>
            {system
              ? "Explore recorded API traffic and response times."
              : "Explore saved games or compare players. Lower reaction times are better."}
          </p>
        </div>
        <Link className="ui-btn" to="/game">
          Play a game
        </Link>
      </header>
      <nav className="statistics-views" aria-label="Statistics views">
        <Link
          className={`ui-btn ${!system ? "ui-surface-inverse" : ""}`}
          aria-current={!system ? "page" : undefined}
          to="?view=games"
        >
          Game statistics
        </Link>
        <Link
          className={`ui-btn ${system ? "ui-surface-inverse" : ""}`}
          aria-current={system ? "page" : undefined}
          to="?view=system"
        >
          System statistics
        </Link>
      </nav>
      {!system && (
        <p className="statistics-note">
          Scores are browser-reported, not verified competitive results. “My scores” uses this
          browser’s anonymous cookie, not a login.
        </p>
      )}
      <ScoreDeliveryStatus />
      {system ? <SystemStatistics /> : <ReactionLeaderboard />}
    </main>
  );
}
