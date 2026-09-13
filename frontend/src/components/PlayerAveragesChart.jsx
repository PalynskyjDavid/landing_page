import { useI18n } from "../i18n/useI18n.js";
export default function PlayerAveragesChart({ entries }) {
  const { t, n } = useI18n();
  if (entries.length === 0) return null;
  const maximum = Math.max(...entries.map((entry) => entry.averageMs), 1);
  return (
    <figure className="statistics-chart" aria-labelledby="averages-title">
      <figcaption id="averages-title">{t("Average reaction time by player")}</figcaption>
      <p className="statistics-note">
        {t(
          "Currently displayed players; average of their matching game averages. Lower is better.",
        )}
      </p>
      <div className="chart-scale" aria-hidden="true">
        <span>0 ms</span>
        <span>{n(maximum)} ms</span>
      </div>
      <ul>
        {entries.map((entry) => (
          <li key={entry.scoreId}>
            <span className="chart-player">
              {entry.displayName || t("Anonymous #{{id}}", { id: String(entry.scoreId) })}
            </span>
            <div className="chart-track" aria-hidden="true">
              <div style={{ width: `${(entry.averageMs / maximum) * 100}%` }} />
            </div>
            <span className="chart-value">
              {n(entry.averageMs)} ms <small>({t("gamesCount", { count: entry.games })})</small>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
