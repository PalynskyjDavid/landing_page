import { useEffect, useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import { labHealthRequest } from "../lib/containerLab.js";
import { availabilitySegments, healthView, latencySeries, probeState } from "../lib/labHealth.js";
import "./LabHealth.css";
import InfoHint from "./InfoHint.jsx";

function State({ state, children }) {
  const { t } = useI18n();
  return (
    <span className={`lab-health-state is-${state}`}>
      <i aria-hidden="true" />
      {children || t(`lab.health.${state}`)}
    </span>
  );
}

export default function LabHealth({ snapshot, statusOffline }) {
  const { t, n, language } = useI18n();
  const [history, setHistory] = useState(null);
  const [offline, setOffline] = useState(false);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    let stopped = false;
    let timer;
    let request;
    const clockTimer = setInterval(() => setClock(Date.now()), 1000);
    async function poll() {
      request = new AbortController();
      const timeout = setTimeout(() => request.abort(), 4000);
      try {
        const payload = await labHealthRequest({ signal: request.signal });
        if (!stopped) {
          setHistory({ payload, receivedAt: Date.now() });
          setClock(Date.now());
          setOffline(false);
        }
      } catch {
        if (!stopped) setOffline(true);
      } finally {
        clearTimeout(timeout);
        if (!stopped) timer = setTimeout(poll, 2000);
      }
    }
    void poll();
    return () => {
      stopped = true;
      request?.abort();
      clearTimeout(timer);
      clearInterval(clockTimer);
    };
  }, []);

  // Use the controller's clock for chart coordinates, not the PC clock offset.
  const now = history
    ? Date.parse(history.payload.serverTime) + Math.max(0, clock - history.receivedAt)
    : clock;
  const view = healthView(history?.payload.samples, now);
  const connected = Boolean(history && !offline && clock - history.receivedAt < 6000);
  const fresh = connected && view.fresh;
  const dbFresh =
    connected && !statusOffline && snapshot && now - Date.parse(snapshot.serverTime) < 8000;
  const db = snapshot?.services.db;
  const dbState = !dbFresh
    ? "unknown"
    : db.healthy
      ? "healthy"
      : db.running
        ? "unhealthy"
        : "unreachable";
  const state = (key) => (fresh ? probeState(view.last[key]) : "unknown");
  const time = (value) => new Date(value).toLocaleTimeString(language, { hour12: false });
  const latency = (probe) =>
    probe?.status > 0 && Number.isFinite(probe.latencyMs)
      ? `${n(probe.latencyMs, { maximumFractionDigits: 1 })} ms`
      : t("lab.health.noResponse");
  const endpoint = (key) => t(key === "live" ? "lab.health.live" : "lab.health.ready");

  return (
    <section className="lab-health" aria-labelledby="lab-health-title">
      <div className="container-lab-heading">
        <h2 id="lab-health-title">{t("lab.health.overview")}</h2>
        <div role="status">
          <InfoHint
            label={t(offline ? "stats.stale" : connected ? "stats.live" : "stats.waiting")}
            tone={offline ? "warning" : connected ? "success" : "neutral"}
          >
            {t(offline ? "stats.monitorOffline" : "lab.health.sampling")}
          </InfoHint>
        </div>
      </div>
      <ol className="lab-health-flow" aria-label={t("lab.health.dependencies")}>
        <li>
          <strong>{t("lab.health.controller")}</strong>
          <State state={connected ? "healthy" : "unknown"} />
        </li>
        <li>
          <strong>API</strong>
          <State state={state("live")} />
        </li>
        <li>
          <strong>{t("lab.db")}</strong>
          <State state={dbState}>
            {t(
              !dbFresh
                ? "lab.health.unknown"
                : db.healthy
                  ? "lab.healthy"
                  : db.running
                    ? "lab.starting"
                    : "lab.stopped",
            )}
          </State>
        </li>
      </ol>
      <div className="lab-health-readiness">
        <div>
          <strong>{t("lab.health.ready")}</strong>
          <InfoHint label={t("lab.health.ready")} iconOnly>
            {t("lab.health.readyHint")}
          </InfoHint>
        </div>
        <State state={state("ready")} />
      </div>
      <dl className="lab-health-metrics">
        <div>
          <dt>
            {t("lab.health.success")}{" "}
            <InfoHint label={t("lab.health.success")} iconOnly>
              {t("stats.checksHint")}
            </InfoHint>
          </dt>
          <dd>
            {view.percent === null ? "—" : `${n(view.percent, { maximumFractionDigits: 1 })}%`}
          </dd>
          <small>
            {t("lab.health.checks", { count: view.samples.length, passed: view.successes })}
          </small>
        </div>
        {["live", "ready"].map((key) => (
          <div key={key}>
            <dt>{endpoint(key)}</dt>
            <dd>{fresh ? latency(view.last[key]) : "—"}</dd>
          </div>
        ))}
      </dl>

      <figure className="lab-health-chart">
        <figcaption>
          {t("lab.health.availability")}{" "}
          <InfoHint label={t("lab.health.availability")} iconOnly>
            {t("stats.healthSource")}
          </InfoHint>
        </figcaption>
        <p className="lab-health-muted">{t("stats.lastFiveMinutes")}</p>
        {["live", "ready"].map((key) => (
          <div className="lab-health-lane" key={key}>
            <span>{endpoint(key)}</span>
            <svg
              viewBox="0 0 100 12"
              preserveAspectRatio="none"
              role="img"
              aria-label={t("lab.health.lane", { endpoint: endpoint(key) })}
            >
              <rect width="100" height="12" className="lab-health-empty" />
              {availabilitySegments(view.samples, key, now).map(
                ({ x, width, state: sampleState, sample }) => (
                  <rect
                    key={sample.at}
                    x={x}
                    width={width}
                    height="12"
                    className={`lab-health-bar is-${sampleState}`}
                  >
                    <title>
                      {time(sample.at)} · {t(`lab.health.${sampleState}`)} ·{" "}
                      {sample[key].status || t("lab.health.noResponse")}
                    </title>
                  </rect>
                ),
              )}
            </svg>
          </div>
        ))}
        <div className="lab-health-axis">
          <span>{time(view.start)}</span>
          <span>{time(now)}</span>
        </div>
        <div className="lab-health-legend">
          {["healthy", "unhealthy", "unreachable", "unknown"].map((value) => (
            <State key={value} state={value} />
          ))}
        </div>
      </figure>

      <figure className="lab-health-chart">
        <figcaption>
          {t("lab.health.latency")}{" "}
          <InfoHint label={t("lab.health.latency")} iconOnly>
            {t("lab.health.latencyHint")}
          </InfoHint>
        </figcaption>
        <p className="lab-health-muted">{t("stats.lastFiveMinutes")}</p>
        <div className="lab-health-plot">
          <div className="lab-health-y">
            <span>{n(view.ceiling)} ms</span>
            <span>0 ms</span>
          </div>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label={t("lab.health.latency")}
          >
            {[6, 50, 94].map((y) => (
              <line key={y} x1="0" x2="100" y1={y} y2={y} className="lab-health-grid" />
            ))}
            {["live", "ready"].map((key) =>
              latencySeries(view.samples, key, now, view.ceiling).map((line, i) => (
                <g key={`${key}-${i}`} className={`lab-health-line ${key}`}>
                  <polyline
                    points={line.map(({ x, y }) => `${x},${y}`).join(" ")}
                    vectorEffect="non-scaling-stroke"
                  />
                  {line.length === 1 && (
                    <line
                      x1={line[0].x}
                      x2={line[0].x}
                      y1={line[0].y - 1}
                      y2={line[0].y + 1}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              )),
            )}
          </svg>
        </div>
        <div className="lab-health-axis">
          <span>{time(view.start)}</span>
          <span>{time(now)}</span>
        </div>
        <div className="lab-health-legend">
          <span className="lab-health-key live">{endpoint("live")}</span>
          <span className="lab-health-key ready">{endpoint("ready")}</span>
        </div>
        {!view.samples.length && <p>{t("lab.health.empty")}</p>}
      </figure>
      <details className="lab-health-details">
        <summary>{t("lab.health.samples")}</summary>
        <div
          className="statistics-table-scroll"
          tabIndex={0}
          role="region"
          aria-label={t("lab.health.samples")}
        >
          <table>
            <caption>{t("lab.health.sampleHint")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("lab.health.time")}</th>
                <th scope="col">{endpoint("live")}</th>
                <th scope="col">{endpoint("ready")}</th>
              </tr>
            </thead>
            <tbody>
              {view.samples
                .slice(-10)
                .reverse()
                .map((sample) => (
                  <tr key={sample.at}>
                    <th scope="row">{time(sample.at)}</th>
                    {["live", "ready"].map((key) => (
                      <td key={key}>
                        {sample[key].status
                          ? `HTTP ${sample[key].status} · ${latency(sample[key])}`
                          : t("lab.health.noResponse")}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
