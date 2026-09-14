import { test, expect } from "./fixtures.js";
import { backendURL } from "./support/environment.js";

test("statistics filters, player grouping and chart agree with stored games", async ({
  page,
  playwright,
}, testInfo) => {
  const other = await playwright.request.newContext();
  try {
    await page.request.get(`${backendURL}/scores/leaderboard`);
    await other.get(`${backendURL}/scores/leaderboard`);
    let index = 1;
    for (const [client, name, times] of [
      [page.request, "Alice", [200, 300, 400]],
      [other, "Bob", [100, 500]],
    ]) {
      for (const time of times) {
        const result = await client.post(`${backendURL}/scores`, {
          data: {
            submissionId: `00000000-0000-4000-8000-${String(9000 + index++).padStart(12, "0")}`,
            times: Array(5).fill(time),
            missclicks: time === 400 ? 2 : 0,
            displayName: name,
          },
        });
        expect(result.status()).toBe(201);
      }
    }
    await page.goto("/statistics");
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(6);
    await page.getByRole("combobox", { name: "View", exact: true }).selectOption("players");
    await page.getByRole("combobox", { name: "Period", exact: true }).selectOption("7d");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
    const chart = page.getByRole("figure");
    await expect(chart).toContainText("Alice");
    await expect(chart).toContainText("Bob");
    await expect(chart.getByRole("listitem").filter({ hasText: "300 ms" })).toHaveCount(2);
    await page.getByRole("button", { name: "Apply filters" }).hover();
    await expect(page.getByRole("button", { name: "Apply filters" })).toHaveCSS(
      "color",
      "rgb(255, 255, 255)",
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("statistics-desktop.png"), fullPage: true });
    await page.getByRole("button", { name: "Dark mode", exact: true }).click();
    await expect(page.getByRole("button", { name: "Light mode", exact: true })).toHaveAttribute(
      "data-theme",
      "dark",
    );
    await page.screenshot({ path: testInfo.outputPath("statistics-dark.png"), fullPage: true });
    await page.getByRole("button", { name: "Light mode", exact: true }).click();

    await page.getByRole("combobox", { name: "Players", exact: true }).selectOption("mine");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
    await expect(page.getByRole("table")).toContainText("Alice");
    await expect(page.getByRole("table")).not.toContainText("Bob");

    await page.getByText("Reaction time and misclick ranges", { exact: true }).click();
    await page.getByLabel("Maximum Average reaction (ms)", { exact: true }).fill("250");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("table").getByRole("row").nth(1)).toContainText("200 ms");

    await page.setViewportSize({ width: 360, height: 800 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("statistics-mobile.png"), fullPage: true });
    await page.getByLabel("Player name", { exact: true }).fill("Nobody matches");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(
      page.getByText("No scores match these filters. Play a game or widen the filters."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(6);
  } finally {
    await other.dispose();
  }
});
