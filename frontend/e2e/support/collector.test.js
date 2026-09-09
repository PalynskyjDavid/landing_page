import { beforeEach, expect, it, vi } from "vitest";
import { collector } from "./collector.js";
import { assertDatabaseLock, compose, inspectContainer } from "./database.js";
vi.mock("./database.js", () => ({
  assertDatabaseLock: vi.fn(),
  compose: vi.fn(),
  inspectContainer: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  inspectContainer.mockReturnValue({ State: { Running: true } });
});
it("requires the lock and container ownership before removing the sidecar", () => {
  assertDatabaseLock.mockImplementation(() => {
    throw new Error("wrong lock");
  });
  expect(() => collector("remove", "bad")).toThrow("wrong lock");
  expect(compose).not.toHaveBeenCalled();
});
it("starts only the sidecar and removes it without deleting data", () => {
  collector("up", "token");
  expect(inspectContainer).toHaveBeenCalledWith(true, "web");
  expect(compose).toHaveBeenCalledWith([
    "up",
    "--detach",
    "--no-deps",
    "--wait",
    "--wait-timeout",
    "60",
    "collector",
  ]);
  compose.mockClear();
  collector("remove", "token");
  expect(compose.mock.calls).toEqual([[["stop", "collector"]], [["rm", "--force", "collector"]]]);
});
