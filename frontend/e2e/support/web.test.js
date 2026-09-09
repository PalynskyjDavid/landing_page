import { beforeEach, describe, expect, it, vi } from "vitest";
import { web } from "./web.js";
import { assertDatabaseLock, compose, inspectContainer } from "./database.js";

vi.mock("./database.js", () => ({
  assertDatabaseLock: vi.fn(),
  compose: vi.fn(),
  inspectContainer: vi.fn(),
}));

describe("test web lifecycle (no Docker required)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    inspectContainer.mockReturnValue({ State: { Running: true } });
  });
  it("requires the run lock before touching containers", () => {
    assertDatabaseLock.mockImplementation(() => {
      throw new Error("wrong lock");
    });
    expect(() => web("stop", "wrong")).toThrow("wrong lock");
    expect(inspectContainer).not.toHaveBeenCalled();
    expect(compose).not.toHaveBeenCalled();
  });
  it("checks ownership before stopping web", () => {
    inspectContainer.mockImplementation(() => {
      throw new Error("not owned");
    });
    expect(() => web("stop", "token")).toThrow("not owned");
    expect(compose).not.toHaveBeenCalled();
  });
  it("starts only web without recreating API or resetting DB", () => {
    web("up", "token");
    expect(inspectContainer).toHaveBeenCalledWith(true, "api");
    expect(compose).toHaveBeenCalledExactlyOnceWith([
      "up",
      "--detach",
      "--no-deps",
      "--wait",
      "--wait-timeout",
      "60",
      "web",
    ]);
  });
  it("gracefully stops before removal and never removes volumes", () => {
    web("remove", "token");
    expect(compose.mock.calls).toEqual([[["stop", "web"]], [["rm", "--force", "web"]]]);
  });
  it("does nothing when there is no web container to remove", () => {
    inspectContainer.mockReturnValue(undefined);
    web("remove", "token");
    expect(compose).not.toHaveBeenCalled();
  });
});
