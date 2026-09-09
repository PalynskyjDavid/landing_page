export default function PlayerAveragesChart({ entries }) {
  if (entries.length === 0) return null;
  const maximum = Math.max(...entries.map((entry) => entry.averageMs), 1);
  return (
    <figure className="statistics-chart" aria-labelledby="averages-title">
      <figcaption id="averages-title">Average reaction time by player</figcaption>
      <p className="statistics-note">
        Currently displayed players; average of their matching game averages. Lower is better.
      </p>
      <div className="chart-scale" aria-hidden="true">
        <span>0 ms</span>
        <span>{maximum} ms</span>
      </div>
      <ul>
        {entries.map((entry) => (
          <li key={entry.scoreId}>
            <span className="chart-player">
              {entry.displayName || `Anonymous #${entry.scoreId}`}
            </span>
            <div className="chart-track" aria-hidden="true">
              <div style={{ width: `${(entry.averageMs / maximum) * 100}%` }} />
            </div>
            <span className="chart-value">
              {entry.averageMs} ms{" "}
              <small>
                ({entry.games} {entry.games === 1 ? "game" : "games"})
              </small>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
