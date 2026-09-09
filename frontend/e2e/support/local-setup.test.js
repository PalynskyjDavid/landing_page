import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { repositoryDir } from "./environment.js";

const read = (file) => readFileSync(path.join(repositoryDir, file), "utf8");

describe("canonical local setup (no Docker or personal .env access)", () => {
  it("starts only the development DB and preserves its existing identity and volume", () => {
    const compose = parse(read("docker-compose.yml"));
    expect(Object.keys(compose.services)).toEqual(["db"]);
    expect(compose.name).toBeUndefined(); // Changing project name would select a different volume.
    expect(compose.services.db.container_name).toBe("events_db");
    expect(compose.services.db.ports).toEqual(["127.0.0.1:${POSTGRES_PORT:-5454}:5432"]);
    expect(compose.services.db.volumes).toEqual(["pgdata:/var/lib/postgresql/data"]);
    expect(Object.keys(compose.volumes)).toEqual(["pgdata"]);
    expect(compose.services.db.healthcheck.test.join(" ")).toContain("-h 127.0.0.1");
  });

  it("uses the canonical host tasks and never resets data during development setup", () => {
    const { vars, tasks } = parse(read("Taskfile.yml"));
    expect(vars.BACKEND_DIR).toBe("my-backend");
    expect(tasks["backend:dev"].dir).toBe("{{.BACKEND_DIR}}");
    expect(tasks["backend:dev"].cmds).toEqual(["go run ./cmd/api"]);
    expect(tasks["frontend:dev"].cmds).toEqual([
      "npm run dev -- --host localhost --port 5173 --strictPort",
    ]);
    expect(tasks["dev:setup"].cmds).toEqual([
      'npm ci --prefix "{{.FRONTEND_DIR}}"',
      { task: "db:setup" },
    ]);
    expect(tasks["db:setup"].cmds).toEqual([{ task: "db:up" }, { task: "db:migrate" }]);
    expect(tasks["db:up"].cmds).toEqual(["docker compose up -d --wait db"]);
    expect(read("Taskfile.yml")).not.toMatch(/backend-go|\.\/backend\b/);
  });

  it("keeps environment examples unique and consistent with the default dev endpoints", () => {
    for (const file of [".env.example", "frontend/.env.example"]) {
      const keys = [...read(file).matchAll(/^([A-Z_]+)=/gm)].map((match) => match[1]);
      expect(keys.length).toBeGreaterThan(0);
      expect(new Set(keys).size).toBe(keys.length);
    }
    const env = parseEnv(read(".env.example"));
    const database = new URL(env.DATABASE_URL);
    expect(database.hostname).toBe("127.0.0.1");
    expect(database.port).toBe(env.POSTGRES_PORT);
    expect(database.username).toBe(env.POSTGRES_USER);
    expect(database.password).toBe(env.POSTGRES_PASSWORD);
    expect(database.pathname).toBe(`/${env.POSTGRES_DB}`);
    expect(env.CORS_ORIGIN).toBe("http://localhost:5173");
    const frontend = parseEnv(read("frontend/.env.example"));
    expect(frontend.VITE_API_URL).toBe(`http://localhost:${env.BACKEND_PORT}`);
    expect(Object.keys(frontend)).toEqual(["VITE_API_URL"]);
    expect(env).not.toHaveProperty("DATABASE_URL_DOCKER");
    expect(env).not.toHaveProperty("API_PORT");
  });

  it("keeps PostgreSQL provisioning variables off the test API container", () => {
    const { services } = parse(read("compose.e2e.yml"));
    expect(services.api.build.context).toBe("./my-backend");
    expect(services.api.environment.DATABASE_URL).toContain("@db:5432/");
    for (const key of ["POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD"]) {
      expect(services.api.environment).not.toHaveProperty(key);
      expect(services.db.environment).toHaveProperty(key);
    }
  });

  it("does not leave competing backend manifests or the obsolete dev image", () => {
    for (const file of ["backend/package.json", "backend-go/go.mod", "frontend/Dockerfile.dev"]) {
      expect(existsSync(path.join(repositoryDir, file))).toBe(false);
    }
    expect(existsSync(path.join(repositoryDir, "my-backend/go.mod"))).toBe(true);
  });
});
