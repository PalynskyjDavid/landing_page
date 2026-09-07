import { test as base, expect } from "@playwright/test";
import { database } from "./support/database.js";
import { frontendURL } from "./support/environment.js";

// Import test from THIS file in every spec, not directly from @playwright/test.
export const test = base.extend({
  databaseBaseline: [
    async ({ baseURL }, runTest, testInfo) => {
      if (baseURL !== frontendURL || testInfo.config.workers !== 1) {
        throw new Error("E2E requires its isolated frontend and exactly one worker.");
      }
      database("reset", process.env.E2E_RUN_TOKEN);
      await runTest();
      // No reset here: KEEP_TEST_DB preserves the final test's state for pgAdmin.
    },
    { auto: true },
  ],
});

export { expect };
