// Explicit opt-in smoke against the local lab ONLY. No reset or Docker stop CLI:
// the UI/controller must enforce the exact same budgets as it does for a human.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";
import { finishGame } from "../e2e/support/game.js";

const origin = "http://127.0.0.1:5196";
const commandURL = origin + "/lab-api/commands";
async function health() {
  const response = await fetch(origin + "/lab-api/health", { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.kind, "isolated-reliability-lab");
  return data;
}
async function status() {
  const response = await fetch(origin + "/lab-api/status", { signal: AbortSignal.timeout(35000) });
  assert.equal(response.status, 200);
  const value = await response.json();
  assert.equal(value.kind, "isolated-reliability-lab");
  return value;
}
async function command(action, service, mode) {
  return fetch(commandURL, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ action, service, ...(mode ? { mode } : {}) }),
    signal: AbortSignal.timeout(35000),
  });
}
function savedCount(submissionID) {
  assert.match(submissionID, /^[0-9a-f-]{36}$/);
  const name = "landing-page-lab-db-1";
  const [container] = JSON.parse(
    execFileSync("docker", ["container", "inspect", name], { encoding: "utf8" }),
  );
  assert.equal(container.Config.Labels["com.docker.compose.project"], "landing-page-lab");
  assert.equal(container.Config.Labels["landing-page.reliability-lab"], "true");
  assert.equal(container.Config.Labels["com.docker.compose.service"], "db");
  assert(container.Config.Env.includes("POSTGRES_DB=reaction_lab"));
  assert(container.Config.Env.includes("POSTGRES_USER=lab_user"));
  assert.equal(container.Mounts.length, 1);
  assert.equal(container.Mounts[0].Name, "landing-page-lab_data");
  return Number(
    execFileSync(
      "docker",
      [
        "exec",
        container.Id,
        "psql",
        "-U",
        "lab_user",
        "-d",
        "reaction_lab",
        "-Atc",
        "SELECT count(*) FROM scores WHERE submission_id = '" + submissionID + "'::uuid",
      ],
      { encoding: "utf8" },
    ).trim(),
  );
}

const initial = await status();
assert(
  initial.canStopManual && initial.usedStops === 0 && initial.reservedSeconds === 0,
  "Wait for the lab budget/cooldown to expire before smoke testing; this script never resets it.",
);
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
  });
  await context.addCookies([
    { name: "reaction_player_id", value: "development-cookie-untouched", url: origin },
  ]);
  const page = await context.newPage();
  page.setDefaultTimeout(35000);
  await page.goto(origin + "/statistics?view=reliability");
  const panel = page.getByRole("region", { name: "Container controls" });
  await expect(panel).toBeVisible();
  const overview = page.getByRole("region", { name: "Live overview", exact: true });
  await expect(overview).toBeVisible();
  await expect.poll(async () => (await health()).samples.at(-1)?.ready.status).toBe(200);
  await expect(overview.locator(".lab-health-bar.is-healthy").first()).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Stop for 30 seconds", exact: true }).first(),
  ).toBeEnabled();
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "mobile overflow",
  );
  await page.evaluate(() => localStorage.setItem("reactionGame.language", "cs"));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Dostupnost služeb" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ovládání kontejnerů" })).toBeVisible();
  await page.getByRole("button", { name: "Tmavý režim", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".statistics-intro .ui-btn")
        .evaluate((element) => getComputedStyle(element).color),
    )
    .toBe("rgb(255, 255, 255)");
  mkdirSync(new URL("../test-results/", import.meta.url), { recursive: true });
  await page.screenshot({
    path: fileURLToPath(new URL("../test-results/lab-health-cs-mobile.png", import.meta.url)),
    fullPage: true,
  });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Czech mobile overflow",
  );
  await page.evaluate(() => localStorage.setItem("reactionGame.language", "en"));
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 900 });
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "desktop overflow",
  );
  console.log("EN/CZ mobile and desktop controls visible, no horizontal overflow.");
  await page.getByRole("button", { name: "Light mode", exact: true }).click();
  const game = await context.newPage();
  game.setDefaultTimeout(35000);
  await game.goto(origin + "/game");
  await expect(game.getByRole("region", { name: "Container controls" })).toHaveCount(0);

  const attempts = [];
  game.on("request", (request) => {
    if (request.url() === origin + "/api/scores" && request.method() === "POST")
      attempts.push(request.postDataJSON());
  });
  await finishGame(game);
  await game
    .getByLabel("Display name (optional)")
    .fill("Lab smoke " + Date.now().toString().slice(-8));
  const api = panel
    .locator(".container-lab-service")
    .filter({ has: page.getByRole("heading", { name: "API", exact: true }) });
  await api.getByRole("button", { name: "Stop for 30 seconds", exact: true }).click();
  await expect
    .poll(async () => (await status()).services.api.running, { timeout: 20000 })
    .toBe(false);
  assert.equal((await command("stop", "db", "timed")).status, 409);
  assert.equal((await page.request.get(origin + "/api/health/ready")).status(), 503);
  console.log("Real API stopped; a second client's DB stop rejected.");
  await expect.poll(async () => (await health()).samples.at(-1)?.live.status).toBe(0);
  await expect(overview.locator(".lab-health-bar.is-unreachable").first()).toBeVisible();
  const outageAt = (await health()).samples.at(-1).at;
  await page.reload();
  assert(
    (await health()).samples.some((sample) => sample.at === outageAt),
    "refresh cleared history",
  );
  await game.getByRole("button", { name: "Save score", exact: true }).click();
  await expect(game.getByText("1 score is safely queued in this browser.")).toBeVisible();
  await game.getByRole("button", { name: "Play again", exact: true }).click();
  await game.reload();
  await expect(game.getByText("1 score is safely queued in this browser.")).toBeVisible();
  await expect
    .poll(async () => (await status()).outage, { timeout: 70000, intervals: [1000, 2000] })
    .toBeNull();
  await expect(game.getByText("1 score is safely queued in this browser.")).toHaveCount(0, {
    timeout: 50000,
  });
  assert(attempts.length >= 2, "score was not retried");
  assert(attempts.every((value) => JSON.stringify(value) === JSON.stringify(attempts[0])));
  const replay = await page.request.post(origin + "/api/scores", {
    data: attempts[0],
    headers: { Origin: origin },
  });
  assert.equal(replay.status(), 200);
  assert.equal(savedCount(attempts[0].submissionId), 1);
  const cookies = await context.cookies();
  assert.equal(
    cookies.find((cookie) => cookie.name === "reaction_player_id").value,
    "development-cookie-untouched",
  );
  assert(cookies.some((cookie) => cookie.name === "lab_reaction_player_id"));
  console.log(
    "Timed auto-recovery passed; score survived new game/reload, replayed exactly once; cookies isolated.",
  );

  await expect
    .poll(async () => (await status()).canStopManual, { timeout: 45000, intervals: [1000, 2000] })
    .toBe(true);
  const db = panel
    .locator(".container-lab-service")
    .filter({ has: page.getByRole("heading", { name: "Database", exact: true }) });
  await expect(
    db.getByRole("button", { name: "Stop manually (max 60 s)", exact: true }),
  ).toBeEnabled();
  await db.getByRole("button", { name: "Stop manually (max 60 s)", exact: true }).click();
  await expect
    .poll(async () => (await status()).services.db.running, { timeout: 20000 })
    .toBe(false);
  assert.equal((await page.request.get(origin + "/api/health/live")).status(), 200);
  assert.equal((await page.request.get(origin + "/api/health/ready")).status(), 503);
  await expect
    .poll(async () => {
      const latest = (await health()).samples.at(-1);
      return [latest?.live.status, latest?.ready.status];
    })
    .toEqual([200, 503]);
  await expect(overview.locator(".lab-health-readiness")).toContainText("Not healthy");
  await expect(overview.locator(".lab-health-bar.is-unhealthy").first()).toBeVisible();
  const startResponse = page.waitForResponse(
    (response) =>
      response.url() === commandURL &&
      response.request().method() === "POST" &&
      response.request().postDataJSON().action === "start",
  );
  await db.getByRole("button", { name: "Start now", exact: true }).click();
  assert.equal((await startResponse).status(), 200);
  await expect
    .poll(async () => (await status()).outage, { timeout: 60000, intervals: [1000, 2000] })
    .toBeNull();
  const final = await status();
  assert.equal(final.usedStops, 2);
  assert.equal(final.reservedSeconds, 90);
  assert.equal(final.canStopTimed, false);
  assert.equal(final.canStopManual, false);
  assert.equal((await command("stop", "api", "timed")).status, 429);
  assert.equal((await command("start", "api")).status, 200);
  await expect.poll(async () => (await health()).samples.at(-1)?.ready.status).toBe(200);
  await expect(overview.locator(".lab-health-readiness")).toContainText("Healthy");
  await expect(
    panel
      .locator(".container-lab-service")
      .filter({ has: page.getByRole("heading", { name: "Database", exact: true }) }),
  ).toContainText("Ready");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: fileURLToPath(new URL("../test-results/lab-health-desktop.png", import.meta.url)),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await overview.getByText("Inspect recent measurements", { exact: true }).click();
  assert(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "sample table overflows mobile page",
  );
  await page.route("**/lab-api/health", (route) => route.abort());
  await expect(overview.getByRole("button", { name: "Stale data", exact: true })).toBeVisible();
  await expect(overview.locator(".lab-health-readiness")).toContainText("No recent measurement");
  await page.unroute("**/lab-api/health");
  await expect(overview.locator(".lab-health-readiness")).toContainText("Healthy");
  console.log(
    "Health graphs distinguish API outages from DB readiness failures, retain history on refresh, and mark stale measurements unknown.",
  );
  console.log(
    "Real DB outage/manual start passed. Early recovery kept 90-second reservation; recovery bypasses limit.",
  );
} finally {
  // Only restore a lease owned by this lab; no volume removal or budget clearing.
  try {
    const current = await status().catch(() => null);
    if (current?.outage) {
      const response = await command("start", current.outage.service);
      if (!response.ok)
        console.error("Controller could not confirm recovery; rerun task lab:serve.");
    }
  } finally {
    await browser.close();
  }
}
