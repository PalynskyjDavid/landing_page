import { test, expect } from "./fixtures.js";
import { backendURL } from "./support/environment.js";

test("a completed game is saved and survives a reload", async ({ page }) => {
  const playerName = "E2E Player";

  await test.step("Open the game with the empty baseline", async () => {
    await page.goto("/game");
    await expect(
      page.getByText("No scores yet. Finish a game to become the first entry."),
    ).toBeVisible();
  });

  await test.step("Play five rounds", async () => {
    await page.getByText("Click to start.", { exact: true }).click();
    for (let round = 1; round <= 5; round++) {
      // Wait for the actual green state, not a fixed sleep or a fake score.
      await page.getByText("Click!", { exact: true }).click();
      if (round < 5) await page.getByText(/Click for next round\./).click();
    }
    await expect(page.getByRole("heading", { name: "Finished!" })).toBeVisible();
  });

  await test.step("Save through the real API", async () => {
    await page.getByLabel("Display name (optional)").fill(playerName);
    await page.getByRole("button", { name: "Save score", exact: true }).click();
    await expect(page.getByRole("button", { name: "Score saved", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: playerName, exact: true })).toBeVisible();
  });

  await test.step("Reload and read the stored score from the leaderboard", async () => {
    await page.reload();
    await expect(page.getByRole("cell", { name: playerName, exact: true })).toBeVisible();
    // One header row and one saved score.
    await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
  });
});

// page.request shares the page's cookies, so both requests identify the same player.
// These real API calls bypass the frontend's form/retry/outbox logic.
test("identical retries reuse a score; changed data conflicts", async ({ page }) => {
  // A fixed UUID is fine here because our fixture resets the DB before each test.
  const payload = {
    submissionId: "00000000-0000-4000-8000-000000000801",
    times: [200, 210, 220, 230, 240],
    missclicks: 0,
    displayName: "Retry example",
  };
  const first = await page.request.post(`${backendURL}/scores`, { data: payload });
  expect(first.status()).toBe(201); // A new score was created.
  const saved = await first.json();

  const replay = await page.request.post(`${backendURL}/scores`, { data: payload });
  expect(replay.status()).toBe(200); // Same request: return the existing score.
  expect(await replay.json()).toMatchObject({ id: saved.id, submissionId: payload.submissionId });

  const conflict = await page.request.post(`${backendURL}/scores`, {
    data: { ...payload, missclicks: 1 },
  });
  expect(conflict.status()).toBe(409); // Same UUID, DIFFERENT data is a conflict.
  expect(await conflict.json()).toMatchObject({ error: { code: "score_submission_conflict" } });

  await page.goto("/game");
  await expect(page.getByRole("cell", { name: "Retry example", exact: true })).toBeVisible();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
});

// The app's switch blocks only its API calls, so reloading the frontend still works.
// This checks simulated API loss, not a stopped backend/database or a real outage.
test("a queued score survives reload and saves after recovery", async ({ page }) => {
  test.setTimeout(90_000); // Allow real game delays plus retry/recovery time.
  await page.goto("/game");
  const lab = page.getByRole("region", { name: "Reliability lab" });
  await lab.getByRole("button", { name: "Simulate connection loss" }).click();

  await page.getByText("Click to start.", { exact: true }).click();
  for (let round = 1; round <= 5; round++) {
    await page.getByText("Click!", { exact: true }).click();
    if (round < 5) await page.getByText(/Click for next round\./).click();
  }
  await page.getByLabel("Display name (optional)").fill("Offline example");
  await page.getByRole("button", { name: "Save score", exact: true }).click();
  await expect(page.getByRole("button", { name: "Queued for delivery" })).toBeVisible({
    timeout: 15_000,
  });

  await page.reload(); // The outbox and simulation persist; the finished-game screen does not.
  await expect(page.getByRole("complementary", { name: "Connection simulation" })).toBeVisible();
  // There are two Restore buttons (banner and lab), so scope to the lab.
  await lab.getByRole("button", { name: "Restore connection", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Offline example", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);

  await page.reload(); // Read the saved result again, rather than relying on old UI state.
  await expect(page.getByRole("cell", { name: "Offline example", exact: true })).toBeVisible();
});

// API validation normally rejects these BEFORE an INSERT reaches PostgreSQL.
// To prove a SQL CHECK constraint itself works, use a direct-DB integration test.
test("invalid score requests return useful errors and save nothing", async ({ page }) => {
  const valid = {
    submissionId: "00000000-0000-4000-8000-000000000802",
    times: [200, 210, 220, 230, 240],
    missclicks: 0,
  };
  const cases = [
    { data: { ...valid, submissionId: "not-a-uuid" }, code: "score_invalid_submission_id" },
    { data: { ...valid, times: [200, 210] }, code: "score_invalid_round_count" },
    { data: { ...valid, times: [0, 210, 220, 230, 240] }, code: "score_invalid_time" },
    { data: { ...valid, missclicks: -1 }, code: "score_invalid_missclicks" },
    { data: { ...valid, times: "not-an-array" }, code: "invalid_json" },
    { data: { ...valid, averageMs: 1 }, code: "invalid_json" }, // Unknown DTO field.
  ];
  for (const example of cases) {
    const response = await page.request.post(`${backendURL}/scores`, { data: example.data });
    expect(response.status()).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: example.code } });
  }
  const leaderboard = await page.request.get(`${backendURL}/scores/leaderboard`);
  expect(leaderboard.status()).toBe(200);
  expect(await leaderboard.json()).toMatchObject({ entries: [] });
});
