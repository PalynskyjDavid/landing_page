import { useEffect, useState } from "react";
import { useI18n } from "../i18n/useI18n.js";
import { containerLabEnabled, labRequest } from "../lib/containerLab.js";
import "./ContainerLab.css";
import LabHealth from "./LabHealth.jsx";
import InfoHint from "./InfoHint.jsx";

const reasons = {
  cooldown: "lab.reason.cooldown",
  budget_exhausted: "lab.reason.budget",
  outage_active: "lab.reason.active",
  services_not_ready: "lab.reason.unready",
  storage_unavailable: "lab.reason.storage",
  clock_changed: "lab.reason.clock",
  operation_in_progress: "lab.reason.busy",
};

function Controls() {
  const { t, language } = useI18n();
  const [snapshot, setSnapshot] = useState(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let stopped = false;
    let timer;
    let request;
    async function poll() {
      request = new AbortController();
      const timeout = setTimeout(() => request.abort(), 35000);
      try {
        const status = await labRequest(undefined, { signal: request.signal });
        if (!stopped) {
          setSnapshot(status);
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
      clearTimeout(timer);
      request?.abort();
    };
  }, []);

  async function command(action, service, mode) {
    setBusy(true);
    setMessage("");
    try {
      const status = await labRequest(
        { action, service, ...(mode ? { mode } : {}) },
        {
          signal: AbortSignal.timeout(35000),
        },
      );
      setSnapshot(status);
      setOffline(false);
    } catch (error) {
      setMessage(reasons[error.code] || "lab.reason.failed");
      // An uncertain response is not permission to repeat a stop.
      try {
        setSnapshot(await labRequest(undefined, { signal: AbortSignal.timeout(35000) }));
      } catch {
        setOffline(true);
      }
    } finally {
      setBusy(false);
    }
  }

  const secondsUntil = (value) =>
    Math.max(0, Math.ceil((Date.parse(value) - Date.parse(snapshot.serverTime)) / 1000));
  return (
    <div className="container-lab">
      <LabHealth snapshot={snapshot} statusOffline={offline} />
      <section className="container-lab-controls" aria-labelledby="container-lab-title">
        <div className="container-lab-heading">
          <h2 id="container-lab-title">{t("lab.title")}</h2>
          <InfoHint label={t("lab.local")}>{t("lab.description")}</InfoHint>
        </div>
        <p className="container-lab-note">{t("stats.labSafety")}</p>
        {!snapshot && !offline && <p role="status">{t("lab.loading")}</p>}
        {offline && (
          <div role="alert">
            <InfoHint label={t("stats.controllerOffline")} tone="error">
              {t("lab.offline")}
            </InfoHint>
          </div>
        )}
        {snapshot && (
          <>
            <div className="container-lab-budget">
              <InfoHint
                label={t("lab.budget", {
                  stops: snapshot.usedStops,
                  seconds: snapshot.reservedSeconds,
                  maxStops: snapshot.limits.maxStops,
                  maxSeconds: snapshot.limits.maxReservedSeconds,
                })}
              >
                {t("stats.budgetHint")}
              </InfoHint>
            </div>
            <div className="container-lab-services">
              {["api", "db"].map((service) => {
                const state = snapshot.services[service];
                return (
                  <div className="container-lab-service" key={service}>
                    <h3>{t(service === "api" ? "lab.api" : "lab.db")}</h3>
                    <p>
                      {t(
                        offline
                          ? "lab.health.unknown"
                          : state.healthy
                            ? "lab.healthy"
                            : state.running
                              ? "lab.starting"
                              : "lab.stopped",
                      )}
                    </p>
                    <div className="container-lab-actions">
                      <button
                        type="button"
                        className="ui-btn"
                        disabled={busy || offline || !snapshot.canStopTimed}
                        onClick={() => command("stop", service, "timed")}
                      >
                        {t("lab.stop30")}
                      </button>
                      <button
                        type="button"
                        className="ui-btn"
                        disabled={busy || offline || !snapshot.canStopManual}
                        onClick={() => command("stop", service, "manual")}
                      >
                        {t("lab.stopManual")}
                      </button>
                      <button
                        type="button"
                        className="ui-btn ui-surface-inverse"
                        disabled={busy || offline || state.healthy}
                        onClick={() => command("start", service)}
                      >
                        {t("lab.start")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div role="status" className="container-lab-status">
              {offline ? null : busy ? (
                t("lab.applying")
              ) : snapshot.outage ? (
                snapshot.outage.recovering ? (
                  t("lab.recovering")
                ) : (
                  t("lab.deadline", { seconds: secondsUntil(snapshot.outage.restoreAt) })
                )
              ) : snapshot.blockedReason === "cooldown" ? (
                t("lab.cooldown", { seconds: secondsUntil(snapshot.cooldownUntil) })
              ) : snapshot.blockedReason ? (
                <InfoHint label={t("stats.stopsPaused")} tone="warning">
                  {t(reasons[snapshot.blockedReason] || "lab.reason.failed")}
                </InfoHint>
              ) : (
                t("lab.ready")
              )}
            </div>
            <details>
              <summary>{t("lab.events")}</summary>
              <ol className="container-lab-events">
                {snapshot.events
                  .slice()
                  .reverse()
                  .map((event, index) => (
                    <li key={index}>
                      <time dateTime={event.at}>
                        {new Date(event.at).toLocaleTimeString(language)}
                      </time>
                      {" · "}
                      {t(event.service === "api" ? "lab.api" : "lab.db")}
                      {" · "}
                      {t(`lab.event.${event.action}`)}
                    </li>
                  ))}
              </ol>
            </details>
          </>
        )}
        {message && (
          <div role="alert">
            <InfoHint label={t("stats.commandUnconfirmed")} tone="error">
              {t(message)}
            </InfoHint>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ContainerLab() {
  // The independent local controller injects this marker into its HTML only.
  // The normal production build has neither controls nor background lab polling.
  return containerLabEnabled() ? <Controls /> : null;
}
