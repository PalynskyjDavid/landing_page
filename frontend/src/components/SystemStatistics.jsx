import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient.js";
import { averageDuration, errorPercentage, chartPoints } from "../lib/systemStatistics.js";
import "./SystemStatistics.css";

function TrafficChart({ points, metric, label }) {
  const values = points.map((point) =>
    metric === "average" ? averageDuration(point) : point.requests,
  );
  const errors = points.map((point) => point.serverErrors);
  const maximum = Math.max(1, ...values);
  return (
    <figure className="system-chart">
      <figcaption>{label}</figcaption>
      <p className="system-chart-scale">
        Scale: 0–{Math.ceil(maximum)} {metric === "average" ? "ms" : "requests"}
      </p>
      <svg
        viewBox="0 0 800 180"
        role="img"
        aria-label={`${label} over time; exact recent values are in the table below.`}
      >
        <line x1="15" y1="160" x2="785" y2="160" className="chart-baseline" />
        <polyline points={chartPoints(values, maximum)} className="system-line" />
        {metric === "requests" && (
          <polyline points={chartPoints(errors, maximum)} className="system-line system-errors" />
        )}
      </svg>
      <div className="system-chart-dates">
        <span>{points[0]?.time.slice(0, 16).replace("T", " ")}</span>
        <span>{points.at(-1)?.time.slice(0, 16).replace("T", " ")} UTC</span>
      </div>
      {metric === "requests" && (
        <p className="statistics-note">Solid: requests · Dashed: server errors (5xx)</p>
      )}
    </figure>
  );
}

export default function SystemStatistics() {
  const [period, setPeriod] = useState("1h");
  const [route, setRoute] = useState("");
  const query = useQuery({
    queryKey: ["systemStatistics", period, route],
    queryFn: async ({ signal }) => ({
      ...(await apiClient.request({
        path: "/system/statistics",
        params: { period, route },
        signal,
      })),
      selection: { period, route },
    }),
    placeholderData: keepPreviousData,
    staleTime: 15000,
    refetchInterval: 15000,
  });
  const report = query.data;
  const fresh =
    !query.isError &&
    report?.lastCollectedAt &&
    new Date(report.generatedAt).getTime() - new Date(report.lastCollectedAt).getTime() < 30000;
  return (
    <section aria-label="System statistics">
      <h2 className="system-title">API traffic</h2>
      <p className="statistics-note">
        Anonymous NGINX request summaries, not individual visitors or raw logs. Health checks, this
        dashboard’s requests and direct debugging ports are excluded.
      </p>
      <div className="statistics-filters system-controls">
        <label>
          Time range
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="1h">Last hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
        </label>
        <label>
          API route
          <select value={route} onChange={(event) => setRoute(event.target.value)}>
            <option value="">All tracked API routes</option>
            {["/scores", "/scores/leaderboard", "/scores/statistics", "<unmatched>"].map(
              (value) => (
                <option key={value} value={value}>
                  {value === "<unmatched>" ? "Unknown API paths" : value}
                </option>
              ),
            )}
          </select>
        </label>
        <button
          className="ui-btn"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
          aria-label="Refresh system statistics"
        >
          ↻ Refresh
        </button>
      </div>
      <p role="status">
        {query.isFetching
          ? report
            ? "Previous data — refreshing…"
            : "Loading system statistics…"
          : "Refreshes every 15 seconds."}
      </p>
      {query.isError && (
        <p role="alert">System statistics are unavailable. Displayed data, if any, is stale.</p>
      )}
      {report && (
        <div aria-busy={query.isFetching} className={query.isFetching ? "statistics-stale" : ""}>
          <p className="system-freshness">
            {fresh ? "Collector reporting" : "Collection delayed or not started"} · Last report:{" "}
            {report.lastCollectedAt
              ? new Date(report.lastCollectedAt).toISOString().replace("T", " ")
              : "none"}
          </p>
          <p className="statistics-note">
            Displayed: {report.selection.period} ·{" "}
            {report.selection.route || "all tracked API routes"}. Zero means no requests recorded,
            not proven uptime. Partial time buckets and collection gaps are possible; this is
            best-effort telemetry.
          </p>
          {report.droppedEvents > 0 && (
            <p role="alert">
              At least {report.droppedEvents} telemetry events were discarded by retained collector
              instances. Graphs may be incomplete.
            </p>
          )}
          <dl className="statistics-summary" aria-label="Request summary">
            {[
              ["Requests", report.summary.requests],
              ["Server errors", report.summary.serverErrors],
              ["Server error rate", `${errorPercentage(report.summary)}%`],
              ["Average response", `${averageDuration(report.summary)} ms`],
              ["Not found (404)", report.summary.notFound],
              ["Rate limited (429)", report.summary.rateLimited],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <TrafficChart
            points={report.points}
            metric="requests"
            label="Requests and server errors"
          />
          <TrafficChart points={report.points} metric="average" label="Average response time" />
          <p className="statistics-note">
            Most recent 12 time buckets; averages are weighted by request count. Scroll the table
            horizontally on narrow screens.
          </p>
          <div
            className="statistics-table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Recent request statistics, horizontally scrollable"
          >
            <table>
              <caption>Recent request statistics</caption>
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Requests</th>
                  <th>Client errors (4xx)</th>
                  <th>Server errors (5xx)</th>
                  <th>Average</th>
                </tr>
              </thead>
              <tbody>
                {report.points
                  .slice(-12)
                  .reverse()
                  .map((point) => (
                    <tr key={point.time}>
                      <td>{point.time.slice(0, 16).replace("T", " ")}</td>
                      <td>{point.requests}</td>
                      <td>{point.clientErrors}</td>
                      <td>{point.serverErrors}</td>
                      <td>{point.requests ? `${averageDuration(point)} ms` : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
