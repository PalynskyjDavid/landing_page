import { expect, it } from "vitest";
import { averageDuration, errorPercentage, chartPoints } from "./systemStatistics.js";
it("uses request-weighted timing totals and handles empty buckets", () => {
  expect(averageDuration({ requests: 4, durationMs: 1000 })).toBe(250);
  expect(averageDuration({ requests: 0, durationMs: 0 })).toBe(0);
  expect(errorPercentage({ requests: 3, serverErrors: 1 })).toBe(33.33);
  expect(errorPercentage({ requests: 0, serverErrors: 0 })).toBe(0);
});
it("maps chart values onto a finite shared scale", () => {
  expect(chartPoints([0, 5, 10], 10)).toBe("15,160 400,95 785,30");
  expect(chartPoints([0], 1)).toBe("15,160");
});
