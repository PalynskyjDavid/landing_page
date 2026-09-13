import { useI18n } from "../i18n/useI18n.js";
import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient.js";
import { averageDuration, errorPercentage, chartPoints } from "../lib/systemStatistics.js";
import "./SystemStatistics.css";

function TrafficChart({ points, metric, label }) {
  const { t, date } = useI18n();
  const values = points.map((point) =>
    metric === "average" ? averageDuration(point) : point.requests,
  );
  const errors = points.map((point) => point.serverErrors);
  const maximum = Math.max(1, ...values);
  return (
    <figure className="system-chart">
      <figcaption>{label}</figcaption>
      <p className="system-chart-scale">
        {t("Scale: 0–{{maximum}} {{unit}}", {
          maximum: Math.ceil(maximum),
          unit: metric === "average" ? "ms" : t("requests"),
        })}
      </p>
      <svg
        viewBox="0 0 800 180"
        role="img"
        aria-label={t("{{label}} over time; exact recent values are in the table below.", {
          label,
        })}
      >
        <line x1="15" y1="160" x2="785" y2="160" className="chart-baseline" />
        <polyline points={chartPoints(values, maximum)} className="system-line" />
        {metric === "requests" && (
          <polyline points={chartPoints(errors, maximum)} className="system-line system-errors" />
        )}
      </svg>
      <div className="system-chart-dates">
        <span>{date(points[0]?.time)}</span>
        <span>{date(points.at(-1)?.time)} UTC</span>
      </div>
      {metric === "requests" && (
        <p className="statistics-note">{t("Solid: requests · Dashed: server errors (5xx)")}</p>
      )}
    </figure>
  );
}

export default function SystemStatistics() {
  const { t, n, date } = useI18n();
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
    <section aria-label={t("System statistics")}>
      <h2 className="system-title">{t("API traffic")}</h2>
      <p className="statistics-note">
        {t(
          "Anonymous NGINX request summaries, not individual visitors or raw logs. Health checks, this dashboard’s requests and direct debugging ports are excluded.",
        )}
      </p>
      <div className="statistics-filters system-controls">
        <label>
          {t("Time range")}
          <select value={period} onChange={(event) => setPeriod(event.target.value)}>
            <option value="1h">{t("Last hour")}</option>
            <option value="24h">{t("Last 24 hours")}</option>
            <option value="7d">{t("Last 7 days")}</option>
          </select>
        </label>
        <label>
          {t("API route")}
          <select value={route} onChange={(event) => setRoute(event.target.value)}>
            <option value="">{t("All tracked API routes")}</option>
            {["/scores", "/scores/leaderboard", "/scores/statistics", "<unmatched>"].map(
              (value) => (
                <option key={value} value={value}>
                  {value === "<unmatched>" ? t("Unknown API paths") : value}
                </option>
              ),
            )}
          </select>
        </label>
        <button
          className="ui-btn"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
          aria-label={t("Refresh system statistics")}
        >
          {t("↻ Refresh")}
        </button>
      </div>
      <p role="status">
        {query.isFetching
          ? report
            ? t("Previous data — refreshing…")
            : t("Loading system statistics…")
          : t("Refreshes every 15 seconds.")}
      </p>
      {query.isError && (
        <p role="alert">
          {t("System statistics are unavailable. Displayed data, if any, is stale.")}
        </p>
      )}
      {report && (
        <div aria-busy={query.isFetching} className={query.isFetching ? "statistics-stale" : ""}>
          <p className="system-freshness">
            {fresh ? t("Collector reporting") : t("Collection delayed or not started")} ·{" "}
            {t("Last report:")}{" "}
            {report.lastCollectedAt ? `${date(report.lastCollectedAt)} UTC` : t("none")}
          </p>
          <p className="statistics-note">
            {t(
              "Displayed: {{period}} · {{route}}. Zero means no requests recorded, not proven uptime. Partial time buckets and collection gaps are possible; this is best-effort telemetry.",
              {
                period: { "1h": t("Last hour"), "24h": t("Last 24 hours"), "7d": t("Last 7 days") }[
                  report.selection.period
                ],
                route:
                  report.selection.route === "<unmatched>"
                    ? t("Unknown API paths")
                    : report.selection.route || t("All tracked API routes"),
              },
            )}
          </p>
          {report.droppedEvents > 0 && (
            <p role="alert">
              {t(
                "At least {{count}} telemetry events were discarded by retained collector instances. Graphs may be incomplete.",
                { count: report.droppedEvents },
              )}
            </p>
          )}
          <dl className="statistics-summary" aria-label={t("Request summary")}>
            {[
              [t("Requests"), report.summary.requests],
              [t("Server errors"), report.summary.serverErrors],
              [
                t("Server error rate"),
                n(errorPercentage(report.summary) / 100, { style: "percent" }),
              ],
              [t("Average response"), `${n(averageDuration(report.summary))} ms`],
              [t("Not found (404)"), report.summary.notFound],
              [t("Rate limited (429)"), report.summary.rateLimited],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{typeof value === "number" ? n(value) : value}</dd>
              </div>
            ))}
          </dl>
          <TrafficChart
            points={report.points}
            metric="requests"
            label={t("Requests and server errors")}
          />
          <TrafficChart
            points={report.points}
            metric="average"
            label={t("Average response time")}
          />
          <p className="statistics-note">
            {t(
              "Most recent 12 time buckets; averages are weighted by request count. Scroll the table horizontally on narrow screens.",
            )}
          </p>
          <div
            className="statistics-table-scroll"
            tabIndex={0}
            role="region"
            aria-label={t("Recent request statistics, horizontally scrollable")}
          >
            <table>
              <caption>{t("Recent request statistics")}</caption>
              <thead>
                <tr>
                  <th>{t("Time (UTC)")}</th>
                  <th>{t("Requests")}</th>
                  <th>{t("Client errors (4xx)")}</th>
                  <th>{t("Server errors (5xx)")}</th>
                  <th>{t("Average")}</th>
                </tr>
              </thead>
              <tbody>
                {report.points
                  .slice(-12)
                  .reverse()
                  .map((point) => (
                    <tr key={point.time}>
                      <td>{date(point.time)}</td>
                      <td>{n(point.requests)}</td>
                      <td>{n(point.clientErrors)}</td>
                      <td>{n(point.serverErrors)}</td>
                      <td>{point.requests ? `${n(averageDuration(point))} ms` : "—"}</td>
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
