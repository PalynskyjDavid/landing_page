import { fileURLToPath } from "node:url";
import path from "node:path";
import { tmpdir } from "node:os";

export const repositoryDir = fileURLToPath(new URL("../../../", import.meta.url));
export const frontendDir = path.join(repositoryDir, "frontend");
export const runtimeDir = path.join(frontendDir, ".e2e");
export const backendExecutable = path.join(
  runtimeDir,
  process.platform === "win32" ? "api.exe" : "api",
);
export const composeProject = "landing-page-e2e";
// Compose names/ports are shared across checkouts, so the lock must be too.
export const databaseLockFile = path.join(tmpdir(), `${composeProject}-database.lock`);
export const frontendURL = "http://127.0.0.1:5187";
export const backendURL = "http://127.0.0.1:3107";

// These must match compose.e2e.yml. Never accept a caller's development DB URL.
export const testEnvironment = {
  DATABASE_URL: "postgresql://e2e_user:e2e_password@127.0.0.1:5547/reaction_e2e?sslmode=disable",
  POSTGRES_DB: "reaction_e2e",
  POSTGRES_USER: "e2e_user",
  POSTGRES_PASSWORD: "e2e_password",
  BACKEND_PORT: "3107",
  CORS_ORIGIN: frontendURL,
  COOKIE_SECURE: "false",
  VITE_API_URL: backendURL,
};
