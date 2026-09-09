const activeStatuses = new Set(["queueing", "queued", "sending", "retrying"]);

// Observe every delivery transition, including transitions React may batch together.
// One notification represents a batch of scores, so probes never create a stack.
export function createDeliveryNotifications(initialSnapshot) {
  let previous = initialSnapshot;
  let notification = null;
  let batch = 0;
  let active = false;
  let recovered = false;
  let saved = 0;
  let failed = 0;

  function show(phase, title, message, options = {}) {
    const next = {
      id: `${batch}:${phase}`,
      phase,
      title,
      message,
      tone: "info",
      busy: false,
      autoCloseMs: null,
      ...options,
    };
    if (JSON.stringify(next) !== JSON.stringify(notification)) {
      notification = next;
    }
    return notification;
  }

  return (snapshot) => {
    const entries = Object.values(snapshot.submissions);
    const changed = entries.filter(
      (entry) => previous.submissions[entry.submissionId]?.status !== entry.status,
    );
    const work = entries.filter((entry) => activeStatuses.has(entry.status));
    previous = snapshot;

    if (!active && (work.length > 0 || snapshot.pendingCount > 0)) {
      batch += 1;
      active = true;
      recovered = false;
      saved = 0;
      failed = 0;
    }

    if (!active) return notification;

    saved += changed.filter((entry) => entry.status === "saved").length;
    const failures = changed.filter((entry) => entry.status === "failed");
    failed += failures.length;
    recovered ||= snapshot.availability === "recovering";

    if (failures.length > 0) {
      const storageFailed = failures.some((entry) => entry.error?.code === "outbox_unavailable");
      show(
        "failed",
        storageFailed ? "Couldn’t keep your score" : "Couldn’t save a score",
        storageFailed
          ? "Browser storage is unavailable. Keep this page open and try Save score again."
          : "This score needs attention. Automatic retries have stopped for it.",
        { tone: "error" },
      );
    }

    if (snapshot.pendingCount === 0 && work.length === 0) {
      active = false;
      if (failed > 0) {
        if (notification?.phase === "failed" && saved === 0) return notification;
        return show(
          "failed",
          "Some scores need attention",
          `${saved} saved; ${failed} could not be saved. Automatic retries have stopped for the failed scores.`,
          { tone: "error" },
        );
      }
      if (saved > 0) {
        return show(
          "saved",
          recovered
            ? `${saved === 1 ? "Previous score" : `${saved} previous scores`} saved`
            : saved === 1
              ? "Score saved"
              : `${saved} scores saved`,
          "Your results have reached the leaderboard.",
          { tone: "success", autoCloseMs: 6000 },
        );
      }
      return notification;
    }

    if (failures.length > 0) return notification;

    if (snapshot.availability === "rate_limited") {
      return show(
        "rate_limited",
        "Waiting for the rate limit",
        "Your scores remain in this browser. Saving will resume after the server’s cooldown.",
        { tone: "warning", autoCloseMs: 10000 },
      );
    }

    // "queueing" has not committed to browser storage yet.
    const waitingCount = Math.max(
      snapshot.pendingCount,
      work.filter((entry) => entry.status !== "queueing").length,
    );
    if (
      waitingCount > 0 &&
      (snapshot.availability === "unavailable" ||
        (snapshot.availability === "checking" && notification?.phase === "waiting"))
    ) {
      return show(
        "waiting",
        "Scores saved for later",
        `${waitingCount} ${waitingCount === 1 ? "score is" : "scores are"} kept in this browser. We’ll send ${waitingCount === 1 ? "it" : "them"} when the connection returns.`,
        { tone: "warning", autoCloseMs: 10000 },
      );
    }

    if (snapshot.availability === "recovering") {
      return show(
        "recovering",
        "Saving previous scores…",
        "The connection is back. Sending your waiting scores one at a time.",
        { busy: true },
      );
    }

    if (snapshot.availability === "checking") {
      return show("checking", "Checking connection…", "Looking for scores waiting to be saved.", {
        busy: true,
      });
    }

    const retry = work.find((entry) => entry.status === "retrying");
    if (retry) {
      return show(
        "retrying",
        "Retrying…",
        `Attempt ${retry.attempt} of ${retry.maxAttempts}. Your score is kept in this browser.`,
        { busy: true },
      );
    }

    return show("saving", "Saving your score…", "You can keep playing while we save it.", {
      busy: true,
    });
  };
}
