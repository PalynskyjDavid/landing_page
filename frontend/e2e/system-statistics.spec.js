import { test, expect } from "./fixtures.js";
import { backendURL } from "./support/environment.js";
import { database, compose } from "./support/database.js";
import { backend } from "./support/backend.js";

test("system statistics buffer an outage, count edge errors and expose no request details", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const token = process.env.E2E_RUN_TOKEN;
  const read = async (route = "") => {
    const response = await page.request.get(
      `${backendURL}/system/statistics?period=1h&route=${encodeURIComponent(route)}`,
    );
    expect(response.status()).toBe(200);
    return response.json();
  };
  await expect
    .poll(async () => (await read()).lastCollectedAt, { intervals: [1000] })
    .not.toBeNull();
  expect(
    (
      await page.request.get(
        `${backendURL}/scores/leaderboard?private_query=PRIVATE_QUERY_SENTINEL`,
      )
    ).status(),
  ).toBe(200);
  expect((await page.request.get(`${backendURL}/nonexistent-one`)).status()).toBe(404);
  await expect.poll(async () => (await read()).summary.requests, { intervals: [1000] }).toBe(2);
  try {
    database("stop", token);
    expect((await page.request.get(`${backendURL}/nonexistent-two`)).status()).toBe(404);
    expect((await page.request.get(`${backendURL}/nonexistent-three`)).status()).toBe(404);
    backend("stop", token);
    expect((await page.request.get(`${backendURL}/scores/leaderboard`)).status()).toBe(503);
    // Wait for a failed collector flush, not an arbitrary sleep.
    await expect
      .poll(
        () => compose(["logs", "--no-log-prefix", "--tail", "30", "collector"], { capture: true }),
        { intervals: [1000], timeout: 15000 },
      )
      .toContain("telemetry flush delayed");
  } finally {
    database("up", token);
    backend("up", token);
  }
  await expect
    .poll(async () => (await read()).summary.requests, { intervals: [1000], timeout: 20000 })
    .toBe(5);
  const report = await read();
  expect(report.summary).toMatchObject({ requests: 5, notFound: 3, serverErrors: 1 });
  expect((await read("<unmatched>")).summary.requests).toBe(3);
  expect(report.points).toHaveLength(61);
  expect(JSON.stringify(report)).not.toMatch(
    /PRIVATE_QUERY_SENTINEL|nonexistent|request_id|cookie|peer|playerId/,
  );
  const logs = compose(["logs", "--no-log-prefix", "--tail", "200", "web"], { capture: true });
  const access = logs
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.event === "edge_request");
  expect(access.some((entry) => entry.path === "/api/nonexistent-one")).toBe(true);
  expect(JSON.stringify(access)).not.toContain("PRIVATE_QUERY_SENTINEL");
  const apiLogs = compose(["logs", "--no-log-prefix", "--tail", "200", "api"], { capture: true });
  const edgeRequest = access.find((entry) => entry.path === "/api/nonexistent-one");
  expect(apiLogs).toContain(edgeRequest.request_id);

  let attempts = 0;
  for (; attempts < 25;) {
    const result = await page.request.post(`${backendURL}/scores`, { data: {} });
    attempts++;
    if (result.status() === 429) break;
    expect(result.status()).toBe(400);
  }
  expect(attempts).toBeLessThan(25);
  await expect
    .poll(async () => (await read()).summary.requests, { intervals: [1000], timeout: 20000 })
    .toBe(5 + attempts);
  expect((await read()).summary.rateLimited).toBeGreaterThan(0);

  await page.goto("/statistics?view=system");
  await expect(page.getByRole("heading", { name: "System statistics", exact: true })).toBeVisible();
  await expect(page.getByText("Collector reporting", { exact: false })).toBeVisible();
  await expect(page.getByRole("figure")).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath("system-statistics-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("combobox", { name: "API route", exact: true }).selectOption("<unmatched>");
  await expect(page.getByText("Displayed: 1h · <unmatched>.", { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("system-statistics-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  // Theme colors transition for 200ms; inspect the settled state, not a mid-transition frame.
  await expect(page.getByRole("link", { name: "System statistics", exact: true })).toHaveCSS(
    "color",
    "rgb(0, 0, 0)",
  );
  await expect(page.getByRole("link", { name: "Play a game", exact: true })).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await page.screenshot({
    path: testInfo.outputPath("system-statistics-dark.png"),
    fullPage: true,
  });
});
