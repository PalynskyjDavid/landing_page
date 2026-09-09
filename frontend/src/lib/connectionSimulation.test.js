import { afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { connectionSimulation, createConnectionSimulation } from "./connectionSimulation.js";
import { request } from "./apiClient.js";
import { createScoreOutbox } from "./scoreOutbox.js";
import { createScoreDelivery } from "../services/scoreDelivery.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

afterEach(() => {
  connectionSimulation.setEnabled(false);
  vi.unstubAllGlobals();
});

describe("connection loss simulation", () => {
  it("survives a reload and restoring clears the tab setting without changing another tab", () => {
    const storage = memoryStorage();
    const firstPage = createConnectionSimulation(() => storage);
    const otherTab = createConnectionSimulation(() => memoryStorage());
    firstPage.setEnabled(true);

    const reloadedPage = createConnectionSimulation(() => storage);
    expect(reloadedPage.getSnapshot()).toEqual({ enabled: true, persistent: true });
    expect(otherTab.getSnapshot().enabled).toBe(false);
    reloadedPage.setEnabled(false);
    expect(createConnectionSimulation(() => storage).getSnapshot().enabled).toBe(false);
  });

  it("remains reversible when the browser denies session storage", () => {
    const simulation = createConnectionSimulation(() => {
      throw new Error("Access denied");
    });
    simulation.setEnabled(true);
    expect(simulation.getSnapshot()).toEqual({ enabled: true, persistent: false });
    simulation.setEnabled(false);
    expect(simulation.getSnapshot().enabled).toBe(false);
  });

  it("blocks writes, reads and health probes before fetching, then restores normal requests", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(
        async () => new Response("{}", { headers: { "Content-Type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetch);
    connectionSimulation.setEnabled(true);

    for (const options of [
      { path: "/scores", method: "POST", data: { submissionId: "test" } },
      { path: "/scores/leaderboard" },
      { path: "/health/ready" },
    ]) {
      await expect(request(options)).rejects.toMatchObject({
        code: "simulated_connection_loss",
        isRetryable: true,
        status: null,
      });
    }
    expect(fetch).not.toHaveBeenCalled();
    connectionSimulation.setEnabled(false);
    await expect(request({ path: "/health/ready" })).resolves.toEqual({});
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("interrupts an in-flight API request when connection loss is enabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(signal.reason), { once: true });
          }),
      ),
    );
    const pendingRequest = request({ path: "/scores/leaderboard" });
    const assertion = expect(pendingRequest).rejects.toMatchObject({
      code: "simulated_connection_loss",
      isRetryable: true,
    });
    connectionSimulation.setEnabled(true);
    await assertion;
  });

  it("keeps scores across a simulated outage and shares concurrent restore attempts", async () => {
    const outbox = createScoreOutbox(new IDBFactory());
    const payload = {
      submissionId: "59a435c4-a501-419f-a54a-aab6ce0f0f55",
      times: [201, 202, 203, 204, 205],
      missclicks: 0,
    };
    await outbox.put(payload);
    const fetch = vi
      .fn()
      .mockImplementation(
        async () => new Response("{}", { headers: { "Content-Type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetch);
    connectionSimulation.setEnabled(true);
    const delivery = createScoreDelivery({ outbox, eventTarget: null });

    try {
      await delivery.start();
      expect(fetch).not.toHaveBeenCalled();
      expect(delivery.getSnapshot()).toMatchObject({
        availability: "unavailable",
        pendingCount: 1,
      });

      connectionSimulation.setEnabled(false);
      const firstRestore = delivery.retryNow();
      const secondRestore = delivery.retryNow();
      expect(firstRestore).toBe(secondRestore);
      await firstRestore;
      expect(fetch).toHaveBeenCalledTimes(2);
      const scoreRequest = fetch.mock.calls.find(([, options]) => options.method === "POST");
      expect(JSON.parse(scoreRequest[1].body)).toEqual(payload);
      expect(delivery.getSnapshot()).toMatchObject({ availability: "healthy", pendingCount: 0 });
      await expect(outbox.listPending()).resolves.toEqual([]);
    } finally {
      delivery.stop();
    }
  });
});
