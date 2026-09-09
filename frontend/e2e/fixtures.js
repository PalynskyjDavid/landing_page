import { test as base, expect } from "@playwright/test";
import { database, inspectContainer } from "./support/database.js";
import { backend } from "./support/backend.js";
import { web } from "./support/web.js";
import { collector } from "./support/collector.js";
import { frontendURL } from "./support/environment.js";

// Import test from THIS file in every spec, not directly from @playwright/test.
export const test = base.extend({
  databaseBaseline: [
    async ({ baseURL }, runTest, testInfo) => {
      if (baseURL !== frontendURL || testInfo.config.workers !== 1) {
        throw new Error("E2E requires its isolated frontend and exactly one worker.");
      }
      const token = process.env.E2E_RUN_TOKEN;
      // Drop the previous scenario's in-memory telemetry BEFORE clearing DB summaries.
      collector("remove", token);
      // Recover a prior failed/killed worker's infrastructure before resetting.
      // A failure must not make every later scenario fail with connection errors.
      const db = inspectContainer(true);
      if (!db.State.Running || db.State.Health?.Status !== "healthy") database("up", token);
      database("reset", token);
      const api = inspectContainer(false, "api");
      if (!api?.State.Running || api.State.Health?.Status !== "healthy") backend("up", token);
      const frontend = inspectContainer(false, "web");
      if (!frontend?.State.Running || frontend.State.Health?.Status !== "healthy") web("up", token);
      collector("up", token);
      await runTest();
      // No reset here: KEEP_TEST_DB preserves the final test's state for pgAdmin.
    },
    { auto: true },
  ],
});

export { expect };
