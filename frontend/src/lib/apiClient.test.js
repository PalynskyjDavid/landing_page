import { describe, expect, it, vi, afterEach } from "vitest";
import { parseRetryAfter, request } from "./apiClient.js";

afterEach(() => vi.unstubAllGlobals());

describe("Retry-After", () => {
  it("parses seconds and HTTP dates while rejecting malformed values", () => {
    expect(parseRetryAfter("5")).toBe(5000);
    expect(
      parseRetryAfter("Wed, 09 Sep 2026 12:00:05 GMT", Date.parse("2026-09-09T12:00:00Z")),
    ).toBe(5000);
    for (const value of [null, "", "-1", "junk", "Infinity", "999999999999999999999"])
      expect(parseRetryAfter(value)).toBeNull();
  });
  it("preserves 429 and the cooldown on normalized errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "rate_limited", message: "Wait." } }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": "5" },
        }),
      ),
    );
    await expect(request({ method: "POST", path: "/scores", data: {} })).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
      isRetryable: true,
      retryAfterMs: 5000,
    });
  });
});
