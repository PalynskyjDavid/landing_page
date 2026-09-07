import { acquireDatabaseLock, database } from "../e2e/support/database.js";

try {
  const lock = acquireDatabaseLock();
  try {
    database(process.argv[2], lock.token);
  } finally {
    lock.release();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
