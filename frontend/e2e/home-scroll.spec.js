import { test, expect } from "./fixtures.js";
import { selectLanguage } from "./support/language.js";

test("home sections scroll smoothly without trapping mobile, keyboard or reduced-motion users", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "smooth");
  // Chromium serializes the default proximity value as just "y".
  await expect(page.locator("html")).toHaveCSS("scroll-snap-type", /^y( proximity)?$/);
  await expect(page.locator(".home-section")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "Technical skills", exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.homeScrollSamples = [];
    addEventListener("scroll", () => window.homeScrollSamples.push(scrollY));
  });
  await page.getByRole("link", { name: "Contact", exact: true }).click();
  await expect(page).toHaveURL(/#contact$/);
  await expect(page.locator("#contact")).toBeInViewport();
  await expect
    .poll(() => page.evaluate(() => new Set(window.homeScrollSamples).size))
    .toBeGreaterThan(2);
  await expect(page.locator("#contact")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator('#contact a[href^="mailto:"]')).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("home-contact-mobile.png"), fullPage: true });
  await page.reload();
  await expect(page.locator("#contact")).toBeInViewport();
  await page
    .locator("#flowento")
    .evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "start" }));
  await page.mouse.move(180, 400);
  await page.mouse.wheel(0, 730);
  await expect
    .poll(() =>
      page
        .locator("#hand-controller")
        .evaluate((el) =>
          Math.abs(
            el.getBoundingClientRect().top -
              parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) -
              parseFloat(getComputedStyle(el).scrollMarginTop),
          ),
        ),
    )
    .toBeLessThan(3);

  // A tall skills block stays readable; snapping is never mandatory.
  await page.setViewportSize({ width: 320, height: 568 });
  await selectLanguage(page, "Čeština");
  await page.getByRole("button", { name: "Tmavý režim", exact: true }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
  await expect(page.locator("html")).toHaveCSS("scroll-snap-type", "none");
  await page.locator("#skills").scrollIntoViewIfNeeded();
  for (const block of await page.locator(".home-section").all()) {
    expect(await block.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("home-sections-cs-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Více o Flowento", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/flowento$/);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("html")).toHaveCSS("scroll-snap-type", "none");
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
});
