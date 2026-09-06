import { describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { createScoreOutbox } from "./scoreOutbox.js";
import { createScoreDelivery } from "../services/scoreDelivery.js";
import { createDeliveryNotifications } from "./deliveryNotifications.js";

const score = (id) => ({ submissionId: id, times: [200, 210, 220, 230, 240], missclicks: 0 });
const unavailable = Object.assign(new Error("Unavailable"), { isRetryable: true, status: 503 });

function watch(delivery) {
  const notices = [];
  const observe = createDeliveryNotifications(delivery.getSnapshot());
  delivery.subscribe(() => {
    const notice = observe(delivery.getSnapshot());
    if (notice && notices.at(-1) !== notice) notices.push(notice);
  });
  return notices;
}

describe("score notifications", () => {
  it("updates one retry popup, stays quiet during failed probes, and confirms recovered scores", async () => {
    const sendScore = vi.fn().mockRejectedValue(unavailable);
    const checkReadiness = vi.fn().mockRejectedValue(unavailable);
    const delivery = createScoreDelivery({
      outbox: createScoreOutbox(new IDBFactory()),
      sendScore,
      checkReadiness,
      retryDelaysMs: [1, 2],
      sleep: async () => {},
      eventTarget: null,
    });
    const notices = watch(delivery);
    try {
      await delivery.start();
      await delivery.submit(score("a"));
      const retries = notices.filter((notice) => notice.phase === "retrying");
      expect(retries.length).toBeGreaterThan(1);
      expect(new Set(retries.map((notice) => notice.id)).size).toBe(1);
      expect(notices.at(-1).phase).toBe("waiting");

      await delivery.submit(score("b"));
      const waitingNotice = notices.at(-1);
      await delivery.retryNow();
      await delivery.retryNow();
      expect(notices.at(-1)).toBe(waitingNotice);

      sendScore.mockResolvedValue({ id: 1 });
      checkReadiness.mockResolvedValue({ status: "ready" });
      await delivery.retryNow();
      expect(notices.some((notice) => notice.title === "Saving previous scores…")).toBe(true);
      expect(notices.at(-1)).toMatchObject({
        title: "2 previous scores saved",
        phase: "saved",
        busy: false,
      });
    } finally {
      delivery.stop();
    }
  });

  it("announces scores recovered after reopening the app", async () => {
    const outbox = createScoreOutbox(new IDBFactory());
    await outbox.put(score("previous"));
    const delivery = createScoreDelivery({
      outbox,
      sendScore: async () => ({ id: 1 }),
      checkReadiness: async () => ({ status: "ready" }),
      eventTarget: null,
    });
    const notices = watch(delivery);
    try {
      await delivery.start();
      expect(notices.at(-1).title).toBe("Previous score saved");
    } finally {
      delivery.stop();
    }
  });

  it("never reports a partial failure as all scores saved or leaves a progress spinner", async () => {
    const outbox = createScoreOutbox(new IDBFactory());
    await outbox.put(score("bad"));
    await outbox.put(score("good"));
    const delivery = createScoreDelivery({
      outbox,
      sendScore: async (payload) => {
        if (payload.submissionId === "bad") throw new Error("Invalid score");
        return { id: 2 };
      },
      checkReadiness: async () => ({ status: "ready" }),
      eventTarget: null,
    });
    const notices = watch(delivery);
    try {
      await delivery.start();
      expect(notices.at(-1)).toMatchObject({ tone: "error", busy: false });
      expect(notices.at(-1).message).toContain("1 saved; 1 could not be saved");
      expect(notices.some((notice) => notice.phase === "saved")).toBe(false);
    } finally {
      delivery.stop();
    }
  });

  it("does not promise a local copy when browser storage fails", async () => {
    const delivery = createScoreDelivery({
      outbox: {
        listPending: async () => [],
        put: async () => {
          throw new Error("Quota exceeded");
        },
      },
      eventTarget: null,
    });
    const notices = watch(delivery);
    try {
      await delivery.start();
      await delivery.submit(score("a"));
      expect(notices.at(-1)).toMatchObject({ title: "Couldn’t keep your score", tone: "error" });
      expect(notices.at(-1).message).toContain("Keep this page open");
    } finally {
      delivery.stop();
    }
  });
});
