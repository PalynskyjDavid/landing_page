import { useI18n } from "../i18n/useI18n.js";
import { useEffect, useState } from "react";
import { createDeliveryNotifications } from "../lib/deliveryNotifications.js";
import { scoreDelivery } from "../services/scoreDelivery.js";
import "./ScoreDeliveryNotifications.css";

function NotificationCard({ notification, onDismiss }) {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const { title, message, tone, busy, autoCloseMs } = notification;

  useEffect(() => {
    if (!autoCloseMs || hovered || focused) return;
    const timer = setTimeout(onDismiss, autoCloseMs);
    return () => clearTimeout(timer);
  }, [autoCloseMs, hovered, focused, onDismiss]);

  return (
    <div
      className="delivery-notice"
      data-tone={tone}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <span className="delivery-notice-icon" aria-hidden="true">
        {busy ? (
          <svg className="delivery-notice-spinner" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.2" />
            <path
              d="M12 3a9 9 0 0 1 9 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {tone === "success" ? (
              <path d="m5 12 4 4L19 6" />
            ) : (
              <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6m0 4h.01" />
              </>
            )}
          </svg>
        )}
      </span>
      <div className="delivery-notice-copy">
        <p className="delivery-notice-title">
          {t(notification.titleKey ?? title, notification.values)}
        </p>
        <p className="delivery-notice-message">
          {t(notification.messageKey ?? message, notification.values)}
        </p>
      </div>
      <button
        type="button"
        className="delivery-notice-dismiss"
        aria-label={t("Dismiss notification")}
        onClick={onDismiss}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}

export default function ScoreDeliveryNotifications() {
  const [notification, setNotification] = useState(null);
  const [dismissedId, setDismissedId] = useState(null);

  useEffect(() => {
    const observe = createDeliveryNotifications(scoreDelivery.getSnapshot());
    return scoreDelivery.subscribe(() => {
      setNotification(observe(scoreDelivery.getSnapshot()));
    });
  }, []);

  const visible = notification && notification.id !== dismissedId;

  // Keep the polite live region mounted so assistive technology announces updates.
  return (
    <div className="delivery-notice-region" role="status" aria-live="polite" aria-atomic="true">
      {visible && (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={() => setDismissedId(notification.id)}
        />
      )}
    </div>
  );
}
