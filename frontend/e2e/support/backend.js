import { assertDatabaseLock, compose, inspectContainer } from "./database.js";

// Same lock, explicit Compose file, and ownership checks as the disposable DB.
// Nothing here can select a development container or an arbitrary service name.
export function backend(action, token) {
  assertDatabaseLock(token);
  const container = inspectContainer(false, "api");
  switch (action) {
    case "build":
      return compose(["build", "api"], { timeout: 600_000 });
    case "up":
      inspectContainer(true, "db");
      return compose(["up", "--detach", "--no-deps", "--wait", "--wait-timeout", "60", "api"]);
    case "stop":
      if (container) return compose(["stop", "api"]);
      return;
    case "kill":
      if (!container?.State?.Running)
        throw new Error("Test API must be running before a crash test.");
      return compose(["kill", "--signal", "SIGKILL", "api"]);
    case "remove":
      if (!container) return;
      compose(["stop", "api"]);
      return compose(["rm", "--force", "api"]);
    case "inspect":
      if (!container) throw new Error("Test API is missing.");
      return container;
    case "status":
      return compose(["ps", "--all", "api"]);
    case "logs":
      return compose(["logs", "--tail", "100", "api"]);
    default:
      throw new Error(`Unknown test backend action: ${action}`);
  }
}
