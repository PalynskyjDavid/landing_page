import { useSyncExternalStore } from "react";
import { connectionSimulation } from "../lib/connectionSimulation.js";
import "./ConnectionSimulation.css";

function useSimulation() {
  return useSyncExternalStore(
    connectionSimulation.subscribe,
    connectionSimulation.getSnapshot,
    connectionSimulation.getSnapshot,
  );
}

export default function ConnectionSimulation() {
  const { enabled, persistent } = useSimulation();

  return (
    <section className="connection-lab" aria-labelledby="connection-lab-title">
      <div className="connection-lab-heading">
        <h2 id="connection-lab-title">Reliability lab</h2>
        <span className="connection-lab-state" data-active={enabled}>
          {enabled ? "Simulation active" : "Simulation off"}
        </span>
      </div>
      <p>Lose the connection, save a score, then restore it to watch your waiting scores send.</p>
      <div className="connection-lab-actions">
        <button
          type="button"
          className="ui-btn"
          disabled={enabled}
          onClick={() => connectionSimulation.setEnabled(true)}
        >
          Simulate connection loss
        </button>
        <button
          type="button"
          className="ui-btn ui-surface-inverse"
          disabled={!enabled}
          onClick={() => connectionSimulation.setEnabled(false)}
        >
          Restore connection
        </button>
      </div>
      <p className="connection-lab-note">
        Only this tab’s API requests are affected. Your computer stays online.
        {enabled && !persistent && " This browser cannot remember the switch after a refresh."}
      </p>
    </section>
  );
}

export function ConnectionSimulationBanner() {
  const { enabled } = useSimulation();

  if (!enabled) return null;

  return (
    <aside className="connection-simulation-banner" aria-label="Connection simulation">
      <p role="status">Connection loss simulation active — this tab’s API requests are blocked.</p>
      <button
        type="button"
        className="ui-btn"
        onClick={() => connectionSimulation.setEnabled(false)}
      >
        Restore connection
      </button>
    </aside>
  );
}
