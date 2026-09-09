import { assertDatabaseLock, compose, inspectContainer } from "./database.js";

// No database credentials belong in the web container; ownership uses its own marker.
export function web(action, token) {
  assertDatabaseLock(token);
  const container = inspectContainer(false, "web");
  switch (action) {
    case "build":
      return compose(["build", "web"], { timeout: 600_000 });
    case "up":
      inspectContainer(true, "api");
      return compose(["up", "--detach", "--no-deps", "--wait", "--wait-timeout", "60", "web"]);
    case "stop":
      if (container) return compose(["stop", "web"]);
      return;
    case "remove":
      if (!container) return;
      compose(["stop", "web"]);
      return compose(["rm", "--force", "web"]);
    case "inspect":
      if (!container) throw new Error("Test web container is missing.");
      return container;
    case "status":
      return compose(["ps", "--all", "web"]);
    case "logs":
      return compose(["logs", "--tail", "100", "web"]);
    default:
      throw new Error(`Unknown test web action: ${action}`);
  }
}
