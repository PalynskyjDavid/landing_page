import { describe, expect, it } from "vitest";
import { buildApiUrl } from "./apiUrl.js";

describe("API URL prefixes", () => {
  it.each([
    ["http://localhost:3001", "/scores", "http://localhost:3001/scores"],
    ["https://example.test/api", "/scores", "https://example.test/api/scores"],
    ["https://example.test/api/", "scores", "https://example.test/api/scores"],
    ["/api", "/scores", "https://example.test/api/scores"],
    ["/api/", "/health/ready", "https://example.test/api/health/ready"],
  ])("joins %s and %s", (base, path, expected) => {
    expect(buildApiUrl(base, path, undefined, "https://example.test")).toBe(expected);
  });
  it("encodes query values without dropping zero/false", () => {
    const url = new URL(
      buildApiUrl(
        "/api",
        "/scores/leaderboard",
        { limit: 0, x: false, name: "A & B", omitted: null },
        "https://example.test",
      ),
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({ limit: "0", x: "false", name: "A & B" });
  });
  it.each(["../scores", "https://other.test/scores", "//other.test/scores"])(
    "rejects escaping endpoint %s",
    (path) => {
      expect(() => buildApiUrl("https://example.test/api", path)).toThrow();
    },
  );
  it.each([
    "file:///tmp/api",
    "https://user:password@example.test/api",
    "https://example.test/api?x=1",
  ])("rejects invalid base %s", (base) => {
    expect(() => buildApiUrl(base, "/scores")).toThrow();
  });
});
