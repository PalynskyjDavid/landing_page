import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, readSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withRestoredDatabase } from "../../scripts/lib/database-backup.js";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
vi.mock("node:fs", () => ({
  closeSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  openSync: vi.fn(() => 10),
  readFileSync: vi.fn(),
  readSync: vi.fn(),
  renameSync: vi.fn(),
  statSync: vi.fn(),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe("restore failure handling (no Docker or files)", () => {
  let token;
  let failRestore;
  let tamperOwnership;
  beforeEach(() => {
    vi.resetAllMocks();
    failRestore = false;
    tamperOwnership = false;
    readFileSync.mockReturnValue(
      JSON.stringify({ format: 1, file: "test.dump", sha256: createHash("sha256").digest("hex") }),
    );
    readSync.mockImplementation((_fd, buffer, _offset, _length, position) => {
      if (position === 0) {
        buffer.write("PGDMP");
        return 5;
      }
      return 0;
    });
    spawnSync.mockImplementation((_binary, args) => {
      if (args[0] === "run") {
        token = args[args.indexOf("--label") + 1].split("=")[1];
        return { status: 0, stdout: "owned-restore-id" };
      }
      if (args[0] === "inspect")
        return {
          status: 0,
          stdout: JSON.stringify([
            {
              Name: `/landing-page-restore-${token}`,
              Config: {
                Labels: { "landing-page.restore-token": tamperOwnership ? "foreign" : token },
              },
              HostConfig: { NetworkMode: "none", PortBindings: {} },
            },
          ]),
        };
      if (args.includes("pg_restore") && failRestore)
        return { status: 1, stderr: "private backup contents" };
      return { status: 0, stdout: "" };
    });
  });
  const removals = () => spawnSync.mock.calls.filter(([, args]) => args[0] === "rm");

  it("never creates a container for a damaged checksum", async () => {
    readFileSync.mockReturnValue(JSON.stringify({ format: 1, file: "test.dump", sha256: "wrong" }));
    await expect(withRestoredDatabase("test.dump", vi.fn())).rejects.toThrow("checksum");
    expect(spawnSync).not.toHaveBeenCalled();
  });
  it("restores transactionally without clean/overwrite and removes only the new container", async () => {
    expect(await withRestoredDatabase("test.dump", () => "verified")).toBe("verified");
    const args = spawnSync.mock.calls.find(([, values]) => values.includes("pg_restore"))[1];
    expect(args).toEqual(
      expect.arrayContaining(["--single-transaction", "--exit-on-error", "--no-owner", "--no-acl"]),
    );
    expect(args).not.toContain("--clean");
    expect(removals()).toHaveLength(1);
    expect(removals()[0][1]).toEqual(["rm", "--force", "--volumes", "owned-restore-id"]);
  });
  it("cleans up a failed restore but does not inspect partially restored app data", async () => {
    failRestore = true;
    const inspect = vi.fn();
    await expect(withRestoredDatabase("test.dump", inspect)).rejects.toThrow("Docker exec failed");
    expect(inspect).not.toHaveBeenCalled();
    expect(removals()).toHaveLength(1);
  });
  it("waits for async inspection and still cleans up after an assertion failure", async () => {
    await expect(
      withRestoredDatabase("test.dump", async () => {
        await Promise.resolve();
        expect(removals()).toHaveLength(0);
        throw new Error("comparison failed");
      }),
    ).rejects.toThrow("comparison failed");
    expect(removals()).toHaveLength(1);
  });
  it("refuses cleanup if ownership no longer matches", async () => {
    tamperOwnership = true;
    await expect(withRestoredDatabase("test.dump", vi.fn())).rejects.toThrow("cleanup");
    expect(removals()).toHaveLength(0);
  });
});
