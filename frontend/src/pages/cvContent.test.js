import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resources } from "../i18n/config.js";
import { contactLinks, cvDownloadName, profileRole } from "../content/profile.js";
import { cvProfile, cvSkills, cvProjects, cvEducation, cvLanguages } from "./cvContent.js";

describe("Public CV", () => {
  it("translates all readable CV content without changing technology names", () => {
    const keys = [
      profileRole,
      cvProfile,
      ...contactLinks.map((item) => item.label),
      ...cvSkills.flatMap((item) => [item.title, ...(item.note ? [item.note] : [])]),
      ...cvProjects.flatMap((item) => [
        item.title,
        item.context,
        ...item.points,
        ...(item.note ? [item.note] : []),
      ]),
      ...cvEducation.flatMap((item) => [item.program, item.period]),
      ...cvLanguages,
    ];
    for (const locale of ["en", "cs"])
      for (const key of keys)
        expect(resources[locale].translation[key], `${locale}: ${key}`).toBeTruthy();
    expect(cvProjects).toHaveLength(3);
    expect(cvEducation).toHaveLength(4);
    expect(cvSkills[0].note).toBe("Project experience with Python, Go and Rust.");
    expect(cvProjects.filter((project) => project.context.includes("AI-assisted"))).toHaveLength(2);
  });
  it("ships the reviewed one-page graphic PDF with the expanded skills", () => {
    const pdf = readFileSync(new URL("../assets/cv/David_Palynskyj_CV.pdf", import.meta.url));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(createHash("sha256").update(pdf).digest("hex")).toBe(
      "0c0e79605d0258b114ed2bd19290028f9016b6c05d012dbcb46c2ac61b647be6",
    );
    expect(pdf.length).toBeLessThan(250000);
    expect(cvDownloadName).toBe("David_Palynskyj_CV.pdf");
  });
  it("includes the verified project tools without changing project attribution", () => {
    const skills = Object.fromEntries(cvSkills.map(({ title, items }) => [title, items]));
    expect(skills["Frontend"]).toContain("i18next");
    expect(skills["Graphics and desktop"]).toEqual(["MediaPipe", "OpenCV", "Three.js", "Tauri"]);
    expect(skills["Deployment"]).toEqual(["Docker Compose", "Linux (Ubuntu)", "NGINX", "Caddy"]);
    expect(cvSkills[0].note).toContain("Project experience with Python");
    const handController = cvProjects.find((project) => project.title === "Hand Controller");
    expect(handController.technologies).toEqual(["Rust", "Tauri", "TypeScript", "MediaPipe"]);
  });
  it("uses only the contact destinations from the CV", () => {
    expect(contactLinks.map((link) => link.href)).toEqual([
      "mailto:palyndav@gmail.com",
      "tel:775441341",
      "https://github.com/PalynskyjDavid",
      "https://www.linkedin.com/in/palynskyjdavid/",
    ]);
    expect(
      contactLinks
        .filter((link) => link.external)
        .every((link) => link.href.startsWith("https://")),
    ).toBe(true);
  });
});
