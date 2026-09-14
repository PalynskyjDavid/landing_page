import { selectLanguage } from "./support/language.js";
import { test, expect } from "./fixtures.js";
import { backendURL } from "./support/environment.js";

test.use({ locale: "en-GB" });

test("language switching keeps the active game and queued score intact", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgentData", { value: { mobile: true } });
  });
  await page.goto("/game");
  await selectLanguage(page, "Čeština");
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
  await page.getByText("Kliknutím začněte.", { exact: true }).click();
  await selectLanguage(page, "English");
  await expect(page.getByText("Round 1 / 5", { exact: true })).toBeVisible();
  for (let round = 1; round <= 5; round++) {
    await page.getByText("Click!", { exact: true }).click();
    if (round < 5) await page.getByText(/Click for next round\./).click();
  }
  await selectLanguage(page, "Čeština");
  await expect(page.getByRole("heading", { name: "Hotovo!" })).toBeVisible();
  await page.getByLabel("Jméno v žebříčku (nepovinné)").fill("Žofie");
  await page.getByRole("button", { name: "Simulovat výpadek spojení" }).click();
  const saveWidth = (await page.locator(".score-save-button").boundingBox()).width;
  await page.getByRole("button", { name: "Uložit výsledek", exact: true }).click();
  await expect(page.getByRole("button", { name: "Čeká na odeslání" })).toBeVisible();
  await expect(page.locator(".delivery-notice-title")).toHaveText(
    "Výsledky počkají na odeslání",
    { timeout: 15000 }, // Allow the normal retry backoff to finish.
  );
  await selectLanguage(page, "English");
  await expect(page.locator(".delivery-notice-title")).toHaveText("Scores saved for later");
  await expect(page.getByLabel("Display name (optional)")).toHaveValue("Žofie");
  await expect(page.getByRole("button", { name: "Queued for delivery" })).toBeVisible();
  expect((await page.locator(".score-save-button").boundingBox()).width).toBe(saveWidth);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Restore connection", exact: true }).first().click();
  await expect(page.locator(".delivery-notice-title")).toHaveText("Previous score saved");
  const response = await page.request.get(backendURL + "/scores/statistics");
  expect(response.ok()).toBe(true);
  const result = await response.json();
  expect(result.summary.games).toBe(1);
  expect(result.entries[0].displayName).toBe("Žofie");
  expect(result.entries[0].deviceType).toBe("mobile");
});

test("Czech statistics preserve filter values and fit a narrow mobile viewport", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/statistics");
  await selectLanguage(page, "Čeština");
  await page.getByRole("combobox", { name: "Zobrazení", exact: true }).selectOption("players");
  await page.getByRole("combobox", { name: "Období", exact: true }).selectOption("7d");
  await page.getByRole("button", { name: "Použít filtry" }).click();
  await expect(
    page.getByText(
      "Pro tento výběr zatím nemáme žádné výsledky. Zkuste upravit filtry nebo si zahrajte.",
    ),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: testInfo.outputPath("statistics-cs-mobile.png"), fullPage: true });
  await selectLanguage(page, "English");
  await expect(page.getByRole("combobox", { name: "View", exact: true })).toHaveValue("players");
  await expect(page.getByRole("combobox", { name: "Period", exact: true })).toHaveValue("7d");
  await selectLanguage(page, "Čeština");
  await page.getByRole("link", { name: "Systémové statistiky", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Provoz API" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
  await expect(page.locator(".language-trigger")).toHaveAttribute("aria-label", "Jazyk: Čeština");
});

test("language and theme switches still work when preference storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await selectLanguage(page, "Čeština");
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
  await page.getByRole("button", { name: "Tmavý režim", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await selectLanguage(page, "English");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
