import { useI18n } from "../i18n/useI18n.js";

export default function ScoreCards({ entries, grouped, limit, heading }) {
  const { t, n, date } = useI18n();
  return (
    <section className="statistics-mobile-results" aria-label={t("Matching games")}>
      <h3>
        {grouped ? t("Players ranked using their matching games") : t("Matching games")} —{" "}
        {t("Top {{count}}", { count: limit })}
      </h3>
      <ol className="score-cards">
        {entries.map((entry) => (
          <li key={entry.scoreId}>
            <div className="score-card-heading">
              <span className="score-card-rank" aria-label={`${t("Rank")} ${n(entry.rank)}`}>
                #{n(entry.rank)}
              </span>
              <strong>
                {entry.displayName ||
                  (grouped
                    ? t("Anonymous #{{id}}", { id: String(entry.scoreId) })
                    : t("Anonymous"))}
              </strong>
              <span className="score-card-device">
                {t(
                  entry.deviceType === "mobile"
                    ? "Mobile"
                    : entry.deviceType === "mixed"
                      ? "Mixed"
                      : "Computer",
                )}
              </span>
            </div>
            <dl>
              <div>
                <dt>{heading("averageMs", t("Average"))}</dt>
                <dd>{n(entry.averageMs)} ms</dd>
              </div>
              <div>
                <dt>{heading("bestMs", t("Best"))}</dt>
                <dd>{n(entry.bestMs)} ms</dd>
              </div>
              <div>
                <dt>{heading("missclicks", grouped ? t("Misclicks/game") : t("Misclicks"))}</dt>
                <dd>{n(entry.missclicks)}</dd>
              </div>
              {grouped && (
                <div>
                  <dt>{heading("games", t("Games"))}</dt>
                  <dd>{n(entry.games)}</dd>
                </div>
              )}
            </dl>
            <p className="score-card-date">
              {heading("createdAt", grouped ? t("Latest game") : t("Saved at"))}
              <time dateTime={entry.createdAt}>{date(entry.createdAt)} UTC</time>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
