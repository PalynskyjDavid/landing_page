import { test, expect } from "./fixtures.js";
import { publicCv } from "./support/cv-scenarios.js";

// Follow the shared clean-state fixture used by the full E2E suite.
test.use({ locale: "en-GB", colorScheme: "light", reducedMotion: "reduce" });
test("public CV, contact links, localized reading and on-demand PDF download", publicCv);

test("CV and main navigation glow in overlapping cycles without movement", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/cv");
  const cvNav = page.locator(".cv-sections");
  const mainNav = page.locator(".shell-nav");
  const groups = [
    [cvNav, 5],
    [mainNav, 3],
  ];
  // Seek the real CSS timelines: peaks, crossfades, wraparound and second cycle.
  const sample = (nav, time) =>
    nav.evaluate((el, currentTime) => {
      for (const animation of el.getAnimations({ subtree: true })) {
        if (!animation.animationName?.startsWith("nav-glow-")) continue;
        animation.pause();
        animation.currentTime = currentTime;
      }
      return [...el.querySelectorAll("a")].map((link) =>
        Number(getComputedStyle(link, "::before").opacity),
      );
    }, time);
  for (const [nav, count] of groups) {
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(count);
    await expect
      .poll(() =>
        nav.evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((a) => a.animationName?.startsWith("nav-glow-")).length,
        ),
      )
      .toBe(count);
    expect(
      await nav.evaluate((el) =>
        el
          .getAnimations({ subtree: true })
          .every((a) => a.effect.getTiming().iterations === Infinity),
      ),
    ).toBe(true);
    const boxes = await links.evaluateAll((items) =>
      items.map((el) => el.getBoundingClientRect().toJSON()),
    );
    for (let active = 0; active < count; active++) {
      const peak = await sample(nav, active * 2000 + 1500);
      peak.forEach((opacity, index) => expect(opacity).toBeCloseTo(index === active ? 1 : 0, 4));
      const overlap = await sample(nav, active * 2000 + 2500);
      const next = (active + 1) % count;
      expect(overlap[active]).toBeGreaterThan(0.1);
      expect(overlap[active]).toBeLessThan(0.9);
      expect(overlap[next]).toBeCloseTo(overlap[active], 4);
      expect(overlap.filter((opacity) => opacity > 0).length).toBe(2);
      expect(
        await links.evaluateAll((items) => items.map((el) => el.getBoundingClientRect().toJSON())),
      ).toEqual(boxes);
    }
    expect(await sample(nav, count * 2000 + 1500)).toEqual(await sample(nav, 1500));
    await sample(nav, 2500);
    for (const link of await links.all()) {
      expect(await link.evaluate((el) => getComputedStyle(el, "::before").zIndex)).toBe("-1");
      expect(
        await link.evaluate((el) => getComputedStyle(el, "::before").backgroundColor),
      ).not.toBe("rgba(0, 0, 0, 0)");
    }
  }
  await page.screenshot({ path: testInfo.outputPath("nav-glow-light.png") });

  // Fresh timelines let us test CSS pause/resume without the manual sampling above.
  await page.reload();
  for (const [nav] of groups) {
    const first = nav.getByRole("link").first();
    const playState = () =>
      first.evaluate((el) => getComputedStyle(el, "::before").animationPlayState);
    await first.hover();
    await expect.poll(playState).toBe("paused");
    await page.mouse.move(1, 1);
    await expect.poll(playState).toBe("running");
    await first.focus();
    await expect.poll(playState).toBe("paused");
    await page.locator(".language-trigger").focus();
    await expect.poll(playState).toBe("running");
  }
  await cvNav.getByRole("link").first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#cv-profile$/);
  await expect(page.locator("#cv-profile")).toBeInViewport();

  await page.goto("/cv");
  await page.setViewportSize({ width: 320, height: 800 });
  await page.locator(".theme-toggle").click();
  await page.mouse.move(1, 1);
  for (const [nav] of groups) await sample(nav, 2500);
  await cvNav.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("nav-glow-dark-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await cvNav.getByRole("link").nth(1).click();
  await expect(page).toHaveURL(/#cv-skills$/);
  await expect(page.locator("#cv-skills")).toBeInViewport();
  await mainNav.getByRole("link", { name: "Game", exact: true }).click();
  await expect(page).toHaveURL(/\/game$/);
  await expect(mainNav.getByRole("link", { name: "Game", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.screenshot({ path: testInfo.outputPath("nav-glow-active-dark.png") });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/cv");
  await expect(cvNav.getByRole("link")).toHaveCount(5);
  for (const [nav] of groups) {
    expect(await nav.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    for (const link of await nav.getByRole("link").all()) {
      expect(await link.evaluate((el) => getComputedStyle(el, "::before").opacity)).toBe("0");
    }
  }
});
