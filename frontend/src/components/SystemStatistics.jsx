import { useI18n } from "../i18n/useI18n.js";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient.js";
import { containerLabEnabled } from "../lib/containerLab.js";
import { averageDuration, errorPercentage, chartPoints } from "../lib/systemStatistics.js";
import "./SystemStatistics.css";
import InfoHint from "./InfoHint.jsx";

function TrafficChart({ points, metric, label }) {
  const { t, n, date } = useI18n();
  const values = points.map((point) =>
    metric === "average" ? averageDuration(point) : point.requests,
  );
  const errors = points.map((point) => point.serverErrors);
  const maximum = Math.max(1, ...values);
  return (
    <figure className="system-chart">
      <div className="statistics-card-heading">
        <figcaption>{label}</figcaption>
        <span className="statistics-note">
          0–{n(Math.ceil(maximum))} {metric === "average" ? "ms" : t("requests")}
        </span>
      </div>
      <svg
        viewBox="0 0 800 180"
        role="img"
        aria-label={t("{{label}} over time; exact recent values are in the table below.", {
          label,
        })}
      >
        {[30, 95, 160].map((y) => (
          <line key={y} x1="15" y1={y} x2="785" y2={y} className="chart-baseline" />
        ))}
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
        <div className="system-legend">
          <span>{t("Requests")}</span>
          <span>{t("Server errors (5xx)")}</span>
        </div>
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
  const noCollection = report && !report.lastCollectedAt && report.summary.requests === 0;
  const periodName = (value) =>
    ({ "1h": t("Last hour"), "24h": t("Last 24 hours"), "7d": t("Last 7 days") })[value];
  const routeName = (value) =>
    value === "<unmatched>" ? t("Unknown API paths") : value || t("All tracked API routes");
  return (
    <section className="system-statistics" aria-label={t("System statistics")}>
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
                  {routeName(value)}
                </option>
              ),
            )}
          </select>
        </label>
        <button
          className="ui-btn statistics-icon-button"
          type="button"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
          aria-label={t("Refresh system statistics")}
          title={t("Refresh system statistics")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M20 7v5h-5M4 17v-5h5" />
            <path d="M5.1 8a8 8 0 0 1 13-2L20 8M4 16l1.9 2A8 8 0 0 0 19 16" />
          </svg>
        </button>
      </div>
      <div className="statistics-toolbar-status" role="status">
        <InfoHint
          label={t(
            query.isError
              ? report
                ? "stats.stale"
                : "stats.unavailable"
              : query.isFetching
                ? "Refreshing…"
                : fresh
                  ? "stats.collecting"
                  : "stats.noRecentData",
          )}
          tone={query.isError ? "warning" : fresh ? "success" : "neutral"}
        >
          {query.isError
            ? t(query.error?.status ? "stats.httpFailure" : "stats.noResponse", {
                status: query.error?.status,
              })
            : query.isFetching
              ? t("stats.refreshHint")
              : t("stats.collectionHint")}
        </InfoHint>
        <InfoHint label={t("stats.aboutData")} iconOnly>
          {t("stats.trafficHint")}
        </InfoHint>
      </div>
      {report && (
        <div
          aria-busy={query.isFetching}
          className={query.isFetching || query.isError ? "statistics-stale" : ""}
        >
          <p className="statistics-selection">
            {periodName(report.selection.period)} · {routeName(report.selection.route)}
          </p>
          {report.droppedEvents > 0 && (
            <div role="status">
              <InfoHint label={t("stats.incomplete")} tone="warning">
                {t("stats.dropped", { count: report.droppedEvents })}
              </InfoHint>
            </div>
          )}
          {noCollection ? (
            <div className="statistics-empty">
              <span className="statistics-empty-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 32 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M5 5v22h23M11 21v-5M18 21V9M25 21V4" />
                </svg>
              </span>
              <h2>
                {t("stats.noTraffic")}{" "}
                <InfoHint label={t("stats.noTraffic")} iconOnly>
                  {t(containerLabEnabled() ? "stats.labTraffic" : "stats.waitingTraffic")}
                </InfoHint>
              </h2>
              {containerLabEnabled() && (
                <Link className="ui-btn" to="?view=reliability">
                  {t("stats.viewHealth")}
                </Link>
              )}
            </div>
          ) : (
            <>
              <dl className="statistics-summary system-summary" aria-label={t("Request summary")}>
                {[
                  [t("Requests"), n(report.summary.requests)],
                  [
                    t("Average response"),
                    report.summary.requests ? `${n(averageDuration(report.summary))} ms` : "—",
                  ],
                  [t("Server errors"), n(report.summary.serverErrors)],
                  [
                    t("Server error rate"),
                    report.summary.requests
                      ? n(errorPercentage(report.summary) / 100, { style: "percent" })
                      : "—",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <dl className="system-secondary">
                <div>
                  <dt>{t("Not found (404)")}</dt>
                  <dd>{n(report.summary.notFound)}</dd>
                </div>
                <div>
                  <dt>{t("Rate limited (429)")}</dt>
                  <dd>{n(report.summary.rateLimited)}</dd>
                </div>
              </dl>
              <div className="statistics-chart-grid">
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
              </div>
              <details className="statistics-details">
                <summary>{t("Recent request statistics")}</summary>
                <div
                  className="statistics-table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={t("Recent request statistics, horizontally scrollable")}
                >
                  <table>
                    <caption>{t("stats.recentBuckets")}</caption>
                    <thead>
                      <tr>
                        {[
                          "Time (UTC)",
                          "Requests",
                          "Client errors (4xx)",
                          "Server errors (5xx)",
                          "Average",
                        ].map((label) => (
                          <th scope="col" key={label}>
                            {t(label)}
                          </th>
                        ))}
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
              </details>
            </>
          )}
        </div>
      )}
      {report?.lastCollectedAt && (
        <p className="statistics-note">
          {t("Last report:")} {date(report.lastCollectedAt)} UTC
        </p>
      )}
    </section>
  );
}
