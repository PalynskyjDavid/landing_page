import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { acquireDatabaseLock, database, runCommand } from "./database.js";
import { main } from "../../scripts/test-e2e.js";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("./database.js", () => ({
  acquireDatabaseLock: vi.fn(),
  database: vi.fn(),
  runCommand: vi.fn(),
}));

describe("E2E runner failure handling (no Docker required)", () => {
  let release;
  let info;
  let errorLog;
  let childExitCode;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("KEEP_TEST_DB", "false");
    info = vi.spyOn(console, "info").mockImplementation(() => {});
    errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    release = vi.fn();
    acquireDatabaseLock.mockReturnValue({ token: "test-lock", release });
    childExitCode = 0;
    spawn.mockImplementation(() => {
      const child = new EventEmitter();
      queueMicrotask(() => child.emit("close", childExitCode));
      return child;
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const actions = () => database.mock.calls.map(([action]) => action);

  it("cleans up a successful run without printing failure logs", async () => {
    await expect(main()).resolves.toBe(0);
    expect(actions()).toEqual(["setup", "down"]);
    expect(runCommand).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce();
  });

  it("prints logs before cleanup when setup fails, preserving the original error", async () => {
    const setupError = new Error("connection reset by peer");
    database.mockImplementation((action) => {
      if (action === "setup") throw setupError;
      if (action === "logs" || action === "down") throw new Error("Docker unavailable");
    });
    await expect(main()).rejects.toBe(setupError);
    expect(actions()).toEqual(["setup", "logs", "down"]);
    expect(spawn).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining("Could not read"));
  });

  it("prints logs after a build failure, before removing the database", async () => {
    runCommand.mockImplementation(() => {
      throw new Error("Go build failed");
    });
    await expect(main()).rejects.toThrow("Go build failed");
    expect(actions()).toEqual(["setup", "logs", "down"]);
    expect(spawn).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });

  it("keeps a nonzero Playwright exit even if cleanup also fails", async () => {
    childExitCode = 2;
    database.mockImplementation((action) => {
      if (action === "down") throw new Error("cleanup failed");
    });
    await expect(main()).resolves.toBe(2);
    expect(actions()).toEqual(["setup", "logs", "down"]);
    expect(release).toHaveBeenCalledOnce();
  });

  it("fails the command if cleanup fails after passing tests", async () => {
    database.mockImplementation((action) => {
      if (action === "down") throw new Error("cleanup failed");
    });
    await expect(main()).rejects.toThrow("cleanup failed");
    expect(release).toHaveBeenCalledOnce();
  });

  it("does not claim the database is ready when setup failed in keep mode", async () => {
    vi.stubEnv("KEEP_TEST_DB", "true");
    database.mockImplementation((action) => {
      if (action === "setup") throw new Error("Docker unavailable");
    });
    await expect(main()).rejects.toThrow("Docker unavailable");
    expect(actions()).toEqual(["setup", "logs"]);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("setup did not complete"));
    expect(info).not.toHaveBeenCalledWith(expect.stringContaining("kept for inspection:"));
    expect(release).toHaveBeenCalledOnce();
  });

  it("keeps the database and its logs after a failed test in keep mode", async () => {
    vi.stubEnv("KEEP_TEST_DB", "true");
    childExitCode = 1;
    await expect(main()).resolves.toBe(1);
    expect(actions()).toEqual(["setup", "logs"]);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("kept for inspection:"));
    expect(release).toHaveBeenCalledOnce();
  });

  it("does not acquire a lock for an invalid keep option", async () => {
    vi.stubEnv("KEEP_TEST_DB", "yes");
    await expect(main()).rejects.toThrow("KEEP_TEST_DB must be true or false");
    expect(acquireDatabaseLock).not.toHaveBeenCalled();
  });
});
