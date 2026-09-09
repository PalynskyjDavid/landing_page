import { test, expect } from "./fixtures.js";
import { docsURL } from "./support/environment.js";

test("local API docs render the contract and execute a real health request", async ({ page }) => {
  const origins = new Set();
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
  await page.goto(`${docsURL}/docs`);
  await expect(
    page.getByRole("heading", { name: "Reaction API documentation", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#api-target")).toHaveText("/api");
  await expect(page.locator(".opblock")).toHaveCount(7);
  const specification = await page.request.get(`${docsURL}/docs/openapi.json`);
  expect(specification.status()).toBe(200);
  expect((await specification.json()).servers).toEqual([{ url: "/api" }]);

  const operation = page.locator("#operations-Health-getLiveness");
  await operation.getByRole("button", { name: /Check that the API process responds/ }).click();
  await operation.getByRole("button", { name: "Try it out" }).click();
  const responsePromise = page.waitForResponse(`${docsURL}/api/health/live`);
  await operation.getByRole("button", { name: "Execute", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "alive", service: "my-backend" });
  expect([...origins]).toEqual([docsURL]);
});
