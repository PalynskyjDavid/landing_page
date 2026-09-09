import { acquireDatabaseLock, database } from "../e2e/support/database.js";
import { backend } from "../e2e/support/backend.js";
import { web } from "../e2e/support/web.js";
import { collector } from "../e2e/support/collector.js";

try {
  const lock = acquireDatabaseLock();
  try {
    const action = process.argv[2];
    switch (action) {
      case "setup":
        collector("remove", lock.token);
        web("stop", lock.token);
        backend("stop", lock.token);
        database("setup", lock.token); // Explicitly resets ONLY disposable test data.
        backend("build", lock.token);
        backend("up", lock.token);
        web("build", lock.token);
        web("up", lock.token);
        collector("build", lock.token);
        collector("up", lock.token);
        console.info("App ready at http://127.0.0.1:5188; direct API at :3107; DB at :5547.");
        break;
      case "stop":
        collector("stop", lock.token);
        web("stop", lock.token);
        backend("stop", lock.token);
        database("stop", lock.token);
        break;
      case "up":
        collector("remove", lock.token);
        database("up", lock.token);
        backend("up", lock.token);
        web("up", lock.token);
        collector("up", lock.token);
        break;
      case "down":
        database("down", lock.token);
        break;
      case "status":
      case "logs":
        collector(action, lock.token);
        web(action, lock.token);
        backend(action, lock.token);
        database(action, lock.token);
        break;
      case "api:up":
      case "api:stop":
      case "api:build":
        backend(action.slice(4), lock.token);
        break;
      case "collector:build":
      case "collector:up":
      case "collector:stop":
        collector(action.slice(10), lock.token);
        break;
      case "web:up":
      case "web:stop":
      case "web:build":
        if (action !== "web:build") collector("remove", lock.token);
        web(action.slice(4), lock.token);
        if (action === "web:up") collector("up", lock.token);
        break;
      default:
        throw new Error(`Unknown test stack action: ${action}`);
    }
  } finally {
    lock.release();
  }
} catch (error) {
  console.error(error.message);
  console.error(
    "Inspect partial setup with task test:stack:status / test:stack:logs; task test:stack:down removes disposable data.",
  );
  process.exitCode = 1;
}
