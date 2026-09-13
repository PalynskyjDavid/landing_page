import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resources } from "../i18n/config.js";
import {
  demoPinchThreshold,
  pinchDemoState,
  handControllerPipeline,
  handControllerContributions,
  handControllerFindings,
} from "./handControllerContent.js";

describe("Hand Controller showcase", () => {
  it.each([
    [100, false, "waiting"],
    [31, true, "waiting"],
    [30, false, "blocked"],
    [0, false, "blocked"],
    [30, true, "ready"],
    [0, true, "ready"],
  ])("gates the illustrative action at distance %s with enabled=%s", (distance, enabled, state) => {
    expect(demoPinchThreshold).toBe(30);
    expect(pinchDemoState(distance, enabled)).toBe(state);
  });
  it("translates the pipeline, contribution details and evaluation findings", () => {
    expect(handControllerPipeline).toHaveLength(4);
    expect(new Set(handControllerContributions.map((item) => item.id)).size).toBe(4);
    const keys = [
      ...handControllerPipeline.flatMap((item) => [item.title, item.text]),
      ...handControllerContributions.flatMap((item) => [item.category, item.title, item.text]),
      ...handControllerFindings.flatMap((item) => [item.title, item.text]),
    ];
    for (const locale of ["en", "cs"])
      for (const key of keys) {
        expect(resources[locale].translation[key], locale + ": " + key).toBeTruthy();
      }
  });
  it("keeps the showcase local and separate from actual webcam/OS-control code", () => {
    const source = readFileSync(new URL("./HandControllerPage.jsx", import.meta.url), "utf8");
    expect(source).not.toMatch(
      /getUserMedia|@mediapipe|@tauri|src-tauri|docs\/portfolio|https?:\/\//,
    );
    const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    expect(app).toContain('lazy(() => import("./pages/HandControllerPage.jsx"))');
  });
});
