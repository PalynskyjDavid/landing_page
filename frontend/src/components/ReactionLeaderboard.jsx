import { useState } from "react";
import { useLeaderboardQuery } from "../hooks/useLeaderboardQuery.js";

const DEFAULT_LEADERBOARD_LIMIT = 10;
const LEADERBOARD_LIMITS = [5, 10, 20];

const SORT_FIELDS = [
  { value: "averageMs", label: "Average" },
  { value: "bestMs", label: "Best reaction" },
  { value: "missclicks", label: "Misclicks" },
];

const SORT_DIRECTIONS = [
  { value: "best", label: "Best" },
  { value: "worst", label: "Worst" },
];

const INITIAL_SORT = {
  primary: { field: "averageMs", direction: "best" },
  secondary: { field: "missclicks", direction: "best" },
};

export default function ReactionLeaderboard() {
  const [sort, setSort] = useState(INITIAL_SORT);
  const [limit, setLimit] = useState(DEFAULT_LEADERBOARD_LIMIT);
  const leaderboard = useLeaderboardQuery(limit, [sort.primary, sort.secondary]);
  const isShowingStaleData = leaderboard.isFetching && leaderboard.data !== undefined;

  const changeSortField = (level, field) => {
    setSort((current) => {
      const otherLevel = level === "primary" ? "secondary" : "primary";

      if (field === current[otherLevel].field) {
        return {
          ...current,
          [level]: { ...current[level], field },
          [otherLevel]: { ...current[otherLevel], field: current[level].field },
        };
      }

      return {
        ...current,
        [level]: { ...current[level], field },
      };
    });
  };

  const changeSortDirection = (level, direction) => {
    setSort((current) => ({
      ...current,
      [level]: { ...current[level], direction },
    }));
  };

  const columnHeading = (field, label) => {
    if (sort.primary.field === field) {
      return `1. ${label} ${sort.primary.direction === "best" ? "↑" : "↓"}`;
    }
    if (sort.secondary.field === field) {
      return `2. ${label} ${sort.secondary.direction === "best" ? "↑" : "↓"}`;
    }

    return label;
  };

  return (
    <section className="mx-auto my-[2dvh] w-[98%] max-w-[600px]">
      <div className="relative flex min-h-9 items-center justify-center">
        <h2 className="text-center">Leaderboard</h2>

        <button
          type="button"
          className="absolute right-0 rounded p-2 text-[rgb(var(--fg))] transition-colors hover:bg-[rgb(var(--muted))] disabled:cursor-wait disabled:opacity-60"
          aria-label={isShowingStaleData ? "Refreshing leaderboard" : "Refresh leaderboard"}
          title={isShowingStaleData ? "Refreshing leaderboard" : "Refresh leaderboard"}
          disabled={leaderboard.isFetching}
          onClick={() => leaderboard.refetch()}
        >
          <svg
            aria-hidden="true"
            className={`h-5 w-5 ${leaderboard.isFetching ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>
      </div>

      <p className="min-h-5 text-center text-sm" aria-live="polite">
        {isShowingStaleData ? "Stale data — refreshing…" : ""}
      </p>

      <div className="flex flex-col gap-3 my-3" aria-label="Leaderboard sorting">
        <label className="flex items-center justify-end gap-2">
          <span>Show</span>
          <select
            className="w-24 rounded border border-transparent bg-[rgb(var(--bg))] px-2 py-1 text-[rgb(var(--fg))] transition-colors hover:border-[rgb(var(--border))] focus:border-[rgb(var(--border))]"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            {LEADERBOARD_LIMITS.map((option) => (
              <option key={option} value={option}>
                Top {option}
              </option>
            ))}
          </select>
        </label>

        {[
          { level: "primary", priority: 1 },
          { level: "secondary", priority: 2 },
        ].map(({ level, priority }) => (
          <div key={level} className="grid grid-cols-[2rem_10rem_1fr] items-center gap-3">
            <strong className="text-right">{priority}.</strong>

            <label className="flex items-center justify-between gap-2">
              <span>Order</span>
              <select
                className="w-24 rounded border border-transparent bg-[rgb(var(--bg))] px-2 py-1 text-[rgb(var(--fg))] transition-colors hover:border-[rgb(var(--border))] focus:border-[rgb(var(--border))]"
                value={sort[level].direction}
                onChange={(event) => changeSortDirection(level, event.target.value)}
              >
                {SORT_DIRECTIONS.map((direction) => (
                  <option key={direction.value} value={direction.value}>
                    {direction.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span>Column</span>
              <select
                className="w-36 rounded border border-transparent bg-[rgb(var(--bg))] px-2 py-1 text-[rgb(var(--fg))] transition-colors hover:border-[rgb(var(--border))] focus:border-[rgb(var(--border))]"
                value={sort[level].field}
                onChange={(event) => changeSortField(level, event.target.value)}
              >
                {SORT_FIELDS.map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </div>

      {leaderboard.isPending && <p className="min-h-32">Loading leaderboard...</p>}

      {leaderboard.isError && (
        <p role="alert">Could not load leaderboard: {leaderboard.error.message}</p>
      )}

      {leaderboard.isSuccess && leaderboard.data.entries.length === 0 && (
        <p>No scores yet. Finish a game to become the first entry.</p>
      )}

      {leaderboard.isSuccess && leaderboard.data.entries.length > 0 && (
        <div
          className={`overflow-x-auto transition-opacity ${isShowingStaleData ? "opacity-60" : "opacity-100"}`}
          aria-busy={isShowingStaleData}
        >
          <table className="w-full table-fixed">
            <thead>
              <tr>
                <th className="w-[12%]" scope="col">
                  Rank
                </th>
                <th className="w-[24%]" scope="col">
                  Player
                </th>
                <th className="w-[22%]" scope="col">
                  {columnHeading("averageMs", "Average")}
                </th>
                <th className="w-[20%]" scope="col">
                  {columnHeading("bestMs", "Best")}
                </th>
                <th className="w-[22%]" scope="col">
                  {columnHeading("missclicks", "Misclicks")}
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.data.entries.map((entry) => (
                <tr key={entry.scoreId}>
                  <td>{entry.rank}</td>
                  <td>{entry.displayName || "Anonymous"}</td>
                  <td>{entry.averageMs} ms</td>
                  <td>{entry.bestMs} ms</td>
                  <td>{entry.missclicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
