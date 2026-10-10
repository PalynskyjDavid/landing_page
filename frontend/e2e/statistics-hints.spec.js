import { test, expect } from "./fixtures.js";
import { selectLanguage } from "./support/language.js";

test("statistics keep stale results and explain failures on demand", async ({
  page,
  browser,
}, testInfo) => {
  let failure = "";
  await page.route("**/api/system/statistics?**", (route) => {
    if (failure === "network") return route.abort();
    if (failure === "http")
      return route.fulfill({ status: 503, json: { error: { message: "Unavailable" } } });
    return route.fulfill({
      json: {
        generatedAt: new Date().toISOString(),
        lastCollectedAt: new Date().toISOString(),
        droppedEvents: 0,
        summary: { requests: 42, serverErrors: 0, notFound: 0, rateLimited: 0, durationMs: 420 },
        points: [],
      },
    });
  });
  await page.goto("/statistics?view=system");
  const summary = page.getByRole("definition").filter({ hasText: /^42$/ });
  await expect(summary).toBeVisible();
  failure = "http";
  await page.getByRole("button", { name: "Refresh system statistics", exact: true }).click();
  const stale = page.getByRole("button", { name: "Stale data", exact: true });
  await expect(stale).toBeVisible({ timeout: 20000 });
  await expect(summary).toBeVisible();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await stale.hover();
  await expect(page.getByRole("tooltip")).toHaveText("API returned HTTP 503. Try refreshing.");
  await page.screenshot({
    path: testInfo.outputPath("statistics-stale-tooltip.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");

  failure = "network";
  await page.getByRole("button", { name: "Refresh system statistics", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Refresh system statistics", exact: true }),
  ).toBeEnabled({ timeout: 20000 });
  await stale.focus();
  await expect(stale).toHaveAccessibleDescription("API did not respond. Try refreshing.");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  failure = "";
  await page.getByRole("button", { name: "Refresh system statistics", exact: true }).click();
  await expect(stale).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Collecting data", exact: true })).toBeVisible();

  // A real touch context: first-load failure has no old data, and no hover is required.
  const touch = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 320, height: 800 },
    hasTouch: true,
    isMobile: true,
    locale: "en-US",
  });
  try {
    const mobile = await touch.newPage();
    await mobile.route("**/api/system/statistics?**", (route) =>
      route.fulfill({ status: 403, json: {} }),
    );
    await mobile.goto("/statistics?view=system");
    await selectLanguage(mobile, "Čeština");
    const unavailable = mobile.getByRole("button", { name: "Nedostupné", exact: true });
    await unavailable.tap();
    await expect(mobile.getByRole("tooltip")).toHaveText(
      "API vrátilo chybu HTTP 403. Zkuste data obnovit.",
    );
    const box = await mobile.getByRole("tooltip").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    await unavailable.tap();
    await expect(mobile.getByRole("tooltip")).toHaveCount(0);
    await unavailable.tap();
    await mobile.getByRole("heading", { name: "Systémové statistiky", exact: true }).tap();
    await expect(mobile.getByRole("tooltip")).toHaveCount(0);
  } finally {
    await touch.close();
  }
});
