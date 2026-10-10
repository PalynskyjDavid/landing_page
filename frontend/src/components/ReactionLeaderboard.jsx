import { useI18n } from "../i18n/useI18n.js";
import { useState } from "react";
import { useStatsQuery } from "../hooks/useStatsQuery.js";
import { defaultStatisticsFilters, statisticsParams } from "../lib/statisticsFilters.js";
import PlayerAveragesChart from "./PlayerAveragesChart.jsx";
import InfoHint from "./InfoHint.jsx";
import ScoreCards from "./ScoreCards.jsx";

const columns = [
  ["averageMs", "Average"],
  ["bestMs", "Best reaction"],
  ["missclicks", "Misclicks"],
  ["games", "Games played"],
  ["createdAt", "Date"],
];
const ranges = [
  ["Average reaction (ms)", "minAverageMs", "maxAverageMs"],
  ["Best reaction (ms)", "minBestMs", "maxBestMs"],
  ["Misclicks per game", "minMissclicks", "maxMissclicks"],
];

export default function ReactionLeaderboard() {
  const { t, n, date } = useI18n();
  const [draft, setDraft] = useState(defaultStatisticsFilters);
  const [applied, setApplied] = useState(defaultStatisticsFilters);
  const stats = useStatsQuery(statisticsParams(applied));
  const stale = (stats.isFetching || stats.isError) && stats.data !== undefined;
  const displayed = stats.data?.selection ?? statisticsParams(applied);
  const grouped = displayed.group === "players";
  const entries = stats.data?.entries ?? [];
  const summary = stats.data?.summary;
  const change = (field, value) =>
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "primary" && value === current.secondary) next.secondary = current.primary;
      if (field === "secondary" && value === current.primary) next.primary = current.secondary;
      return next;
    });
  const apply = (event) => {
    event.preventDefault();
    setApplied({ ...draft });
  };
  const heading = (field, label) => {
    const order = displayed.sort.split(",").map((pair) => pair.split(":"));
    const priority = order.findIndex(([column]) => column === field);
    if (priority >= 0)
      return `${priority + 1}. ${label} ${order[priority][1] === "best" ? "↑" : "↓"}`;
    return label;
  };

  return (
    <section aria-label={t("Score statistics")}>
      <form className="statistics-filters" onSubmit={apply}>
        <div className="statistics-filter-grid">
          <label>
            {t("View")}
            <select value={draft.group} onChange={(e) => change("group", e.target.value)}>
              <option value="games">{t("Individual games")}</option>
              <option value="players">{t("Grouped by player")}</option>
            </select>
          </label>
          <label>
            {t("Players")}
            <select value={draft.scope} onChange={(e) => change("scope", e.target.value)}>
              <option value="everyone">{t("Everyone")}</option>
              <option value="mine">{t("My scores")}</option>
            </select>
          </label>
          <label>
            {t("Device type")}
            <select value={draft.deviceType} onChange={(e) => change("deviceType", e.target.value)}>
              <option value="">{t("All devices")}</option>
              <option value="computer">{t("Computer")}</option>
              <option value="mobile">{t("Mobile")}</option>
            </select>
          </label>
          <label>
            {t("Period")}
            <select value={draft.period} onChange={(e) => change("period", e.target.value)}>
              <option value="all">{t("All time")}</option>
              <option value="7d">{t("Last 7 days")}</option>
              <option value="30d">{t("Last 30 days")}</option>
              <option value="custom">{t("Custom dates (UTC)")}</option>
            </select>
          </label>
          <label>
            {t("Show")}
            <select value={draft.limit} onChange={(e) => change("limit", e.target.value)}>
              {[5, 10, 20].map((limit) => (
                <option key={limit} value={limit}>
                  {t("Top {{count}}", { count: limit })}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Player name")}
            <input
              maxLength={24}
              value={draft.player}
              onChange={(e) => change("player", e.target.value)}
              placeholder={t("Contains…")}
            />
          </label>
          {draft.group === "players" && (
            <label>
              {t("Minimum games per player")}
              <input
                type="number"
                min="1"
                max="1000000"
                value={draft.minGames}
                onChange={(e) => change("minGames", e.target.value)}
              />
            </label>
          )}
          {draft.period === "custom" && (
            <>
              <label>
                {t("From date (UTC)")}
                <input
                  type="date"
                  value={draft.from}
                  onChange={(e) => change("from", e.target.value)}
                />
              </label>
              <label>
                {t("Through date (UTC)")}
                <input
                  type="date"
                  value={draft.to}
                  onChange={(e) => change("to", e.target.value)}
                />
              </label>
            </>
          )}
        </div>
        <details className="statistics-sort-details">
          <summary>{t("stats.sorting")}</summary>
          <div className="statistics-sort-grid">
            {["primary", "secondary"].map((level, index) => (
              <fieldset key={level}>
                <legend>{t("Sort {{level}}", { level: index + 1 })}</legend>
                <label>
                  {t("Column")}
                  <select value={draft[level]} onChange={(e) => change(level, e.target.value)}>
                    {columns.map(([value, label]) => (
                      <option key={value} value={value}>
                        {t(label)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Order")}
                  <select
                    value={draft[`${level}Direction`]}
                    onChange={(e) => change(`${level}Direction`, e.target.value)}
                  >
                    <option value="best">{t("Lowest / oldest first")}</option>
                    <option value="worst">{t("Highest / newest first")}</option>
                  </select>
                </label>
              </fieldset>
            ))}
          </div>
        </details>
        <details>
          <summary>{t("Reaction time and misclick ranges")}</summary>
          <p className="statistics-note">
            {t("Ranges filter individual games before player averages are calculated.")}
          </p>
          <div className="statistics-filter-grid">
            {ranges.map(([label, minimum, maximum]) => (
              <fieldset key={minimum}>
                <legend>{t(label)}</legend>
                <label>
                  {t("Minimum")}
                  <input
                    aria-label={t("Minimum {{label}}", { label: t(label) })}
                    type="number"
                    min="0"
                    max="2147483647"
                    value={draft[minimum]}
                    onChange={(e) => change(minimum, e.target.value)}
                  />
                </label>
                <label>
                  {t("Maximum")}
                  <input
                    aria-label={t("Maximum {{label}}", { label: t(label) })}
                    type="number"
                    min="0"
                    max="2147483647"
                    value={draft[maximum]}
                    onChange={(e) => change(maximum, e.target.value)}
                  />
                </label>
              </fieldset>
            ))}
          </div>
        </details>
        <div className="statistics-actions">
          <button className="ui-btn ui-surface-inverse" type="submit">
            {t("Apply filters")}
          </button>
          <button
            className="ui-btn"
            type="button"
            onClick={() => {
              setDraft(defaultStatisticsFilters);
              setApplied(defaultStatisticsFilters);
            }}
          >
            {t("Reset filters")}
          </button>
          {JSON.stringify(draft) !== JSON.stringify(applied) && (
            <span className="statistics-note" role="status">
              {t("stats.pendingFilters")}
            </span>
          )}
        </div>
      </form>

      <div className="statistics-results-header">
        <h2>{t("Leaderboard")}</h2>
        <button
          className="ui-btn statistics-refresh"
          type="button"
          aria-label={t("Refresh leaderboard")}
          disabled={stats.isFetching}
          onClick={() => stats.refetch()}
        >
          <span aria-hidden="true">↻</span> {stats.isFetching ? t("Refreshing…") : t("Refresh")}
        </button>
      </div>
      <div className="statistics-toolbar-status" role="status">
        <div>
          {(stats.isError || stats.isFetching) && (
            <InfoHint
              label={t(
                stats.isError ? (stats.data ? "stats.stale" : "stats.unavailable") : "Refreshing…",
              )}
              tone={stats.isError ? "warning" : "neutral"}
            >
              {stats.isError
                ? t(stats.error?.status ? "stats.httpFailure" : "stats.noResponse", {
                    status: stats.error?.status,
                  })
                : t(stats.isPlaceholderData ? "stats.previousHint" : "stats.refreshHint")}
            </InfoHint>
          )}
        </div>
        <InfoHint label={t("stats.aboutData")} iconOnly>
          {t("stats.scoresHint")}
        </InfoHint>
      </div>
      {stats.data && (
        <div aria-busy={stats.isFetching} className={stale ? "statistics-stale" : ""}>
          <dl className="statistics-summary" aria-label={t("Filtered summary")}>
            {[
              [t("Matching games"), summary.games],
              [t("Players"), summary.players],
              [t("Average game"), summary.averageMs === null ? "—" : `${n(summary.averageMs)} ms`],
              [
                t("Best game average"),
                summary.bestAverageMs === null ? "—" : `${n(summary.bestAverageMs)} ms`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{typeof value === "number" ? n(value) : value}</dd>
              </div>
            ))}
          </dl>
          {entries.length === 0 ? (
            <p>{t("No scores match these filters. Play a game or widen the filters.")}</p>
          ) : (
            <>
              {grouped && <PlayerAveragesChart entries={entries} />}
              <ScoreCards
                entries={entries}
                grouped={grouped}
                limit={displayed.limit}
                heading={heading}
              />
              <div className="statistics-table-scroll statistics-desktop-results">
                <table>
                  <caption>
                    {grouped ? t("Players ranked using their matching games") : t("Matching games")}{" "}
                    — {t("Top {{count}}", { count: displayed.limit })}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{t("Rank")}</th>
                      <th scope="col">{t("Player")}</th>
                      <th scope="col">{t("Device type")}</th>
                      <th scope="col">{heading("averageMs", t("Average"))}</th>
                      <th scope="col">{heading("bestMs", t("Best"))}</th>
                      <th scope="col">
                        {heading("missclicks", grouped ? t("Misclicks/game") : t("Misclicks"))}
                      </th>
                      {grouped && <th scope="col">{heading("games", t("Games"))}</th>}
                      <th scope="col">
                        {heading("createdAt", grouped ? t("Latest game") : t("Saved at"))} (UTC)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.scoreId}>
                        <td>{n(entry.rank)}</td>
                        <td>
                          {entry.displayName ||
                            (grouped
                              ? t("Anonymous #{{id}}", { id: String(entry.scoreId) })
                              : t("Anonymous"))}
                        </td>
                        <td>
                          {entry.deviceType === "mobile"
                            ? t("Mobile")
                            : entry.deviceType === "mixed"
                              ? t("Mixed")
                              : t("Computer")}
                        </td>
                        <td>{n(entry.averageMs)} ms</td>
                        <td>{n(entry.bestMs)} ms</td>
                        <td>{n(entry.missclicks)}</td>
                        {grouped && <td>{n(entry.games)}</td>}
                        <td>
                          <time dateTime={entry.createdAt}>{date(entry.createdAt)}</time>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
