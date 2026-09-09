import { test, expect } from "./fixtures.js";
import { database } from "./support/database.js";
import { backendURL } from "./support/environment.js";
import { finishGame } from "./support/game.js";

test("lost cookie and committed-score responses retry without losing or duplicating the score", async ({
  page,
  playwright,
}) => {
  test.setTimeout(90_000);
  await page.goto("/game");
  await expect(page.getByText("Click to start.", { exact: true })).toBeVisible();
  await page.context().clearCookies();

  const attempts = [];
  let lostCookieResponse = false;
  let lostSaveResponse = false;
  let savedID;
  await page.route(`${backendURL}/scores`, async (route) => {
    // An isolated context per call is intentional. route.fetch/page.request can
    // retain Set-Cookie in the browser's cookie jar BEFORE we discard the response,
    // which would accidentally hide the very first-cookie bug this test targets.
    const upstream = await playwright.request.newContext();
    try {
      const response = await upstream.fetch(route.request(), { maxRetries: 0 });
      const body = await response.json();
      attempts.push({
        status: response.status(),
        payload: route.request().postDataJSON(),
        cookie: route.request().headers().cookie ?? "",
      });
      if (!lostCookieResponse && body.error?.code === "score_player_cookie_required") {
        lostCookieResponse = true;
        const leaderboard = await upstream.get(`${backendURL}/scores/leaderboard`);
        expect((await leaderboard.json()).entries).toEqual([]);
        await route.abort("failed");
      } else if (!lostSaveResponse && response.status() === 201) {
        lostSaveResponse = true;
        savedID = body.id; // The real Go handler confirmed the PostgreSQL write.
        await route.abort("failed"); // Lose only the response, not the committed row.
      } else {
        if (response.status() === 200) expect(body.id).toBe(savedID);
        await route.fulfill({ response });
      }
    } finally {
      await upstream.dispose();
    }
  });

  await finishGame(page);
  await page.getByLabel("Display name (optional)").fill("Lost response player");
  await page.getByRole("button", { name: "Save score", exact: true }).click();
  await expect(page.getByRole("button", { name: "Score saved", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  expect(attempts.map((attempt) => attempt.status)).toEqual([400, 400, 201, 200]);
  expect(
    attempts.every(
      (attempt) => JSON.stringify(attempt.payload) === JSON.stringify(attempts[0].payload),
    ),
  ).toBe(true);
  expect(attempts[0].cookie).toBe("");
  expect(attempts[1].cookie).toBe("");
  expect(attempts[2].cookie).toContain("reaction_player_id=");
  expect(attempts[3].cookie).toBe(attempts[2].cookie);

  await page.goto("/statistics");
  await expect(page.getByRole("cell", { name: "Lost response player", exact: true })).toBeVisible();
  const leaderboard = await page.request.get(`${backendURL}/scores/leaderboard`);
  expect((await leaderboard.json()).entries).toMatchObject([{ scoreId: savedID }]);
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
});

test("two games stay queued through a real database outage and reload, then recover once each", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const submissions = new Map();
  page.on("request", (request) => {
    if (request.url() === `${backendURL}/scores` && request.method() === "POST") {
      const payload = request.postDataJSON();
      submissions.set(payload.submissionId, payload);
    }
  });
  await page.goto("/game");
  await expect(page.getByText("Click to start.", { exact: true })).toBeVisible();
  await finishGame(page);

  let needsRestore = true;
  try {
    await test.step("Stop only the owned test database; API remains alive but unready", async () => {
      database("stop", process.env.E2E_RUN_TOKEN);
      expect((await page.request.get(`${backendURL}/health/live`)).status()).toBe(200);
      const readiness = await page.request.get(`${backendURL}/health/ready`);
      expect(readiness.status()).toBe(503);
      expect(await readiness.json()).toMatchObject({
        status: "not_ready",
        dependencies: { database: "unavailable" },
      });
    });

    await test.step("Queue the first score, then play and save another game", async () => {
      await page.getByLabel("Display name (optional)").fill("Outage player");
      await page.getByRole("button", { name: "Save score", exact: true }).click();
      await expect(page.getByRole("button", { name: "Queued for delivery" })).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByText("1 score is safely queued in this browser.")).toBeVisible();
      await page.getByRole("button", { name: "Play again", exact: true }).click();
      await finishGame(page);
      await page.getByRole("button", { name: "Save score", exact: true }).click();
      await expect(page.getByText("2 scores are safely queued in this browser.")).toBeVisible();
    });

    await test.step("Reload while storage is still unavailable", async () => {
      await page.reload();
      await expect(page.getByText("2 scores are safely queued in this browser.")).toBeVisible();
    });

    await test.step("Restart PostgreSQL without resetting data and let automatic delivery recover", async () => {
      database("up", process.env.E2E_RUN_TOKEN);
      needsRestore = false;
      await expect
        .poll(async () => (await page.request.get(`${backendURL}/health/ready`)).status())
        .toBe(200);
      await page.getByRole("link", { name: "View statistics and leaderboard" }).click();
      await expect(page.getByRole("cell", { name: "Outage player", exact: true })).toHaveCount(2, {
        timeout: 40_000,
      });
      await expect(
        page.getByText(/scores? (?:is|are) safely queued in this browser\./),
      ).toHaveCount(0);
    });

    await test.step("Each original UUID resolves to its one stored score", async () => {
      expect(submissions.size).toBe(2);
      const leaderboard = await page.request.get(`${backendURL}/scores/leaderboard`);
      const entries = (await leaderboard.json()).entries;
      expect(entries).toHaveLength(2);
      const storedIDs = new Set();
      for (const payload of submissions.values()) {
        const replay = await page.request.post(`${backendURL}/scores`, { data: payload });
        expect(replay.status()).toBe(200);
        storedIDs.add((await replay.json()).id);
      }
      expect([...storedIDs].sort()).toEqual(entries.map((entry) => entry.scoreId).sort());
      await page.reload();
      await expect(page.getByRole("cell", { name: "Outage player", exact: true })).toHaveCount(2);
      await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
    });
  } finally {
    // Assertion failures must not leave the shared test database stopped.
    if (needsRestore) database("up", process.env.E2E_RUN_TOKEN);
  }
});
