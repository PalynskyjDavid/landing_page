import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createScoreOutbox } from "./scoreOutbox.js";

const firstSubmission = {
  submissionId: "00000000-0000-4000-8000-000000000001",
  times: [200, 210, 220, 230, 240],
  missclicks: 1,
  displayName: "David",
};

describe("score outbox", () => {
  it("persists a pending submission across outbox instances", async () => {
    const databaseFactory = new IDBFactory();
    const firstInstance = createScoreOutbox(databaseFactory);

    await firstInstance.put(firstSubmission);

    const secondInstance = createScoreOutbox(databaseFactory);
    const pending = await secondInstance.listPending();

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      ...firstSubmission,
      status: "pending",
      attemptCount: 0,
    });
  });

  it("removes saved submissions and excludes permanent failures", async () => {
    const outbox = createScoreOutbox(new IDBFactory());
    const secondSubmission = {
      ...firstSubmission,
      submissionId: "00000000-0000-4000-8000-000000000002",
    };

    await outbox.put(firstSubmission);
    await outbox.put(secondSubmission);
    await outbox.remove(firstSubmission.submissionId);
    await outbox.markFailed(secondSubmission.submissionId, {
      attemptCount: 1,
      lastError: { message: "Invalid score.", status: 400 },
    });

    await expect(outbox.listPending()).resolves.toEqual([]);
  });
});
