import { getReadiness } from "../api/health.js";
import { postScore } from "../api/scores.js";
import { isRetryableError } from "../lib/apiClient.js";
import { scoreOutbox } from "../lib/scoreOutbox.js";

const DEFAULT_RETRY_DELAYS_MS = [1000, 2000, 4000];
const DEFAULT_PROBE_DELAY_MS = 20000;
const DEFAULT_PROBE_JITTER_RATIO = 0.1;

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function errorDetails(error) {
  return {
    message: error?.message ?? "Unknown delivery failure.",
    status: error?.status ?? null,
    code: error?.code ?? null,
  };
}

function scorePayload(record) {
  const payload = {
    submissionId: record.submissionId,
    times: record.times,
    missclicks: record.missclicks,
  };

  if (record.displayName) {
    payload.displayName = record.displayName;
  }

  return payload;
}

export function createScoreDelivery({
  outbox = scoreOutbox,
  sendScore = postScore,
  checkReadiness = getReadiness,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
  probeDelayMs = DEFAULT_PROBE_DELAY_MS,
  probeJitterRatio = DEFAULT_PROBE_JITTER_RATIO,
  sleep = wait,
  random = Math.random,
  eventTarget = globalThis.window,
} = {}) {
  const listeners = new Set();
  const deliveredListeners = new Set();
  let started = false;
  let probeTimer = null;
  let probePromise = null;
  let drainPromise = null;
  let snapshot = {
    availability: "healthy",
    pendingCount: 0,
    nextProbeAt: null,
    submissions: {},
    systemError: null,
  };

  function publish(patch) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  }

  function publishSubmission(submissionId, patch) {
    publish({
      submissions: {
        ...snapshot.submissions,
        [submissionId]: {
          ...snapshot.submissions[submissionId],
          submissionId,
          ...patch,
        },
      },
    });
  }

  function clearProbeTimer() {
    if (probeTimer !== null) {
      clearTimeout(probeTimer);
      probeTimer = null;
    }
    if (snapshot.nextProbeAt !== null) {
      publish({ nextProbeAt: null });
    }
  }

  function nextProbeDelay() {
    const jitter = (random() * 2 - 1) * probeJitterRatio;
    return Math.round(probeDelayMs * (1 + jitter));
  }

  function scheduleProbe() {
    if (!started || snapshot.pendingCount === 0 || probeTimer !== null) {
      return;
    }

    const delayMs = nextProbeDelay();
    publish({ nextProbeAt: Date.now() + delayMs });
    probeTimer = setTimeout(() => {
      probeTimer = null;
      void retryNow();
    }, delayMs);
  }

  async function refreshPendingCount() {
    const entries = await outbox.listPending();
    publish({ pendingCount: entries.length });
    return entries;
  }

  async function deliver(record, allowImmediateRetries) {
    const delays = allowImmediateRetries ? retryDelaysMs : [];
    let totalAttempts = record.attemptCount ?? 0;

    for (let attemptIndex = 0; attemptIndex <= delays.length; attemptIndex += 1) {
      if (!started) {
        return "paused";
      }

      totalAttempts += 1;
      publishSubmission(record.submissionId, {
        status: attemptIndex === 0 ? "sending" : "retrying",
        attempt: attemptIndex + 1,
        maxAttempts: delays.length + 1,
        error: null,
      });

      try {
        const result = await sendScore(scorePayload(record));
        await outbox.remove(record.submissionId);
        publishSubmission(record.submissionId, {
          status: "saved",
          result,
          error: null,
        });
        deliveredListeners.forEach((listener) => listener(result));
        return "saved";
      } catch (error) {
        const serializedError = errorDetails(error);
        await outbox.markPending(record.submissionId, {
          attemptCount: totalAttempts,
          lastError: serializedError,
        });

        if (!isRetryableError(error)) {
          await outbox.markFailed(record.submissionId, {
            attemptCount: totalAttempts,
            lastError: serializedError,
          });
          publishSubmission(record.submissionId, {
            status: "failed",
            error: serializedError,
          });
          return "failed";
        }

        if (attemptIndex < delays.length) {
          publishSubmission(record.submissionId, {
            status: "retrying",
            attempt: attemptIndex + 2,
            maxAttempts: delays.length + 1,
            error: serializedError,
          });
          await sleep(delays[attemptIndex]);
          continue;
        }

        publishSubmission(record.submissionId, {
          status: "queued",
          error: serializedError,
        });
        return "temporarily_unavailable";
      }
    }

    return "temporarily_unavailable";
  }

  async function runDrain({ recovering = false } = {}) {
    clearProbeTimer();
    if (recovering) {
      publish({ availability: "recovering" });
    }

    while (started) {
      const entries = await refreshPendingCount();
      if (entries.length === 0) {
        publish({ availability: "healthy", nextProbeAt: null });
        return;
      }

      const outcome = await deliver(entries[0], !recovering);
      if (outcome === "temporarily_unavailable" || outcome === "paused") {
        await refreshPendingCount();
        publish({ availability: "unavailable" });
        scheduleProbe();
        return;
      }
    }
  }

  function drain(options) {
    if (drainPromise) {
      return drainPromise;
    }

    drainPromise = runDrain(options)
      .catch((error) => {
        publish({
          availability: "unavailable",
          systemError: errorDetails(error),
        });
        scheduleProbe();
      })
      .finally(() => {
        drainPromise = null;
      });

    return drainPromise;
  }

  async function retryNow() {
    if (!started || probePromise) {
      return probePromise;
    }

    clearProbeTimer();
    const entries = await refreshPendingCount();
    if (entries.length === 0) {
      publish({ availability: "healthy" });
      return undefined;
    }

    publish({ availability: "checking", systemError: null });
    probePromise = checkReadiness()
      .then(() => {
        publish({ availability: "recovering" });
        return drain({ recovering: true });
      })
      .catch((error) => {
        publish({
          availability: "unavailable",
          systemError: errorDetails(error),
        });
        scheduleProbe();
      })
      .finally(() => {
        probePromise = null;
      });

    return probePromise;
  }

  async function submit(submission) {
    publishSubmission(submission.submissionId, {
      status: "queueing",
      error: null,
    });

    try {
      await outbox.put(submission);
      publishSubmission(submission.submissionId, { status: "queued" });
      await refreshPendingCount();
    } catch (error) {
      publishSubmission(submission.submissionId, {
        status: "failed",
        error: {
          ...errorDetails(error),
          code: "outbox_unavailable",
        },
      });
      return;
    }

    if (!started) {
      await start();
    }

    if (snapshot.availability === "unavailable" || snapshot.availability === "checking") {
      scheduleProbe();
      return;
    }

    await drain();
  }

  async function start() {
    if (started) {
      return;
    }

    started = true;
    eventTarget?.addEventListener?.("online", retryNow);

    try {
      const entries = await refreshPendingCount();
      entries.forEach((entry) => {
        publishSubmission(entry.submissionId, {
          status: "queued",
          error: entry.lastError,
        });
      });

      if (entries.length > 0) {
        await retryNow();
      }
    } catch (error) {
      publish({ systemError: errorDetails(error) });
    }
  }

  function stop() {
    started = false;
    eventTarget?.removeEventListener?.("online", retryNow);
    clearProbeTimer();
  }

  return {
    start,
    stop,
    submit,
    retryNow,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onDelivered(listener) {
      deliveredListeners.add(listener);
      return () => deliveredListeners.delete(listener);
    },
  };
}

export const scoreDelivery = createScoreDelivery();
