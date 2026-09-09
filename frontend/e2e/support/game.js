import { expect } from "@playwright/test";

// Real game timers and clicks. No mocked reaction values or fixed sleeps.
export async function finishGame(page) {
  await page.getByText("Click to start.", { exact: true }).click();
  for (let round = 1; round <= 5; round++) {
    await page.getByText("Click!", { exact: true }).click();
    if (round < 5) await page.getByText(/Click for next round\./).click();
  }
  await expect(page.getByRole("heading", { name: "Finished!" })).toBeVisible();
}
