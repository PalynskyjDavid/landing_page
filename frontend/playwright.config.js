import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { assertDatabaseLock } from "./e2e/support/database.js";
import {
  backendExecutable,
  backendURL,
  frontendDir,
  frontendURL,
  repositoryDir,
  testEnvironment,
} from "./e2e/support/environment.js";

// Use task test:e2e, including for --headed/--ui. Direct runs would skip setup.
if (!process.env.E2E_RUN_TOKEN)
  throw new Error("Run task test:e2e so database setup and cleanup are included.");
assertDatabaseLock(process.env.E2E_RUN_TOKEN);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  fullyParallel: false,
  workers: 1, // One shared test DB. The fixture also rejects --workers overrides.
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: "test-results",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: frontendURL,
    // The green target otherwise pulses forever and never becomes stable to click.
    reducedMotion: "reduce",
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      name: "E2E backend",
      command: `"${backendExecutable}"`,
      cwd: path.join(repositoryDir, "my-backend"),
      env: testEnvironment,
      url: `${backendURL}/health/ready`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      name: "E2E frontend",
      command: `"${process.execPath}" ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187 --strictPort --mode e2e`,
      cwd: frontendDir,
      env: testEnvironment,
      url: frontendURL,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
