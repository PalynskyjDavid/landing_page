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
});
