import { expect } from "@playwright/test";

export async function selectLanguage(page, name) {
  await page.locator(".language-trigger").click();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
  await expect(page.locator(".language-trigger")).toHaveAttribute("aria-expanded", "false");
}
