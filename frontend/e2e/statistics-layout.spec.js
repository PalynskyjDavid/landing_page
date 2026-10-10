import { test, expect } from "./fixtures.js";
import { selectLanguage } from "./support/language.js";

// Presentation fixture only: no real lab commands or stopped containers.
test("compact reliability statistics keep details optional and safety visible", async ({
  page,
}, testInfo) => {
  let monitoringOffline = false;
  const commands = [];
  await page.route(/\/statistics(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()).replace(
        "</head>",
        '<meta name="reliability-lab" content="isolated"></head>',
      ),
    });
  });
  await page.route("**/lab-api/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname;
    const now = Date.now();
    if (endpoint.endsWith("/commands")) {
      commands.push(route.request().postData());
      return route.fulfill({ status: 403, json: { code: "test_read_only" } });
    }
    if (endpoint.endsWith("/health")) {
      if (monitoringOffline) return route.abort();
      return route.fulfill({
        json: {
          kind: "isolated-reliability-lab",
          serverTime: new Date(now).toISOString(),
          samples: Array.from({ length: 150 }, (_, i) => {
            const status = i > 70 && i < 85 ? 0 : 200;
            return {
              at: new Date(now - (149 - i) * 2000).toISOString(),
              live: { status, latencyMs: status ? 3 + (i % 5) : null },
              ready: {
                status: i > 100 && i < 110 ? 503 : status,
                latencyMs: status ? 6 + (i % 9) : null,
              },
            };
          }),
        },
      });
    }
    return route.fulfill({
      json: {
        kind: "isolated-reliability-lab",
        serverTime: new Date(now).toISOString(),
        limits: { maxStops: 3, maxReservedSeconds: 90 },
        usedStops: 0,
        reservedSeconds: 0,
        services: { api: { running: true, healthy: true }, db: { running: true, healthy: true } },
        outage: null,
        cooldownUntil: new Date(now).toISOString(),
        blockedReason: "",
        canStopTimed: true,
        canStopManual: true,
        events: [],
      },
    });
  });
  await page.goto("/statistics?view=reliability");
  const overview = page.getByRole("region", { name: "Live overview", exact: true });
  await expect(overview.getByRole("figure")).toHaveCount(2);
  await expect(overview.locator(".lab-health-readiness")).toContainText("Healthy");
  await expect(
    page.getByText("One outage at a time · auto-start in 30 / 60 s. Keep the controller running."),
  ).toBeVisible();
  const checksHint = overview.getByRole("button", {
    name: "Successful readiness checks",
    exact: true,
  });
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await checksHint.hover();
  await expect(page.getByRole("tooltip")).toContainText("Successful checks, not uptime.");
  await page.getByRole("tooltip").hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await checksHint.focus();
  await expect(checksHint).toHaveAccessibleDescription(/Successful checks, not uptime/);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("statistics-lab-compact-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await selectLanguage(page, "Čeština");
  await page.getByRole("button", { name: "Tmavý režim", exact: true }).click();
  await expect(page.getByRole("link", { name: "Zahrát si", exact: true })).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  const mobileHint = page.getByRole("button", {
    name: "Úspěšné kontroly připravenosti",
    exact: true,
  });
  await mobileHint.click();
  await expect(page.getByRole("tooltip")).toContainText("Podíl úspěšných kontrol");
  const box = await page.getByRole("tooltip").boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  await mobileHint.click();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("statistics-lab-compact-cs-mobile.png"),
    fullPage: true,
  });
  await selectLanguage(page, "English");
  await overview.getByText("Inspect recent measurements", { exact: true }).click();
  await expect(overview.getByRole("table")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  monitoringOffline = true;
  const stale = overview.getByRole("button", { name: "Stale data", exact: true });
  await expect(stale).toBeVisible();
  await stale.click();
  await expect(page.getByRole("tooltip")).toContainText("Monitor unreachable.");
  await expect(overview.locator(".lab-health-readiness")).toContainText("No recent measurement");
  await page.getByRole("heading", { name: "Live overview", exact: true }).click();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  expect(commands).toEqual([]);

  await page.route("**/api/system/statistics?**", (route) =>
    route.fulfill({
      json: {
        generatedAt: new Date().toISOString(),
        lastCollectedAt: null,
        droppedEvents: 0,
        summary: { requests: 0, serverErrors: 0, notFound: 0, rateLimited: 0, durationMs: 0 },
        points: [],
      },
    }),
  );
  await page.getByRole("link", { name: "System statistics", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No traffic data yet" })).toBeVisible();
  await expect(page.getByRole("figure")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "View live health" })).toHaveAttribute(
    "href",
    "/statistics?view=reliability",
  );
});
