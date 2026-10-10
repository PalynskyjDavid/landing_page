import { describe, expect, it, vi } from "vitest";
import { containerLabEnabled, labRequest, labHealthRequest } from "./containerLab.js";

describe("isolated container lab", () => {
  it("reads health history without replaying requests and rejects invalid data", async () => {
    const data = { kind: "isolated-reliability-lab", samples: [] };
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => data });
    await expect(labHealthRequest({ fetchImpl })).resolves.toEqual(data);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/lab-api/health",
      expect.objectContaining({ cache: "no-store" }),
    );
    fetchImpl.mockResolvedValue({ ok: false, json: async () => data });
    await expect(labHealthRequest({ fetchImpl })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    fetchImpl.mockResolvedValue({ ok: true, json: async () => ({ samples: [] }) });
    await expect(labHealthRequest({ fetchImpl })).rejects.toThrow();
  });
  it("does not enable controls on a normal page", () => {
    expect(containerLabEnabled({ querySelector: () => null })).toBe(false);
    expect(containerLabEnabled({ querySelector: () => ({ content: "isolated" }) })).toBe(true);
  });
  it("sends a stop once without passing through the replay/outbox client", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ code: "budget_exhausted" }),
    });
    await expect(
      labRequest({ action: "stop", service: "db", mode: "manual" }, { fetchImpl }),
    ).rejects.toMatchObject({ code: "budget_exhausted" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/lab-api/commands",
      expect.objectContaining({
        method: "POST",
        body: '{"action":"stop","service":"db","mode":"manual"}',
      }),
    );
  });
  it("rejects a response from anything other than the isolated controller", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(labRequest(undefined, { fetchImpl })).rejects.toThrow("Not a lab controller");
  });
});
