import { useState } from "react";
import { useStatsQuery } from "../hooks/useStatsQuery.js";
import { defaultStatisticsFilters, statisticsParams } from "../lib/statisticsFilters.js";
import PlayerAveragesChart from "./PlayerAveragesChart.jsx";

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
  const [draft, setDraft] = useState(defaultStatisticsFilters);
  const [applied, setApplied] = useState(defaultStatisticsFilters);
  const stats = useStatsQuery(statisticsParams(applied));
  const stale = stats.isFetching && stats.data !== undefined;
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
    <section aria-label="Score statistics">
      <form className="statistics-filters" onSubmit={apply}>
        <div className="statistics-filter-grid">
          <label>
            View
            <select value={draft.group} onChange={(e) => change("group", e.target.value)}>
              <option value="games">Individual games</option>
              <option value="players">Grouped by player</option>
            </select>
          </label>
          <label>
            Players
            <select value={draft.scope} onChange={(e) => change("scope", e.target.value)}>
              <option value="everyone">Everyone</option>
              <option value="mine">My scores</option>
            </select>
          </label>
          <label>
            Period
            <select value={draft.period} onChange={(e) => change("period", e.target.value)}>
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom dates (UTC)</option>
            </select>
          </label>
          <label>
            Show
            <select value={draft.limit} onChange={(e) => change("limit", e.target.value)}>
              {[5, 10, 20].map((limit) => (
                <option key={limit} value={limit}>
                  Top {limit}
                </option>
              ))}
            </select>
          </label>
          <label>
            Player name
            <input
              maxLength={24}
              value={draft.player}
              onChange={(e) => change("player", e.target.value)}
              placeholder="Contains…"
            />
          </label>
          {draft.group === "players" && (
            <label>
              Minimum games per player
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
                From date (UTC)
                <input
                  type="date"
                  value={draft.from}
                  onChange={(e) => change("from", e.target.value)}
                />
              </label>
              <label>
                Through date (UTC)
                <input
                  type="date"
                  value={draft.to}
                  onChange={(e) => change("to", e.target.value)}
                />
              </label>
            </>
          )}
        </div>
        <div className="statistics-sort-grid">
          {["primary", "secondary"].map((level, index) => (
            <fieldset key={level}>
              <legend>Sort {index + 1}</legend>
              <label>
                Column
                <select value={draft[level]} onChange={(e) => change(level, e.target.value)}>
                  {columns.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Order
                <select
                  value={draft[`${level}Direction`]}
                  onChange={(e) => change(`${level}Direction`, e.target.value)}
                >
                  <option value="best">Lowest / oldest first</option>
                  <option value="worst">Highest / newest first</option>
                </select>
              </label>
            </fieldset>
          ))}
        </div>
        <details>
          <summary>Reaction time and misclick ranges</summary>
          <p className="statistics-note">
            Ranges filter individual games before player averages are calculated.
          </p>
          <div className="statistics-filter-grid">
            {ranges.map(([label, minimum, maximum]) => (
              <fieldset key={minimum}>
                <legend>{label}</legend>
                <label>
                  Minimum
                  <input
                    aria-label={`Minimum ${label}`}
                    type="number"
                    min="0"
                    max="2147483647"
                    value={draft[minimum]}
                    onChange={(e) => change(minimum, e.target.value)}
                  />
                </label>
                <label>
                  Maximum
                  <input
                    aria-label={`Maximum ${label}`}
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
            Apply filters
          </button>
          <button
            className="ui-btn"
            type="button"
            onClick={() => {
              setDraft(defaultStatisticsFilters);
              setApplied(defaultStatisticsFilters);
            }}
          >
            Reset filters
          </button>
          <span className="statistics-note">Apply sends one request for the selected filters.</span>
        </div>
      </form>

      <div className="statistics-results-header">
        <h2>Leaderboard</h2>
        <button
          className="ui-btn"
          type="button"
          aria-label="Refresh leaderboard"
          disabled={stats.isFetching}
          onClick={() => stats.refetch()}
        >
          <span aria-hidden="true">↻</span> {stats.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="statistics-status" role="status">
        {stats.isPlaceholderData
          ? "Previous selection — refreshing…"
          : stale
            ? "Stale data — refreshing…"
            : stats.isFetching
              ? "Loading statistics…"
              : ""}
      </p>
      {stats.isError && <p role="alert">Could not load statistics: {stats.error.message}</p>}
      {stats.data && (
        <div aria-busy={stale} className={stale ? "statistics-stale" : ""}>
          <dl className="statistics-summary" aria-label="Filtered summary">
            {[
              ["Matching games", summary.games],
              ["Players", summary.players],
              ["Average game", summary.averageMs === null ? "—" : `${summary.averageMs} ms`],
              [
                "Best game average",
                summary.bestAverageMs === null ? "—" : `${summary.bestAverageMs} ms`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="statistics-note">
            Summary covers all matching games, not just the displayed Top {displayed.limit}.{" "}
            {grouped
              ? "Each row is one player; misclicks are averaged per game."
              : "Each row is one five-round game."}
          </p>
          {entries.length === 0 ? (
            <p>No scores match these filters. Play a game or widen the filters.</p>
          ) : (
            <>
              {grouped && <PlayerAveragesChart entries={entries} />}
              <div className="statistics-table-scroll">
                <table>
                  <caption>
                    {grouped ? "Players ranked using their matching games" : "Matching games"} — Top{" "}
                    {displayed.limit}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Player</th>
                      <th scope="col">{heading("averageMs", "Average")}</th>
                      <th scope="col">{heading("bestMs", "Best")}</th>
                      <th scope="col">
                        {heading("missclicks", grouped ? "Misclicks/game" : "Misclicks")}
                      </th>
                      {grouped && <th scope="col">{heading("games", "Games")}</th>}
                      <th scope="col">
                        {heading("createdAt", grouped ? "Latest game" : "Saved at")} (UTC)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.scoreId}>
                        <td>{entry.rank}</td>
                        <td>
                          {entry.displayName ||
                            (grouped ? `Anonymous #${entry.scoreId}` : "Anonymous")}
                        </td>
                        <td>{entry.averageMs} ms</td>
                        <td>{entry.bestMs} ms</td>
                        <td>{Number(entry.missclicks.toFixed(2))}</td>
                        {grouped && <td>{entry.games}</td>}
                        <td>
                          <time dateTime={entry.createdAt}>
                            {new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                          </time>
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
