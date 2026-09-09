import { test, expect } from "./fixtures.js";
import { backend } from "./support/backend.js";
import { web } from "./support/web.js";
import { backendURL, frontendURL } from "./support/environment.js";

test("the production image serves React routes, protects assets, and uses same-origin API cookies", async ({
  page,
}) => {
  const container = web("inspect", process.env.E2E_RUN_TOKEN);
  expect(container.Config.User).toBe("101:101");
  expect(container.HostConfig.ReadonlyRootfs).toBe(true);
  expect(container.HostConfig.CapDrop).toContain("ALL");
  expect(container.HostConfig.SecurityOpt).toContain("no-new-privileges:true");
  expect(container.State.Health.Status).toBe("healthy");
  const origins = new Set();
  const browserErrors = [];
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  const home = await page.goto("/");
  expect(home.status()).toBe(200);
  expect(home.headers()["cache-control"]).toBe("no-cache");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
  expect(home.headers()["content-security-policy"]).toContain("connect-src 'self'");
  await page.goto("/game");
  await page.reload();
  await expect(page.getByText("Click to start.", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "View statistics and leaderboard" }).click();
  await expect(page.getByRole("heading", { name: "Leaderboard", exact: true })).toBeVisible();
  await expect(
    page.getByText("No scores match these filters. Play a game or widen the filters."),
  ).toBeVisible();
  const script = await page.locator('script[type="module"]').getAttribute("src");
  expect(script).toMatch(/^\/assets\/.+\.js$/);
  const asset = await page.request.get(script);
  expect(asset.status()).toBe(200);
  expect(asset.headers()["cache-control"]).toContain("immutable");
  expect(await asset.text()).not.toContain("localhost:3001");
  const cookie = (await page.context().cookies()).find(
    (value) => value.name === "reaction_player_id",
  );
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
  expect([...origins]).toEqual([frontendURL]);
  expect(browserErrors).toEqual([]);

  for (const path of [
    "/docs",
    "/docs/openapi.json",
    "/.env",
    "/src/main.jsx",
    "/@vite/client",
    "/assets/missing.js",
  ]) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
  const missingAPI = await page.request.get(`${backendURL}/not-a-route`);
  expect(missingAPI.status()).toBe(404);
  expect(missingAPI.headers()["content-type"]).not.toContain("text/html");
});

test("the proxy stays alive while the API is removed and reconnects to its replacement", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const token = process.env.E2E_RUN_TOKEN;
  const originalAPI = backend("inspect", token).Id;
  const originalWeb = web("inspect", token).Id;
  expect((await page.request.get(`${backendURL}/health/ready`)).status()).toBe(200);
  let needsRestore = true;
  try {
    backend("remove", token);
    const unavailable = await page.request.get(`${backendURL}/scores/leaderboard`);
    expect(unavailable.status()).toBe(503);
    expect(await unavailable.json()).toMatchObject({ error: { code: "api_unavailable" } });
    expect((await page.request.get("/healthz")).status()).toBe(200);
    await page.goto("/game");
    await page.reload();
    await expect(page.getByText("Click to start.", { exact: true })).toBeVisible();

    backend("up", token);
    needsRestore = false;
    await expect
      .poll(async () => (await page.request.get(`${backendURL}/health/ready`)).status(), {
        timeout: 20_000,
      })
      .toBe(200);
    expect(backend("inspect", token).Id).not.toBe(originalAPI);
    expect(web("inspect", token).Id).toBe(originalWeb);
    await page.goto("/statistics");
    await expect(
      page.getByText("No scores match these filters. Play a game or widen the filters."),
    ).toBeVisible();
  } finally {
    if (needsRestore) backend("up", token);
  }
});
