export function averageDuration(counters) {
  return counters.requests ? Math.round(counters.durationMs / counters.requests) : 0;
}
export function errorPercentage(counters) {
  return counters.requests
    ? Math.round((10000 * counters.serverErrors) / counters.requests) / 100
    : 0;
}
export function chartPoints(values, maximum) {
  return values
    .map(
      (value, index) =>
        `${15 + (index * 770) / Math.max(1, values.length - 1)},${160 - (130 * value) / maximum}`,
    )
    .join(" ");
}
