import { expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { selectLanguage } from "./language.js";

export async function publicCv({ page }) {
  const removedCopy =
    /My experience, technologies and education|Moje zkušenosti, technologie a vzdělání|One-page PDF in English|Jednostránkové PDF je v angličtině/;
  const pdfRequests = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname.endsWith(".pdf") &&
      !url.searchParams.has("url") &&
      !url.searchParams.has("import")
    )
      pdfRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Read my CV", exact: true }).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(removedCopy);
  const contacts = page.locator("#contact");
  await expect(contacts.locator('a[href="mailto:palyndav@gmail.com"]')).toBeVisible();
  await expect(contacts.locator('a[href="tel:775441341"]')).toBeVisible();
  await expect(contacts.locator('a[target="_blank"]')).toHaveCount(2);
  for (const platform of ["GitHub", "LinkedIn"]) {
    const social = contacts.getByRole("link", {
      name: platform + " (opens in a new tab)",
      exact: true,
    });
    await expect(social.locator("svg")).toBeVisible();
    await expect(social).not.toContainText(/Palynskyj|David/);
    await social.focus();
    await expect(social).toBeFocused();
  }
  await selectLanguage(page, "Čeština");
  await expect(page.locator("main")).not.toContainText(removedCopy);
  await expect(
    page.getByText(
      "Zde najdete projekty, na kterých jsem pracoval, i to, čím jsem přispěl. Některé si můžete rovnou částečně vyzkoušet.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Přečíst životopis", exact: true }).first().click();
  await expect(page).toHaveURL(/\/cv$/);
  await expect(page.getByRole("heading", { level: 1, name: "Bc. David Palynskyj" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Technické dovednosti", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cv-projects article")).toHaveCount(3);
  await expect(page.locator(".cv-education li")).toHaveCount(4);
  await expect(
    page.getByText("S Go a Rustem mám zkušenosti z projektů.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".contact-social")).toHaveCount(2);
  for (const social of await page.locator(".contact-social").all()) {
    await expect(social).not.toContainText(/Palynskyj|David/);
    await expect(social.locator("svg")).toBeVisible();
  }
  await expect(page.locator("main")).not.toContainText(removedCopy);
  expect(pdfRequests).toEqual([]);
  const downloadLink = page.getByRole("link", { name: "Stáhnout PDF (EN)", exact: true });
  const href = await downloadLink.getAttribute("href");
  const downloadEvent = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("David_Palynskyj_CV.pdf");
  expect(await download.failure()).toBeNull();
  const pdf = await readFile(await download.path());
  expect(createHash("sha256").update(pdf).digest("hex")).toBe(
    "d92918d08d029fe46747b8049fec9c0bbfba5b6d586ae94f0574ee21681dcff0",
  );
  const response = await page.request.get(href);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  await expect(page.locator('.cv-intro a[target="_blank"]')).toHaveAttribute("href", href);
  await expect(page.locator('.cv-intro a[target="_blank"]')).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const language of ["English", "Čeština"]) {
      await selectLanguage(page, language);
      await expect(page.locator(".cv-projects h3 a")).toHaveText(
        language === "English"
          ? ["Flowento smart mirror", "Reaction game and statistics", "Hand Controller"]
          : ["Chytré zrcadlo Flowento", "Reakční hra a statistiky", "Hand Controller"],
      );
      await page.locator(".theme-toggle").click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.locator(".cv-intro a[download]")).toHaveAttribute("href", href);
    }
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "cs");
  await expect(page.getByRole("heading", { name: "Vzdělání", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
}
