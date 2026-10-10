export const HEALTH_WINDOW_MS = 300000;
export const HEALTH_GAP_MS = 6000;

export function probeState(probe) {
  if (!probe) return "unknown";
  if (probe.status === 200) return "healthy";
  return probe.status > 0 ? "unhealthy" : "unreachable";
}

export function healthView(samples = [], now) {
  const start = now - HEALTH_WINDOW_MS;
  const visible = samples.filter((sample) => {
    const at = Date.parse(sample.at);
    return at >= start && at <= now;
  });
  const last = visible.at(-1);
  const fresh = Boolean(last && now - Date.parse(last.at) <= HEALTH_GAP_MS);
  const successes = visible.filter((sample) => sample.ready.status === 200).length;
  const values = visible.flatMap((sample) =>
    [sample.live, sample.ready].flatMap((probe) =>
      probe.status > 0 && Number.isFinite(probe.latencyMs) ? [probe.latencyMs] : [],
    ),
  );
  return {
    start,
    samples: visible,
    last,
    fresh,
    successes,
    percent: visible.length ? (successes / visible.length) * 100 : null,
    ceiling: Math.max(10, Math.ceil(Math.max(0, ...values) / 10) * 10),
  };
}

// Coordinates are percentages of the fixed five-minute window. Missing samples
// remain gaps; we never fill earlier history or extend a result indefinitely.
export function availabilitySegments(samples, key, now) {
  const start = now - HEALTH_WINDOW_MS;
  return samples.map((sample, index) => {
    const at = Date.parse(sample.at);
    const end = Math.min(Date.parse(samples[index + 1]?.at) || now, at + HEALTH_GAP_MS, now);
    return {
      x: ((at - start) / HEALTH_WINDOW_MS) * 100,
      width: Math.max(0, ((end - at) / HEALTH_WINDOW_MS) * 100),
      state: probeState(sample[key]),
      sample,
    };
  });
}

export function latencySeries(samples, key, now, ceiling) {
  const lines = [];
  let line = [];
  let previousAt;
  for (const sample of samples) {
    const at = Date.parse(sample.at);
    const probe = sample[key];
    if (!probe.status || !Number.isFinite(probe.latencyMs)) {
      if (line.length) lines.push(line);
      line = [];
      previousAt = undefined;
      continue;
    }
    if (previousAt && at - previousAt > HEALTH_GAP_MS) {
      if (line.length) lines.push(line);
      line = [];
    }
    line.push({
      x: ((at - (now - HEALTH_WINDOW_MS)) / HEALTH_WINDOW_MS) * 100,
      y: 94 - (probe.latencyMs / ceiling) * 88,
    });
    previousAt = at;
  }
  if (line.length) lines.push(line);
  return lines;
}
