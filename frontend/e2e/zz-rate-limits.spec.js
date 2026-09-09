import { test, expect } from "./fixtures.js";
import { backendURL } from "./support/environment.js";
import { web } from "./support/web.js";
import { finishGame } from "./support/game.js";

test("a real edge burst is limited even with new cookies and spoofed forwarding headers", async ({
  page,
}) => {
  // Reset only NGINX's in-memory quota, not data; this test owns the stack lock.
  web("stop", process.env.E2E_RUN_TOKEN);
  web("up", process.env.E2E_RUN_TOKEN);
  try {
    const oversized = await page.request.post(`${backendURL}/scores`, {
      data: { displayName: "x".repeat(9000) },
    });
    expect(oversized.status()).toBe(413);
    expect(await oversized.json()).toMatchObject({ error: { code: "request_too_large" } });
    let limited;
    for (let i = 0; i < 30; i++) {
      const result = await page.request.post(`${backendURL}/scores`, {
        data: {},
        headers: {
          Cookie: `reaction_player_id=00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          "X-Forwarded-For": `198.51.100.${i + 1}`,
          "X-Real-IP": `203.0.113.${i + 1}`,
        },
      });
      if (result.status() === 429) {
        limited = result;
        break;
      }
      expect(result.status()).toBe(400);
    }
    expect(limited, "The edge must reject a burst before it reaches storage").toBeTruthy();
    expect(limited.headers()["retry-after"]).toBe("5");
    expect(await limited.json()).toMatchObject({ error: { code: "rate_limited" } });
    const repeat = await page.request.post(`${backendURL}/scores`, { data: {} });
    expect(repeat.status()).toBe(429);
    // The browser UI stays available; no Docker-control endpoint is exposed.
    expect((await page.request.get("/healthz")).status()).toBe(200);
  } finally {
    web("stop", process.env.E2E_RUN_TOKEN);
    web("up", process.env.E2E_RUN_TOKEN);
  }
});

test("a 429 cooldown survives navigation and reload, then saves the same queued score once", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/game");
  await finishGame(page);
  await page.getByLabel("Display name (optional)").fill("Cooldown player");
  let attempts = 0;
  let firstAttemptAt;
  let submission;
  await page.route(`${backendURL}/scores`, async (route) => {
    const payload = route.request().postDataJSON();
    attempts++;
    if (attempts === 1) {
      firstAttemptAt = Date.now();
      submission = payload;
      await route.fulfill({
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "5" },
        body: JSON.stringify({ error: { code: "rate_limited", message: "Wait." } }),
      });
      return;
    }
    expect(Date.now() - firstAttemptAt).toBeGreaterThanOrEqual(4900);
    expect(payload).toEqual(submission);
    await route.continue();
  });
  await page.getByRole("button", { name: "Save score", exact: true }).click();
  await expect(
    page.getByText(
      "Saving is paused by the rate limit. Your queued scores will retry automatically.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "View statistics and leaderboard" }).click();
  await page.reload();
  await expect(
    page.getByText(
      "Saving is paused by the rate limit. Your queued scores will retry automatically.",
    ),
  ).toBeVisible();
  expect(attempts).toBe(1);
  await expect(page.getByRole("cell", { name: "Cooldown player", exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  const result = await page.request.get(`${backendURL}/scores/leaderboard`);
  expect((await result.json()).entries).toHaveLength(1);
});
