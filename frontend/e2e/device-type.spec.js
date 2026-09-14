import { selectLanguage } from "./support/language.js";
import { test, expect } from "./fixtures.js";
import { backendURL } from "./support/environment.js";

test.use({ locale: "en-GB", colorScheme: "light" });

test("header controls keep their positions across language and theme changes", async ({ page }) => {
  await page.goto("/game");
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    const controls = page.locator(".theme-toggle, .language-trigger, .shell-nav a");
    const positions = () =>
      controls.evaluateAll((elements) =>
        elements.map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return [x, y, width, height];
        }),
      );
    const original = await positions();
    for (const language of ["Čeština", "English"]) {
      await selectLanguage(page, language);
      await page.locator(".theme-toggle").click();
      await expect.poll(positions).toEqual(original);
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
});

test("device filters constrain saved games, player averages and summary", async ({ page }) => {
  expect((await page.request.get(backendURL + "/scores/leaderboard")).ok()).toBe(true);
  for (const [index, deviceType, average] of [
    [1, undefined, 300],
    [2, "computer", 200],
    [3, "mobile", 100],
  ]) {
    const response = await page.request.post(backendURL + "/scores", {
      data: {
        submissionId: "00000000-0000-4000-8000-" + String(index).padStart(12, "0"),
        times: Array(5).fill(average),
        missclicks: 0,
        displayName: "Device example",
        ...(deviceType ? { deviceType } : {}),
      },
    });
    expect(response.status()).toBe(201);
    expect((await response.json()).deviceType).toBe(deviceType ?? "computer");
  }
  await page.goto("/statistics");
  await page.getByRole("combobox", { name: "View", exact: true }).selectOption("players");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("cell", { name: "Mixed", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Device type", exact: true }).selectOption("mobile");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByRole("cell", { name: "Mobile", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "100 ms", exact: true })).toHaveCount(2);
  const summary = await page.request.get(
    backendURL + "/scores/statistics?deviceType=mobile&group=players",
  );
  expect((await summary.json()).summary).toMatchObject({ games: 1, players: 1, averageMs: 100 });
  await selectLanguage(page, "Čeština");
  await expect(page.getByRole("combobox", { name: "Typ zařízení", exact: true })).toHaveValue(
    "mobile",
  );
  await expect(page.getByRole("cell", { name: "Mobil", exact: true })).toBeVisible();
});
