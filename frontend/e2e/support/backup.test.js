import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import {
  assertRestoreOwned,
  backup,
  backupDir,
  backupPath,
  command,
  sourceIdentity,
  withRestoredDatabase,
} from "../../scripts/lib/database-backup.js";
import { repositoryDir } from "./environment.js";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

function ownedDB() {
  return {
    Id: "owned-id",
    Name: "/events_db",
    State: { Running: true },
    Config: {
      Labels: {
        "com.docker.compose.service": "db",
        "com.docker.compose.project.working_dir": repositoryDir,
        "com.docker.compose.project.config_files": path.join(repositoryDir, "docker-compose.yml"),
      },
      Env: ["POSTGRES_DB=eventsdb", "POSTGRES_USER=eventsuser", "POSTGRES_PASSWORD=do-not-log"],
    },
  };
}

describe("backup and isolated restore safeguards", () => {
  beforeEach(() => vi.resetAllMocks());
  it("accepts only the owned running development DB and never returns its password", () => {
    expect(sourceIdentity(ownedDB(), "development")).toEqual({
      id: "owned-id",
      database: "eventsdb",
      user: "eventsuser",
    });
    const foreign = ownedDB();
    foreign.Config.Labels["com.docker.compose.project.working_dir"] = path.join(
      repositoryDir,
      "other",
    );
    expect(() => sourceIdentity(foreign, "development")).toThrow("ownership");
    const stopped = ownedDB();
    stopped.State.Running = false;
    expect(() => sourceIdentity(stopped, "development")).toThrow("running");
  });
  it("requires exact E2E labels and identity, not just a familiar container name", () => {
    const container = ownedDB();
    container.Config.Labels["com.docker.compose.project"] = "landing-page-e2e";
    container.Config.Labels["landing-page.e2e"] = "true";
    expect(() => sourceIdentity(container, "e2e")).toThrow("identity");
    container.Config.Env = ["POSTGRES_DB=reaction_e2e", "POSTGRES_USER=e2e_user"];
    expect(sourceIdentity(container, "e2e").database).toBe("reaction_e2e");
  });
  it.each(["", "../data.dump", "C:\\data.dump", "/data.dump", "backup.sql", "x..dump"])(
    "rejects unsafe backup filename %s",
    (file) => {
      expect(() => backupPath(file)).toThrow("basename");
    },
  );
  it("resolves a safe filename only under .backups", () => {
    expect(backupPath("development-123.dump")).toBe(path.join(backupDir, "development-123.dump"));
  });
  it("rejects arbitrary database sources before Docker is invoked", () => {
    expect(() => backup("production")).toThrow("SOURCE");
    expect(spawnSync).not.toHaveBeenCalled();
  });
  it("rejects arbitrary restore paths before Docker is invoked", async () => {
    await expect(withRestoredDatabase("../database.dump", vi.fn())).rejects.toThrow("basename");
    expect(spawnSync).not.toHaveBeenCalled();
  });
  it("requires matching cleanup token/name AND no network or public ports", () => {
    const container = {
      Name: "/landing-page-restore-test",
      Config: { Labels: { "landing-page.restore-token": "test" } },
      HostConfig: { NetworkMode: "none", PortBindings: {} },
    };
    expect(() => assertRestoreOwned(container, "test")).not.toThrow();
    expect(() => assertRestoreOwned(container, "someone-else")).toThrow("cleanup");
    container.HostConfig.NetworkMode = "bridge";
    expect(() => assertRestoreOwned(container, "test")).toThrow("cleanup");
    container.HostConfig.NetworkMode = "none";
    container.HostConfig.PortBindings = { "5432/tcp": [] };
    expect(() => assertRestoreOwned(container, "test")).toThrow("cleanup");
  });
  it("streams binary output directly to a file descriptor, not a PowerShell text pipe", () => {
    spawnSync.mockReturnValue({ status: 0, stdout: null });
    command(["exec", "id", "pg_dump"], { output: 42 });
    expect(spawnSync).toHaveBeenCalledWith(
      "docker",
      ["exec", "id", "pg_dump"],
      expect.objectContaining({
        stdio: ["ignore", 42, "pipe"],
        encoding: undefined,
        windowsHide: true,
      }),
    );
  });
  it("never prints stderr or inspect secrets on failure", () => {
    spawnSync.mockReturnValue({ status: 1, stderr: "private-password" });
    expect(() => command(["inspect", "id"])).toThrow("Docker inspect failed (1)");
    try {
      command(["inspect", "id"]);
    } catch (error) {
      expect(error.message).not.toContain("private-password");
    }
  });
});
