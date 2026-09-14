import { describe, expect, it, vi } from "vitest";
import { createInstance } from "i18next";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resources, translationOptions } from "./config.js";
import {
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  readLanguage,
  rememberLanguage,
} from "./preferences.js";
import { formatDate, formatNumber, errorTranslationKey } from "./format.js";

async function translator(language) {
  const instance = createInstance();
  await instance.init(translationOptions(language));
  return instance;
}

describe("localization", () => {
  it("keeps catalog keys and interpolation variables in sync", () => {
    const en = resources.en.translation,
      cs = resources.cs.translation;
    expect(Object.keys(cs).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) {
      expect(cs[key].trim(), key).not.toBe("");
      const variables = (value) =>
        [...value.matchAll(/{{(.*?)}}/g)].map((match) => match[1]).sort();
      expect(variables(cs[key]), key).toEqual(variables(en[key]));
    }
  });

  it("has a catalog entry for every literal t() call in the frontend", () => {
    const source = fileURLToPath(new URL("../", import.meta.url));
    function inspect(folder) {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const file = join(folder, entry.name);
        if (entry.isDirectory()) inspect(file);
        else if (/\.jsx?$/.test(file) && !file.endsWith(".test.js")) {
          for (const match of readFileSync(file, "utf8").matchAll(/\bt\("((?:\\.|[^"\\])*)"/g)) {
            const key = JSON.parse('"' + match[1] + '"');
            expect(
              Object.hasOwn(resources.en.translation, key) ||
                Object.hasOwn(resources.en.translation, key + "_other"),
              file + ": " + key,
            ).toBe(true);
          }
        }
      }
    }
    inspect(source);
  });

  it("selects Czech plural forms using the original numeric count", async () => {
    const instance = await translator("cs");
    expect(instance.t("gamesCount", { count: 1 })).toBe("1 hra");
    expect(instance.t("gamesCount", { count: 2 })).toBe("2 hry");
    expect(instance.t("gamesCount", { count: 5 })).toBe("5 her");
    expect(instance.t("gamesCount", { count: 0 })).toBe("0 her");
    expect(instance.t("scoresSaved", { count: 1 })).toBe("Výsledek uložen");
    expect(instance.t("scoresSaved", { count: 2 })).toBe("Uloženy 2 výsledky");
    expect(instance.t("scoresSaved", { count: 5 })).toBe("Uloženo 5 výsledků");
    expect(instance.t("scoresWaiting", { count: 1 })).toContain("1 neodeslaný výsledek");
    expect(instance.t("scoresWaiting", { count: 2 })).toContain("2 neodeslané výsledky");
    expect(instance.t("scoresWaiting", { count: 5 })).toContain("5 neodeslaných výsledků");
    expect(instance.t("scoresQueued", { count: 2 })).toContain("čekají");
    expect(instance.t("scoresQueued", { count: 5 })).toContain("čeká");
    expect(instance.t("previousScoresSaved", { count: 2 })).toBe("Uloženy 2 předchozí výsledky");
    expect(instance.t("previousScoresSaved", { count: 5 })).toBe("Uloženo 5 předchozích výsledků");
  });

  it("interpolates values and falls back to English for unsupported locales", async () => {
    const instance = await translator("cs");
    expect(instance.t("Round {{round}} / {{total}}", { round: 2, total: 5 })).toBe("Kolo 2 / 5");
    await instance.changeLanguage("de");
    expect(instance.t("Save score")).toBe("Save score");
    expect(instance.t("gamesCount", { count: 2 })).toBe("2 games");
  });

  it("prefers a saved language and handles blocked or invalid storage", () => {
    const storage = { getItem: vi.fn(() => "en"), setItem: vi.fn() };
    expect(readLanguage(storage, ["cs-CZ"])).toBe("en");
    expect(storage.getItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY);
    storage.getItem.mockReturnValue("bad");
    expect(readLanguage(storage, ["de-DE", "cs-CZ"])).toBe("cs");
    storage.getItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    storage.setItem.mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readLanguage(storage, ["en-US"])).toBe("en");
    expect(() => rememberLanguage(storage, "cs")).not.toThrow();
    expect(readLanguage(undefined, ["de-DE"])).toBe("en");
    expect(normalizeLanguage("CS-cz")).toBe("cs");
    expect(normalizeLanguage("cz")).toBeNull();
    expect(normalizeLanguage(null)).toBeNull();
  });

  it("stores only the supported language code", () => {
    const storage = { setItem: vi.fn() };
    rememberLanguage(storage, "cs-CZ");
    rememberLanguage(storage, "de");
    expect(storage.setItem.mock.calls).toEqual([[LANGUAGE_STORAGE_KEY, "cs"]]);
  });

  it("formats dates and numbers without changing the UTC interpretation", () => {
    expect(formatNumber(1234.5, "en")).toBe("1,234.5");
    expect(formatNumber(1234.5, "cs").replace(/\s/g, " ")).toBe("1 234,5");
    expect(formatNumber(0.125, "cs", { style: "percent" }).replace(/\s/g, " ")).toBe("12,5 %");
    expect(formatDate("2026-09-12T23:45:00Z", "cs")).toContain("12. 09. 2026");
    expect(formatDate("2026-09-12T23:45:00Z", "cs")).toContain("23:45");
    expect(formatDate("2026-09-12T23:45:00Z", "en")).toContain("12/09/2026");
    expect(formatDate("not-a-date", "cs")).toBe("—");
    expect(formatDate(null, "cs")).toBe("—");
    expect(formatNumber(null, "cs")).toBe("—");
  });

  it("uses safe error keys rather than untranslated server messages", async () => {
    const instance = await translator("cs");
    expect(instance.t(errorTranslationKey({ code: "score_display_name_too_long" }))).toContain(
      "24 znaků",
    );
    expect(instance.t(errorTranslationKey({ status: 429 }))).toBe(
      "Před dalším pokusem chvíli počkejte.",
    );
    expect(instance.t(errorTranslationKey({ status: 503 }))).toBe("Server je dočasně nedostupný.");
    expect(
      instance.t(errorTranslationKey({ message: "<script>secret diagnostic</script>" })),
    ).not.toContain("secret");
  });
});
