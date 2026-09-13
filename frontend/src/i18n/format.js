export function localeFor(language) {
  return language?.startsWith("cs") ? "cs-CZ" : "en-GB";
}

export function formatNumber(value, language, options = {}) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  return new Intl.NumberFormat(localeFor(language), {
    maximumFractionDigits: 2,
    ...options,
  }).format(Number(value));
}

export function formatDate(value, language) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  // Keep the API/filter timezone unchanged; the tables explicitly say UTC.
  return new Intl.DateTimeFormat(localeFor(language), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hourCycle: "h23",
  }).format(date);
}

export function errorTranslationKey(error) {
  const codes = {
    score_invalid_device_type: "Device type must be computer or mobile.",
    outbox_unavailable: "Browser storage is unavailable. Keep the page open and try saving again.",
    simulated_connection_loss: "Connection loss simulation is active in this tab.",
    score_submission_conflict: "This submission was already saved with different data.",
    score_display_name_too_long: "The display name must be at most 24 characters.",
    score_player_cookie_required: "Allow this site’s cookies and try saving again.",
    score_invalid_round_count: "A completed game must contain five valid reaction times.",
    score_invalid_time: "A completed game must contain five valid reaction times.",
  };
  if (Object.hasOwn(codes, error?.code)) return codes[error.code];
  if (error?.status === 429) return "Please wait before trying again.";
  if (error?.status >= 500) return "The server is temporarily unavailable.";
  if (error?.status >= 400) return "Invalid request. Check the entered values.";
  if (error?.isRetryable) return "Cannot reach the server. Check your connection and try again.";
  return "The request failed. Please try again.";
}
