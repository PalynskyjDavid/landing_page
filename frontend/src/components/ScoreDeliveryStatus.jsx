import { useScoreDelivery } from "../providers/scoreDeliveryContext.js";

const availabilityLabels = {
  checking: "Checking whether score storage is available…",
  recovering: "Connection restored. Sending queued scores…",
  unavailable: "Score storage is temporarily unavailable.",
};

export default function ScoreDeliveryStatus() {
  const { availability, pendingCount, retryNow, systemError } = useScoreDelivery();

  if (pendingCount === 0 && !systemError) {
    return null;
  }

  const label = availabilityLabels[availability];

  return (
    <section
      className="mx-auto my-4 w-[98%] max-w-[600px] rounded-xl border p-4"
      aria-live="polite"
    >
      {label && <p>{label}</p>}
      {pendingCount > 0 && (
        <p>
          {pendingCount} {pendingCount === 1 ? "score is" : "scores are"} safely queued in this
          browser.
        </p>
      )}
      {systemError && pendingCount === 0 && <p>Delivery monitor error: {systemError.message}</p>}
      {pendingCount > 0 && availability === "unavailable" && (
        <button type="button" className="ui-btn mt-3" onClick={() => void retryNow()}>
          Try now
        </button>
      )}
    </section>
  );
}
