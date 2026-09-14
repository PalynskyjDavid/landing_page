import { useI18n } from "../i18n/useI18n.js";
import { useScoreDelivery } from "../providers/scoreDeliveryContext.js";

const availabilityLabels = {
  checking: "Checking whether score storage is available…",
  recovering: "Connection restored. Sending queued scores…",
  unavailable: "Score storage is temporarily unavailable.",
  rate_limited: "Saving is paused by the rate limit. Your queued scores will retry automatically.",
};

export default function ScoreDeliveryStatus() {
  const { t, errorText } = useI18n();
  const { availability, pendingCount, retryNow, systemError } = useScoreDelivery();

  if (pendingCount === 0 && !systemError) {
    return null;
  }

  const label = availabilityLabels[availability];

  return (
    <section
      className="mx-auto my-4 w-[98%] max-w-[600px] rounded-xl border-2 p-4"
      aria-live="polite"
    >
      {label && <p>{t(label)}</p>}
      {pendingCount > 0 && <p>{t("scoresQueued", { count: pendingCount })}</p>}
      {systemError && pendingCount === 0 && (
        <p>{t("Delivery monitor error: {{message}}", { message: errorText(systemError) })}</p>
      )}
      {pendingCount > 0 && availability === "unavailable" && (
        <button type="button" className="ui-btn mt-3" onClick={() => void retryNow()}>
          {t("Try now")}
        </button>
      )}
    </section>
  );
}
