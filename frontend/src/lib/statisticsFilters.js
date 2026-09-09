export const defaultStatisticsFilters = {
  scope: "everyone",
  period: "all",
  group: "games",
  limit: "10",
  primary: "averageMs",
  primaryDirection: "best",
  secondary: "missclicks",
  secondaryDirection: "best",
  player: "",
  from: "",
  to: "",
  minAverageMs: "",
  maxAverageMs: "",
  minBestMs: "",
  maxBestMs: "",
  minMissclicks: "",
  maxMissclicks: "",
  minGames: "1",
};

export function statisticsParams(filters) {
  const params = {
    scope: filters.scope,
    period: filters.period,
    group: filters.group,
    limit: filters.limit,
    sort: `${filters.primary}:${filters.primaryDirection},${filters.secondary}:${filters.secondaryDirection}`,
  };
  for (const name of [
    "player",
    "minAverageMs",
    "maxAverageMs",
    "minBestMs",
    "maxBestMs",
    "minMissclicks",
    "maxMissclicks",
  ]) {
    if (filters[name] !== "") params[name] = filters[name];
  }
  if (filters.group === "players") params.minGames = filters.minGames || "1";
  if (filters.period === "custom") {
    params.period = "all";
    if (filters.from) params.from = `${filters.from}T00:00:00Z`;
    if (filters.to) {
      // The UI end date is inclusive; the API uses an exclusive upper timestamp.
      const end = new Date(`${filters.to}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      params.to = end.toISOString();
    }
  }
  return params;
}
