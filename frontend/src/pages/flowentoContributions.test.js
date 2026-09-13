import { describe, expect, it } from "vitest";
import { flowentoContributions } from "./flowentoContributions.js";
import { resources } from "../i18n/config.js";

describe("Flowento technology contributions", () => {
  it("has distinct technology sections with translated contribution details", () => {
    expect(new Set(flowentoContributions.map((item) => item.id)).size).toBe(
      flowentoContributions.length,
    );
    for (const technology of flowentoContributions) {
      expect(technology.name.trim()).not.toBe("");
      expect(technology.details.length).toBeGreaterThan(0);
      const keys = [
        technology.category,
        ...technology.details.flatMap((detail) => [detail.title, detail.description]),
      ];
      for (const locale of ["en", "cs"])
        for (const key of keys) {
          expect(resources[locale].translation[key], locale + ": " + key).toBeTruthy();
        }
    }
  });
  it("distinguishes the original 3D viewer from personal application contributions", () => {
    expect(
      flowentoContributions.filter((item) => item.contextOnly).map((item) => item.name),
    ).toEqual(["Three.js"]);
    expect(flowentoContributions.find((item) => item.id === "mongodb").details[0].title).toBe(
      "Persistence layer design",
    );
  });
});
