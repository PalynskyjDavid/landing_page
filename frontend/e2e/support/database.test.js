import { describe, expect, it } from "vitest";
import { assertOwnedContainer } from "./database.js";
import { testEnvironment } from "./environment.js";

function ownedContainer() {
  return {
    Config: {
      Labels: {
        "com.docker.compose.project": "landing-page-e2e",
        "com.docker.compose.service": "db",
        "landing-page.e2e": "true",
      },
      Env: ["POSTGRES_DB=reaction_e2e", "POSTGRES_USER=e2e_user"],
    },
  };
}

describe("E2E database safety (no Docker required)", () => {
  it("requires the collector marker and exact disposable database target", () => {
    const container = ownedContainer();
    container.Config.Labels["com.docker.compose.service"] = "collector";
    container.Config.Env = [
      "LANDING_PAGE_RUNTIME=collector-e2e",
      "DATABASE_URL=postgresql://e2e_user:e2e_password@db:5432/reaction_e2e?sslmode=disable",
    ];
    expect(() => assertOwnedContainer(container, "collector")).not.toThrow();
    container.Config.Env[1] = "DATABASE_URL=postgresql://development/important";
    expect(() => assertOwnedContainer(container, "collector")).toThrow("different database");
    container.Config.Env = [];
    expect(() => assertOwnedContainer(container, "collector")).toThrow("Refusing");
  });
  it("accepts web without database credentials, but requires its runtime marker", () => {
    const container = ownedContainer();
    container.Config.Labels["com.docker.compose.service"] = "web";
    container.Config.Env = ["LANDING_PAGE_RUNTIME=web-e2e"];
    expect(() => assertOwnedContainer(container, "web")).not.toThrow();
    container.Config.Env = [];
    expect(() => assertOwnedContainer(container, "web")).toThrow("Refusing");
  });
  it("accepts the dedicated test container", () => {
    expect(() => assertOwnedContainer(ownedContainer())).not.toThrow();
  });

  it.each(["com.docker.compose.project", "com.docker.compose.service", "landing-page.e2e"])(
    "rejects a mismatched %s label",
    (label) => {
      const container = ownedContainer();
      container.Config.Labels[label] = "development";
      expect(() => assertOwnedContainer(container)).toThrow("Refusing");
    },
  );

  it("rejects a different database even with matching labels", () => {
    const container = ownedContainer();
    container.Config.Env = ["POSTGRES_DB=eventsdb", "POSTGRES_USER=e2e_user"];
    expect(() => assertOwnedContainer(container)).toThrow("Refusing");
  });

  it("overrides an inherited development database URL", () => {
    const env = { DATABASE_URL: "postgresql://development/important", ...testEnvironment };
    expect(new URL(env.DATABASE_URL).pathname).toBe("/reaction_e2e");
    expect(new URL(env.DATABASE_URL).port).toBe("5547");
  });

  it("accepts the test API only when its labels AND database target match", () => {
    const container = ownedContainer();
    container.Config.Labels["com.docker.compose.service"] = "api";
    container.Config.Env.push(
      "DATABASE_URL=postgresql://e2e_user:e2e_password@db:5432/reaction_e2e?sslmode=disable",
    );
    expect(() => assertOwnedContainer(container, "api")).not.toThrow();
    container.Config.Env[2] = "DATABASE_URL=postgresql://development/important";
    expect(() => assertOwnedContainer(container, "api")).toThrow("different database");
  });
});
