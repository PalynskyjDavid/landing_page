import { describe, expect, it } from "vitest";
import { detectDeviceType } from "./deviceType.js";

describe("coarse device classification", () => {
  it.each([
    ["desktop", { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, "computer"],
    ["touch laptop", { platform: "Win32", maxTouchPoints: 10 }, "computer"],
    ["mobile hint", { userAgentData: { mobile: true } }, "mobile"],
    ["iPhone", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile/15E148" }, "mobile"],
    [
      "Android tablet",
      { userAgentData: { mobile: false }, userAgent: "Mozilla/5.0 (Linux; Android 14; Tablet)" },
      "mobile",
    ],
    [
      "desktop-mode iPad",
      { platform: "MacIntel", userAgent: "Macintosh", maxTouchPoints: 5 },
      "mobile",
    ],
    ["Mac", { platform: "MacIntel", maxTouchPoints: 0 }, "computer"],
    ["missing information", {}, "computer"],
  ])("%s", (_name, browser, expected) => {
    expect(detectDeviceType(browser)).toBe(expected);
  });
});
