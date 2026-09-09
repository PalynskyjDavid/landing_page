import { test, expect } from "./fixtures.js";
import { backend } from "./support/backend.js";
import { inspectContainer } from "./support/database.js";
import { backendURL } from "./support/environment.js";
import { finishGame } from "./support/game.js";

test("the hardened API shuts down cleanly and a real crash preserves a queued score", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const token = process.env.E2E_RUN_TOKEN;
  const original = backend("inspect", token);
  const databaseID = inspectContainer(true).Id;
  expect(original.Config.User).toBe("65532:65532");
  expect(original.HostConfig.ReadonlyRootfs).toBe(true);
  expect(original.HostConfig.CapDrop).toContain("ALL");
  expect(original.HostConfig.SecurityOpt).toContain("no-new-privileges:true");
  expect(original.State.Health.Status).toBe("healthy");
  let needsRestore = false;
  const attempts = [];

  try {
    await test.step("SIGTERM lets the Go process exit successfully", async () => {
      needsRestore = true;
      backend("stop", token);
      expect(backend("inspect", token).State).toMatchObject({ Running: false, ExitCode: 0 });
      backend("up", token);
      needsRestore = false;
      expect((await page.request.get(`${backendURL}/health/ready`)).status()).toBe(200);
    });

    await page.goto("/game");
    await expect(page.getByText("Click to start.", { exact: true })).toBeVisible();
    await finishGame(page);
    await page.getByLabel("Display name (optional)").fill("Backend restart player");

    page.on("request", (request) => {
      if (request.url() === `${backendURL}/scores` && request.method() === "POST") {
        attempts.push(request.postDataJSON());
      }
    });

    await test.step("SIGKILL makes saving fail; the outbox survives a new game and reload", async () => {
      // Fault injection stays in the test's main sequence, not an asynchronous
      // request callback that could fire AFTER an assertion/cleanup has finished.
      needsRestore = true;
      backend("kill", token);
      expect(backend("inspect", token).State).toMatchObject({ Running: false, ExitCode: 137 });
      await page.getByRole("button", { name: "Save score", exact: true }).click();
      // 'Queued' also appears briefly before the first send. Wait for the actual
      // exhausted-retry state, not that initial durable-write acknowledgement.
      await expect(page.getByText("Score storage is temporarily unavailable.")).toBeVisible({
        timeout: 45_000,
      });
      await expect(page.getByRole("button", { name: "Queued for delivery" })).toBeVisible({
        timeout: 45_000,
      });
      await page.getByRole("button", { name: "Play again", exact: true }).click();
      await page.reload();
      await expect(page.getByText("1 score is safely queued in this browser.")).toBeVisible();
    });

    await test.step("Restart the same container; readiness resumes automatic delivery", async () => {
      backend("up", token);
      needsRestore = false;
      await page.getByRole("link", { name: "View statistics and leaderboard" }).click();
      await expect(
        page.getByRole("cell", { name: "Backend restart player", exact: true }),
      ).toBeVisible({ timeout: 40_000 });
      await expect(page.getByText("1 score is safely queued in this browser.")).toHaveCount(0);
      expect(backend("inspect", token).Id).toBe(original.Id);
      expect(inspectContainer(true).Id).toBe(databaseID);
      expect(attempts.length).toBeGreaterThanOrEqual(2);
      expect(
        attempts.every((payload) => JSON.stringify(payload) === JSON.stringify(attempts[0])),
      ).toBe(true);
      const replay = await page.request.post(`${backendURL}/scores`, { data: attempts[0] });
      expect(replay.status()).toBe(200);
      const saved = await replay.json();
      const leaderboard = await page.request.get(`${backendURL}/scores/leaderboard`);
      expect((await leaderboard.json()).entries).toMatchObject([{ scoreId: saved.id }]);
      await page.reload();
      await expect(page.getByRole("table").getByRole("row")).toHaveCount(2);
    });
  } finally {
    if (needsRestore) backend("up", token);
  }
});
