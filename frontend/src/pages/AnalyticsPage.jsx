import { useStatsQuery } from "../hooks/useStatsQuery.js";

export default function AnalyticsPage() {
  const { data, error, isLoading, isFetching, isError, refetch, dataUpdatedAt } = useStatsQuery();
  const lastUpdatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : "No cached result yet.";

  return (
    <section className="py-12">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-[var(--fs-h2)] font-semibold">Dev Analytics</h2>

        <div className="mt-6 rounded-xl border border-[rgb(var(--fg))] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">Events summary</p>
              <p className="text-sm text-[rgb(var(--muted-fg))]">
                {isFetching
                  ? "Refreshing analytics summary..."
                  : `Last updated: ${lastUpdatedLabel}`}
              </p>
            </div>

            <button className="ui-btn ui-surface-inverse" onClick={() => refetch()}>
              Refresh
            </button>
          </div>

          {isLoading ? (
            <p className="mt-4 text-[rgb(var(--muted-fg))]">Loading analytics summary...</p>
          ) : null}

          {isError ? (
            <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
              <p className="font-medium text-red-700 dark:text-red-300">
                Unable to load analytics summary.
              </p>
              <p className="mt-1 text-sm text-red-700/80 dark:text-red-300/80">{error.message}</p>
            </div>
          ) : null}

          {!isLoading && !isError ? (
            <div className="mt-4">
              <p className="text-sm text-[rgb(var(--muted-fg))]">
                TanStack Query keeps this result in memory for 30 seconds before it becomes stale.
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-black/5 p-4 text-sm dark:bg-white/5">
                {JSON.stringify(data ?? { message: "No analytics data returned yet." }, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
