import { expect } from "@playwright/test";
import { selectLanguage } from "./language.js";

export async function headerControls({ page }) {
  await page.goto("/");
  const trigger = page.locator(".language-trigger");
  const theme = page.locator(".theme-toggle");
  const menu = page.getByRole("menu");
  const english = page.getByRole("menuitemradio", { name: "English", exact: true });
  const czech = page.getByRole("menuitemradio", { name: "Čeština", exact: true });
  await expect(theme).toHaveAccessibleName("Dark mode");
  await expect(theme).toHaveText("");
  for (const control of [theme, trigger, page.locator(".shell-nav")]) {
    await expect(control).toHaveCSS("border-top-width", "2px");
    await expect(control).toHaveCSS("border-bottom-width", "2px");
  }
  await expect(theme.locator(".theme-moon")).toHaveCSS("opacity", "1");
  await theme.click();
  await expect(theme).toHaveAccessibleName("Light mode");
  await expect(theme.locator(".theme-sun")).toHaveCSS("opacity", "1");
  await expect(theme.locator(".theme-moon")).toHaveCSS("opacity", "0");
  await theme.click();

  // The glow previews each theme without changing the preference or shifting layout.
  const glow = (property) =>
    theme.evaluate((element, name) => getComputedStyle(element, "::before")[name], property);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const selectedTheme of ["light", "dark"]) {
    if ((await theme.getAttribute("data-theme")) !== selectedTheme) await theme.click();
    await trigger.focus();
    await trigger.hover();
    await expect.poll(() => glow("opacity")).toBe("0");
    const bounds = await theme.boundingBox();
    await theme.hover();
    await expect.poll(() => glow("opacity")).toBe("1");
    await expect(theme).toHaveAttribute("data-theme", selectedTheme);
    expect(await theme.boundingBox()).toEqual(bounds);
    expect(await glow("transitionDuration")).toBe("0s");
    await trigger.hover();
    await expect.poll(() => glow("opacity")).toBe("0");
    await trigger.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(theme).toBeFocused();
    await expect.poll(() => glow("opacity")).toBe("1");
  }
  await trigger.focus();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  expect(await glow("transitionDuration")).toBe("0.65s, 0.7s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await theme.click();

  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS("border-top-width", "2px");
  await expect(english).toBeFocused();
  await expect(english).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowDown");
  await expect(czech).toBeFocused();
  await page.keyboard.press("Home");
  await expect(english).toBeFocused();
  await page.keyboard.press("End");
  await expect(czech).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(czech).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAccessibleName("Jazyk: Čeština");
  await expect(trigger).toHaveText("CZ");
  await expect(trigger.locator(".language-flag")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
  await page.reload();
  await expect(trigger).toHaveAccessibleName("Jazyk: Čeština");

  await trigger.focus();
  await page.keyboard.press("Space");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(menu).toHaveCount(0);
  await expect(page.locator('.shell-nav a[href="/"]')).toBeFocused();
  await trigger.click();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(menu).toHaveCount(0);
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Shift+Tab");
  await expect(menu).toHaveCount(0);
  await expect(theme).toBeFocused();

  const positions = () =>
    page.locator(".theme-toggle, .language-trigger, .shell-nav a").evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return [x, y, width, height];
      }),
    );
  for (const width of [320, 375, 640, 768, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    const original = await positions();
    for (const language of ["English", "Čeština"]) {
      await selectLanguage(page, language);
      await theme.click();
      await expect.poll(positions).toEqual(original);
      expect(original.every((position) => position[3] >= 44)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await trigger.click();
      const bounds = await menu.boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
    }
  }
  for (const route of ["/game", "/statistics", "/"]) {
    const link = page.locator(`.shell-nav a[href="${route}"]`);
    await link.click();
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(page.locator('.shell-nav [aria-current="page"]')).toHaveCount(1);
    await expect(link).toHaveCSS("font-size", "16px");
    await link.hover();
    await expect(link).toHaveCSS("transform", "none");
  }
}
