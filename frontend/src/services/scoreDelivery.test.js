import { describe, expect, it, vi } from "vitest";
import { createScoreDelivery } from "./scoreDelivery.js";

function submission(number) {
  return {
    submissionId: `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
    times: [200, 210, 220, 230, 240],
    missclicks: 0,
  };
}

function retryableError(message = "Service unavailable.") {
  return Object.assign(new Error(message), {
    isRetryable: true,
    status: 503,
  });
}

function createMemoryOutbox() {
  const records = new Map();

  return {
    records,
    async put(value) {
      records.set(value.submissionId, {
        ...value,
        status: "pending",
        attemptCount: records.get(value.submissionId)?.attemptCount ?? 0,
        createdAt:
          records.get(value.submissionId)?.createdAt ?? String(records.size).padStart(4, "0"),
        lastError: null,
      });
    },
    async listPending() {
      return [...records.values()]
        .filter((record) => record.status === "pending")
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    },
    async markPending(submissionId, patch) {
      records.set(submissionId, { ...records.get(submissionId), ...patch, status: "pending" });
    },
    async markFailed(submissionId, patch) {
      records.set(submissionId, { ...records.get(submissionId), ...patch, status: "failed" });
    },
    async remove(submissionId) {
      records.delete(submissionId);
    },
  };
}

describe("score delivery", () => {
  it("uses bounded retries and then queues without sending additional scores", async () => {
    const outbox = createMemoryOutbox();
    const sendScore = vi.fn().mockRejectedValue(retryableError());
    const checkReadiness = vi.fn();
    const delivery = createScoreDelivery({
      outbox,
      sendScore,
      checkReadiness,
      retryDelaysMs: [1, 2],
      sleep: vi.fn().mockResolvedValue(undefined),
      eventTarget: undefined,
    });
    await delivery.start();

    await delivery.submit(submission(1));
    await delivery.submit(submission(2));

    expect(sendScore).toHaveBeenCalledTimes(3);
    expect(checkReadiness).not.toHaveBeenCalled();
    expect(delivery.getSnapshot()).toMatchObject({
      availability: "unavailable",
      pendingCount: 2,
    });
    expect(delivery.getSnapshot().submissions[submission(1).submissionId].status).toBe("queued");
    expect(delivery.getSnapshot().submissions[submission(2).submissionId].status).toBe("queued");
    delivery.stop();
  });

  it("checks readiness and delivers persisted work when the application starts", async () => {
    const outbox = createMemoryOutbox();
    await outbox.put(submission(1));
    const sendScore = vi.fn().mockResolvedValue({ id: 1 });
    const checkReadiness = vi.fn().mockResolvedValue({ status: "ready" });
    const delivery = createScoreDelivery({
      outbox,
      sendScore,
      checkReadiness,
      eventTarget: undefined,
    });

    await delivery.start();

    expect(checkReadiness).toHaveBeenCalledOnce();
    expect(sendScore).toHaveBeenCalledWith(submission(1));
    expect(delivery.getSnapshot()).toMatchObject({
      availability: "healthy",
      pendingCount: 0,
    });
    delivery.stop();
  });

  it("probes readiness and drains queued submissions sequentially", async () => {
    const outbox = createMemoryOutbox();
    const sentSubmissionIds = [];
    let available = false;
    const sendScore = vi.fn(async (payload) => {
      sentSubmissionIds.push(payload.submissionId);
      if (!available) {
        throw retryableError();
      }
      return { id: sentSubmissionIds.length, ...payload };
    });
    const delivery = createScoreDelivery({
      outbox,
      sendScore,
      checkReadiness: vi.fn().mockResolvedValue({ status: "ready" }),
      retryDelaysMs: [],
      eventTarget: undefined,
    });
    await delivery.start();
    await delivery.submit(submission(1));
    await delivery.submit(submission(2));

    available = true;
    await delivery.retryNow();

    expect(sentSubmissionIds).toEqual([
      submission(1).submissionId,
      submission(1).submissionId,
      submission(2).submissionId,
    ]);
    expect(delivery.getSnapshot()).toMatchObject({
      availability: "healthy",
      pendingCount: 0,
    });
    expect(delivery.getSnapshot().submissions[submission(1).submissionId].status).toBe("saved");
    expect(delivery.getSnapshot().submissions[submission(2).submissionId].status).toBe("saved");
    delivery.stop();
  });

  it("marks permanent failures without retrying them", async () => {
    const outbox = createMemoryOutbox();
    const permanentError = Object.assign(new Error("Invalid score."), {
      isRetryable: false,
      status: 400,
    });
    const sendScore = vi.fn().mockRejectedValue(permanentError);
    const delivery = createScoreDelivery({
      outbox,
      sendScore,
      checkReadiness: vi.fn(),
      retryDelaysMs: [1, 2, 3],
      sleep: vi.fn().mockResolvedValue(undefined),
      eventTarget: undefined,
    });
    await delivery.start();

    await delivery.submit(submission(1));

    expect(sendScore).toHaveBeenCalledOnce();
    expect(outbox.records.get(submission(1).submissionId).status).toBe("failed");
    expect(delivery.getSnapshot().submissions[submission(1).submissionId]).toMatchObject({
      status: "failed",
      error: { status: 400 },
    });
    delivery.stop();
  });
});
