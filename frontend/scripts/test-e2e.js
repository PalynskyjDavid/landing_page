import { spawn } from "node:child_process";
import path from "node:path";
import { acquireDatabaseLock, database, runCommand } from "../e2e/support/database.js";
import { backendExecutable, frontendDir, repositoryDir } from "../e2e/support/environment.js";

// Keep orchestration out of the test scenario. finally also runs after failed tests.
async function main() {
  const keep = process.env.KEEP_TEST_DB ?? "false";
  if (!["true", "false"].includes(keep)) throw new Error("KEEP_TEST_DB must be true or false.");

  const lock = acquireDatabaseLock();
  let child;
  let interrupted = false;
  const onInterrupt = () => {
    interrupted = true;
    child?.kill("SIGINT");
  };
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onInterrupt);
  try {
    database("setup", lock.token);
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
    if (interrupted) return 130;

    return await new Promise((resolve, reject) => {
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
  } finally {
    try {
      if (keep === "true") {
        console.info(
          "Test DB kept for inspection: 127.0.0.1:5547 / reaction_e2e / e2e_user / e2e_password",
        );
        console.info(
          "Use task test:db:down when finished. The next setup/reset discards this test data.",
        );
      } else {
        database("down", lock.token);
      }
    } finally {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onInterrupt);
      lock.release();
    }
  }
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
