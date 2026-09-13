// A coarse, spoofable analytics label, not an input method or security signal.
// Viewport size is deliberately ignored: resizing a computer does not make it mobile.
export function detectDeviceType(browser = globalThis.navigator) {
  if (!browser) return "computer";
  if (browser.userAgentData?.mobile === true) return "mobile";
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(browser.userAgent ?? "")) return "mobile";
  // iPadOS may advertise a desktop Macintosh user agent.
  if (/Mac/i.test(browser.platform ?? "") && browser.maxTouchPoints > 1) return "mobile";
  return "computer";
}
