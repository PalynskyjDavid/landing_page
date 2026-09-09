import { beforeEach, describe, expect, it, vi } from "vitest";
import { backend } from "./backend.js";
import { assertDatabaseLock, compose, inspectContainer } from "./database.js";

vi.mock("./database.js", () => ({
  assertDatabaseLock: vi.fn(),
  compose: vi.fn(),
  inspectContainer: vi.fn(),
}));

describe("test API lifecycle (no Docker required)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    inspectContainer.mockReturnValue({ State: { Running: true } });
  });

  it("rejects mutations without the run lock", () => {
    assertDatabaseLock.mockImplementation(() => {
      throw new Error("wrong lock");
    });
    expect(() => backend("kill", "wrong")).toThrow("wrong lock");
    expect(compose).not.toHaveBeenCalled();
  });

  it("checks ownership before stopping the API", () => {
    inspectContainer.mockImplementation(() => {
      throw new Error("not owned");
    });
    expect(() => backend("stop", "token")).toThrow("not owned");
    expect(compose).not.toHaveBeenCalled();
  });

  it("restarts only the API without resetting its database", () => {
    backend("up", "token");
    expect(inspectContainer).toHaveBeenCalledWith(true, "db");
    expect(compose).toHaveBeenCalledExactlyOnceWith([
      "up",
      "--detach",
      "--no-deps",
      "--wait",
      "--wait-timeout",
      "60",
      "api",
    ]);
  });

  it("uses SIGKILL only for an explicitly requested crash", () => {
    backend("kill", "token");
    expect(compose).toHaveBeenCalledExactlyOnceWith(["kill", "--signal", "SIGKILL", "api"]);
  });

  it("gracefully stops before removal, preserving all volumes", () => {
    backend("remove", "token");
    expect(compose.mock.calls).toEqual([[["stop", "api"]], [["rm", "--force", "api"]]]);
  });

  it("does nothing when cleanup finds no API container", () => {
    inspectContainer.mockReturnValue(undefined);
    backend("remove", "token");
    expect(compose).not.toHaveBeenCalled();
  });
});
