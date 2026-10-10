import { describe, expect, it } from "vitest";
import { availabilitySegments, healthView, latencySeries, probeState } from "./labHealth.js";

const now = Date.parse("2026-10-03T12:00:00Z");
const sample = (age, status = 200, latencyMs = 5) => ({
  at: new Date(now - age).toISOString(),
  live: { status, latencyMs },
  ready: { status, latencyMs },
});

describe("lab health presentation", () => {
  it("keeps HTTP failure, unreachable and unknown distinct", () => {
    expect(probeState()).toBe("unknown");
    expect(probeState({ status: 0 })).toBe("unreachable");
    expect(probeState({ status: 503 })).toBe("unhealthy");
    expect(probeState({ status: 200 })).toBe("healthy");
  });
  it("uses measured checks, not invented uptime or expired samples", () => {
    const view = healthView([sample(310000), sample(4000), sample(2000, 503, 1000)], now);
    expect(view.samples).toHaveLength(2);
    expect(view.successes).toBe(1);
    expect(view.percent).toBe(50);
    expect(view.ceiling).toBe(1000);
    expect(view.fresh).toBe(true);
    expect(healthView([sample(8000)], now).fresh).toBe(false);
    expect(healthView([], now).percent).toBeNull();
  });
  it("does not backfill history or bridge pauses in sampling", () => {
    const segments = availabilitySegments([sample(20000), sample(2000)], "live", now);
    expect(segments[0].x).toBeGreaterThan(90);
    expect(segments[0].width).toBe(2); // 6 s maximum / 300 s
    expect(segments[1].width).toBeCloseTo(2 / 3);
  });
  it("shows zero-ms HTTP responses but no-response gaps, including after resuming", () => {
    const lines = latencySeries(
      [sample(20000), sample(18000, 0, null), sample(16000, 200, 0), sample(2000, 503, 10)],
      "ready",
      now,
      10,
    );
    expect(lines).toHaveLength(3);
    expect(lines[1][0].y).toBe(94);
    expect(lines[2][0].y).toBe(6);
  });
});
