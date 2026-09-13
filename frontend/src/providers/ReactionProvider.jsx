import { useState, useRef, useEffect } from "react";
import { GameContext } from "./reactionGameContext.js";
import { useScoreDelivery } from "./scoreDeliveryContext.js";

import { detectDeviceType } from "../lib/deviceType.js";

const MIN_DELAY = 500;
const MAX_DELAY = 5000;
const REQUIRED_ROUND_COUNT = 5;

const initialState = {
  totalRounds: REQUIRED_ROUND_COUNT,
  phase: "start",
  round: 0,
  times: [],
  misslicks: 0,
  message: "Click to start.",
};

// Export to wrap component with provider
export function GameProvider({ children }) {
  const [game, setGame] = useState(initialState);
  const [submissionId, setSubmissionId] = useState(null);
  const { submissions, submitScore, retryNow, availability, pendingCount } = useScoreDelivery();

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const submissionIdRef = useRef(null);
  const submissionState = submissionId ? submissions[submissionId] : null;

  useEffect(() => {
    // Runs when component is destroyed
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const update = (patch) => setGame((prev) => ({ ...prev, ...patch }));

  const setTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);

    timerRef.current = setTimeout(() => {
      startTimeRef.current = performance.now();
      update({ phase: "go", message: "Click!" });
    }, delay);
  };

  const evaluateRound = () => {
    setGame((prev) => {
      const { phase, round, times, misslicks } = prev;

      if (phase === "start" || phase === "summary") {
        setTimers();
        return {
          ...prev,
          deviceType: detectDeviceType(),
          phase: "wait",
          round: 1,
          times: [],
          misslicks: 0,
          message: "Wait...",
        };
      }

      if (phase === "wait") {
        setTimers();
        return { ...prev, misslicks: misslicks + 1, message: "Too soon!" };
      }

      if (phase === "go") {
        const score = Math.round(performance.now() - startTimeRef.current);
        const newTimes = [...times, score];

        if (newTimes.length >= prev.totalRounds) {
          return { ...prev, phase: "summary", times: newTimes, message: "Finished!" };
        } else {
          return {
            ...prev,
            phase: "result",
            times: newTimes,
            message: "Time: {{score}}ms. Click for next round.",
          };
        }
      }

      if (phase === "result") {
        setTimers();
        return { ...prev, phase: "wait", round: round + 1, message: "Wait..." };
      }

      return prev;
    });
  };

  const resetGame = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    submissionIdRef.current = null;
    setSubmissionId(null);
    setGame(initialState);
  };

  const saveScore = (displayName) => {
    const normalizedDisplayName = displayName.trim();
    const currentSubmissionId = submissionIdRef.current ?? crypto.randomUUID();
    submissionIdRef.current = currentSubmissionId;
    setSubmissionId(currentSubmissionId);
    const payload = {
      submissionId: currentSubmissionId,
      times: game.times,
      deviceType: game.deviceType ?? "computer",
      missclicks: game.misslicks,
    };

    if (normalizedDisplayName) {
      payload.displayName = normalizedDisplayName;
    }

    void submitScore(payload);
  };

  const submissionStatus = submissionState?.status ?? "idle";
  const isSavingScore = ["queueing", "sending", "retrying"].includes(submissionStatus);
  const isScoreQueued = submissionStatus === "queued";
  const isScoreSaved = submissionStatus === "saved";
  const scoreSaveError = submissionStatus === "failed" ? submissionState.error : null;

  const value = {
    game,
    evaluateRound,
    resetGame,
    saveScore,
    isSavingScore,
    isScoreQueued,
    isScoreSaved,
    scoreSaveError,
    scoreDeliveryAttempt: submissionState?.attempt ?? null,
    scoreDeliveryMaxAttempts: submissionState?.maxAttempts ?? null,
    deliveryAvailability: availability,
    pendingScoreCount: pendingCount,
    retryQueuedScores: retryNow,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
