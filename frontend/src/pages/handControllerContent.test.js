import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resources } from "../i18n/config.js";
import {
  handControllerPipeline,
  handControllerContributions,
  handControllerFindings,
} from "./handControllerContent.js";

describe("Hand Controller showcase", () => {
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
  it("keeps public copy focused on the current app and practical findings", () => {
    const page = readFileSync(new URL("./HandControllerPage.jsx", import.meta.url), "utf8");
    const demo = readFileSync(
      new URL("../components/hand-controller/HandLandmarkDemo.jsx", import.meta.url),
      "utf8",
    );
    const content = JSON.stringify([
      handControllerPipeline,
      handControllerContributions,
      handControllerFindings,
    ]);
    expect(page + content).not.toMatch(/Linux VM|earlier Qt|not a model I trained/);
    expect(page).toContain("MediaPipe's initial outputs");
    expect(page).not.toContain("Windows demonstration");
    expect(demo).not.toContain("First use downloads");
    expect(handControllerFindings).toHaveLength(3);
    expect(handControllerPipeline[0].text).toContain("existing model from Google");
    expect(demo).toContain("Camera for touchless interaction with your device.");
  });
  it("keeps the project page lazy and separate from desktop OS-control code", () => {
    const source = readFileSync(new URL("./HandControllerPage.jsx", import.meta.url), "utf8");
    expect(source).not.toMatch(
      /getUserMedia|@mediapipe|@tauri|src-tauri|docs\/portfolio|https?:\/\//,
    );
    const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    expect(app).toContain('lazy(() => import("./pages/HandControllerPage.jsx"))');
  });
});
