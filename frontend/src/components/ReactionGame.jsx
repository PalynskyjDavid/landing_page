import { useState } from "react";
import { useGame } from "../providers/reactionGameContext.js";

const DISPLAY_NAME_STORAGE_KEY = "reactionGame.displayName";

function loadDisplayName() {
  try {
    return window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberDisplayName(displayName) {
  try {
    if (displayName) {
      window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, displayName);
    } else {
      window.localStorage.removeItem(DISPLAY_NAME_STORAGE_KEY);
    }
  } catch {
    // Saving the score still works when browser storage is unavailable.
  }
}

function Card({ children, className = "", style = {} }) {
  const baseStyle = {
    boxShadow: "4px 4px 15px 2px rgb(var(--fg))",
    display: "flex",
    flexDirection: "column",
    alignItems: "center", //default y-axis, here for column y-axis
    width: "98%",
    maxWidth: "600px",
    border: "2px solid rgb(var(--fg))",
    borderRadius: "12px",
    backgoundColor: "red",
  };

  return (
    <div
      //Pisitioning agains other elements around
      className={`mx-auto my-[2dvh] ${className}`}
      //Styling of insides, overrides className if needed.
      style={{ ...baseStyle, ...style }}
    >
      {children}
    </div>
  );
}

export default function ReactionGame() {
  const {
    game,
    evaluateRound,
    resetGame,
    saveScore,
    isSavingScore,
    isScoreQueued,
    isScoreSaved,
    scoreSaveError,
    scoreDeliveryAttempt,
    scoreDeliveryMaxAttempts,
    deliveryAvailability,
    retryQueuedScores,
  } = useGame();
  const [displayName, setDisplayName] = useState(loadDisplayName);

  const bgColor =
    game.phase === "go" ? "#00ff0472" : game.phase === "wait" ? "#ff000032" : "#ffffff00";
  const pulseStyle =
    game.phase === "go"
      ? {
          cursor: "pointer",
        }
      : {};

  const submitScore = (event) => {
    event.preventDefault();

    const normalizedDisplayName = displayName.trim();
    rememberDisplayName(normalizedDisplayName);
    setDisplayName(normalizedDisplayName);
    saveScore(normalizedDisplayName);
  };

  if (game.phase === "summary") {
    const averageMs = Math.floor(
      game.times.reduce((total, timeMs) => total + timeMs, 0) / game.times.length,
    );

    return (
      <Card>
        <div className="summary-screen p-6 w-full">
          <h2>Finished!</h2>
          <p>Average: {averageMs} ms</p>
          <p>Misclicks: {game.misslicks}</p>

          <form onSubmit={submitScore} className="flex flex-col gap-3 mt-4">
            <label htmlFor="display-name">Display name (optional)</label>
            <input
              id="display-name"
              type="text"
              maxLength={24}
              value={displayName}
              disabled={isSavingScore || isScoreQueued || isScoreSaved}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Anonymous"
            />
            <button
              type="submit"
              className="ui-btn ui-surface-inverse"
              disabled={isSavingScore || isScoreQueued || isScoreSaved}
            >
              {isScoreQueued
                ? "Queued for delivery"
                : isSavingScore
                  ? "Saving..."
                  : isScoreSaved
                    ? "Score saved"
                    : "Save score"}
            </button>
          </form>

          {isSavingScore && scoreDeliveryAttempt > 1 && (
            <p role="status">
              Retrying — attempt {scoreDeliveryAttempt} of {scoreDeliveryMaxAttempts}
            </p>
          )}
          {isScoreQueued && (
            <div role="status" className="mt-3">
              <p>Your score is safely stored in this browser and will be sent after recovery.</p>
              {deliveryAvailability === "unavailable" && (
                <button
                  type="button"
                  className="ui-btn mt-2"
                  onClick={() => void retryQueuedScores()}
                >
                  Try now
                </button>
              )}
            </div>
          )}
          {scoreSaveError && <p role="alert">Could not save score: {scoreSaveError.message}</p>}

          <button className="ui-btn mt-4" onClick={resetGame}>
            Play again
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={game.phase === "go" ? "pulse" : ""}
      style={{
        backgroundColor: bgColor,
        ...pulseStyle,
      }}
    >
      <div
        style={{
          height: "45px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center", //y axis
          justifyContent: "space-evenly", //x-axis
        }}
      >
        {game.round != 0 ? (
          <>
            <p>
              Round {game.round} / {game.totalRounds}
            </p>
            <button className="ui-btn ui-surface-inverse ml-5" onClick={resetGame}>
              Restart
            </button>
          </>
        ) : (
          "Click only when green appears."
        )}
      </div>

      <div
        className="w-full h-40 flex flex-grow items-center justify-center"
        onMouseDown={evaluateRound}
      >
        {game.message}
      </div>
    </Card>
  );
}
