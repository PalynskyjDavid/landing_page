import { describe, expect, it } from "vitest";
import { defaultStatisticsFilters, statisticsParams } from "./statisticsFilters.js";

describe("statistics filter requests", () => {
  it("keeps values server-side and excludes irrelevant grouping/date inputs", () => {
    expect(
      statisticsParams({
        ...defaultStatisticsFilters,
        player: "Alice",
        minAverageMs: "100",
        from: "2026-01-01",
        minGames: "20",
      }),
    ).toEqual({
      scope: "everyone",
      period: "all",
      group: "games",
      limit: "10",
      sort: "averageMs:best,missclicks:best",
      player: "Alice",
      minAverageMs: "100",
    });
  });
  it("uses UTC date bounds with an exclusive following day", () => {
    expect(
      statisticsParams({
        ...defaultStatisticsFilters,
        group: "players",
        minGames: "2",
        period: "custom",
        from: "2026-09-01",
        to: "2026-09-09",
      }),
    ).toMatchObject({
      group: "players",
      minGames: "2",
      period: "all",
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-10T00:00:00.000Z",
    });
  });
});
