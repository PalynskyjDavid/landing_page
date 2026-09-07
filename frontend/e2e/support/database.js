import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  composeProject,
  databaseLockFile,
  frontendDir,
  repositoryDir,
  runtimeDir,
  testEnvironment,
} from "./environment.js";

const lockFile = databaseLockFile;
const composeArgs = [
  "compose",
  "--project-name",
  composeProject,
  "--env-file",
  path.join(frontendDir, "e2e", "compose.env"),
  "--file",
  path.join(repositoryDir, "compose.e2e.yml"),
];

export function runCommand(command, args, { capture = false, input, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryDir,
    env,
    encoding: "utf8",
    windowsHide: true,
    timeout: 240_000,
    stdio: [input === undefined ? "inherit" : "pipe", capture ? "pipe" : "inherit", "inherit"],
    input,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed (exit ${result.status}).`);
  return result.stdout?.trim() ?? "";
}

function compose(args, options) {
  return runCommand("docker", [...composeArgs, ...args], options);
}

// All mutating commands share a lock, including standalone Task commands.
// This prevents a second run/reset from destroying the first run's test data.
export function acquireDatabaseLock() {
  mkdirSync(runtimeDir, { recursive: true });
  let descriptor;
  try {
    descriptor = openSync(lockFile, "wx");
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(
        `E2E database is in use. See ${lockFile}. Do not reset a running test's database.`,
      );
    }
    throw error;
  }
  const token = randomUUID();
  try {
    writeFileSync(descriptor, JSON.stringify({ pid: process.pid, repositoryDir, token }));
  } finally {
    closeSync(descriptor);
  }
  return {
    token,
    release: () => {
      assertDatabaseLock(token);
      unlinkSync(lockFile);
    },
  };
}

export function assertDatabaseLock(token) {
  const lock = JSON.parse(readFileSync(lockFile, "utf8"));
  if (!token || lock.token !== token)
    throw new Error("E2E database lock does not belong to this run.");
}

export function assertOwnedContainer(container) {
  const labels = container.Config?.Labels ?? {};
  const env = container.Config?.Env ?? [];
  if (
    labels["com.docker.compose.project"] !== composeProject ||
    labels["com.docker.compose.service"] !== "db" ||
    labels["landing-page.e2e"] !== "true" ||
    !env.includes("POSTGRES_DB=reaction_e2e") ||
    !env.includes("POSTGRES_USER=e2e_user")
  )
    throw new Error("Refusing to operate on a container not owned by this E2E project.");
}

function inspectContainer(required = false) {
  const id = compose(["ps", "--all", "--quiet", "db"], { capture: true });
  if (!id) {
    if (required) throw new Error("Test database is missing. Run task test:db:setup first.");
    return;
  }
  const [container] = JSON.parse(runCommand("docker", ["inspect", id], { capture: true }));
  assertOwnedContainer(container);
}

function inspectVolume() {
  const name = `${composeProject}_data`;
  const found = runCommand("docker", ["volume", "ls", "--quiet", "--filter", `name=^${name}$`], {
    capture: true,
  });
  if (!found) return;
  const [volume] = JSON.parse(runCommand("docker", ["volume", "inspect", name], { capture: true }));
  if (
    volume.Labels?.["com.docker.compose.project"] !== composeProject ||
    volume.Labels?.["landing-page.e2e"] !== "true"
  ) {
    throw new Error("Refusing to operate on a volume not owned by this E2E project.");
  }
}

export function database(action, token) {
  assertDatabaseLock(token);
  if (action === "status") return compose(["ps", "--all", "db"]);
  if (action === "logs") return compose(["logs", "--tail", "100", "db"]);
  inspectContainer(action === "reset");
  inspectVolume();

  switch (action) {
    case "up":
      return compose(["up", "--detach", "--wait", "--wait-timeout", "90", "db"]);
    case "setup":
      database("up", token);
      // Reuse the same pinned migration task; explicit env takes precedence over .env.
      runCommand("task", ["db:migrate"], { env: { ...process.env, ...testEnvironment } });
      return database("reset", token);
    case "reset":
      console.info("Restoring the E2E data baseline (development data is not targeted).");
      return compose(
        [
          "exec",
          "-T",
          "db",
          "psql",
          "-X",
          "--username=e2e_user",
          "--dbname=reaction_e2e",
          "--set=ON_ERROR_STOP=1",
        ],
        {
          input: readFileSync(path.join(frontendDir, "e2e", "baseline.sql"), "utf8"),
        },
      );
    case "stop":
      return compose(["stop", "db"]);
    case "down":
      console.info("Removing the owned landing-page-e2e container and disposable data volume.");
      return compose(["down", "--volumes", "--timeout", "10"]);
    default:
      throw new Error(`Unknown test database action: ${action}`);
  }
}
