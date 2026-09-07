import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { acquireDatabaseLock, database, runCommand } from "../e2e/support/database.js";
import { backendExecutable, frontendDir, repositoryDir } from "../e2e/support/environment.js";

// Keep orchestration out of the test scenario. finally also runs after failed tests.
export async function main() {
  const keep = process.env.KEEP_TEST_DB ?? "false";
  if (!["true", "false"].includes(keep)) throw new Error("KEEP_TEST_DB must be true or false.");

  const lock = acquireDatabaseLock();
  let child;
  let interrupted = false;
  let setupComplete = false;
  let exitCode = 1;
  let failure;
  const onInterrupt = () => {
    interrupted = true;
    child?.kill("SIGINT");
  };
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onInterrupt);
  try {
    database("setup", lock.token);
    setupComplete = true;
    runCommand("go", [
      "-C",
      path.join(repositoryDir, "my-backend"),
      "build",
      "-buildvcs=false",
      "-o",
      backendExecutable,
      "./cmd/api",
    ]);
    // Let queued signals run before launching the browser processes.
    await new Promise((resolve) => setImmediate(resolve));
    exitCode = interrupted
      ? 130
      : await new Promise((resolve, reject) => {
          child = spawn(
            process.execPath,
            [
              path.join(frontendDir, "node_modules", "@playwright", "test", "cli.js"),
              "test",
              ...process.argv.slice(2),
            ],
            {
              cwd: frontendDir,
              env: { ...process.env, E2E_RUN_TOKEN: lock.token },
              stdio: "inherit",
              windowsHide: true,
            },
          );
          child.once("error", reject);
          child.once("close", (code) => resolve(interrupted ? 130 : (code ?? 1)));
        });
  } catch (error) {
    failure = error;
  } finally {
    // Read logs while the container still exists, including failures before Playwright starts.
    if (exitCode !== 0) {
      console.error("E2E run failed or was interrupted. PostgreSQL logs before cleanup:");
      try {
        database("logs", lock.token);
      } catch (error) {
        console.error(`Could not read test database logs: ${error.message}`);
      }
    }
    try {
      if (keep === "true") {
        console.info(
          setupComplete
            ? "Test DB kept for inspection: 127.0.0.1:5547 / reaction_e2e / e2e_user / e2e_password"
            : "KEEP_TEST_DB=true: cleanup skipped, but database setup did not complete. Check task test:db:status and task test:db:logs.",
        );
        console.info(
          "Use task test:db:down when finished. The next setup/reset discards this test data.",
        );
      } else {
        database("down", lock.token);
      }
    } catch (error) {
      console.error(`Test database cleanup failed: ${error.message}`);
      if (!failure && exitCode === 0) failure = error;
    } finally {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onInterrupt);
      try {
        lock.release();
      } catch (error) {
        console.error(`Could not release the E2E database lock: ${error.message}`);
        if (!failure && exitCode === 0) failure = error;
      }
    }
  }
  if (failure) throw failure;
  return exitCode;
}

// Importing main in unit tests must not start Docker or Playwright.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
