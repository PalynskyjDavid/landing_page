import { assertDatabaseLock, compose, inspectContainer } from "./database.js";

export function collector(action, token) {
  assertDatabaseLock(token);
  const container = inspectContainer(false, "collector");
  switch (action) {
    case "build":
      return compose(["build", "collector"], { timeout: 600_000 });
    case "up":
      inspectContainer(true, "web");
      return compose([
        "up",
        "--detach",
        "--no-deps",
        "--wait",
        "--wait-timeout",
        "60",
        "collector",
      ]);
    case "stop":
      if (container) return compose(["stop", "collector"]);
      return;
    case "remove":
      if (!container) return;
      compose(["stop", "collector"]);
      return compose(["rm", "--force", "collector"]);
    case "logs":
      return compose(["logs", "--tail", "100", "collector"]);
    case "status":
      return compose(["ps", "--all", "collector"]);
    default:
      throw new Error(`Unknown test collector action: ${action}`);
  }
}
