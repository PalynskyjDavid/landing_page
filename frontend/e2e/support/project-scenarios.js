import { expect } from "@playwright/test";

export async function projectNavigation({ page }) {
  const modelRequests = [];
  page.on("request", (request) => {
    if (/\.glb(?:\?|$)/.test(request.url())) modelRequests.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("link", { name: "View Flowento project" }).click();
  await expect(page).toHaveURL(/\/projects\/flowento$/);
  await expect(page.getByRole("heading", { name: "Flowento", exact: true })).toBeVisible();
  await expect(page.locator(".mirror-poster")).toBeVisible();
  await expect
    .poll(() => page.locator(".mirror-poster").evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  expect(modelRequests).toHaveLength(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Tech stack / My contribution", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".flowento-lead")).toHaveText("An everyday object made smarter.");
  const showcase = page.getByRole("link", {
    name: "Mirror showcase on Reddit (opens in a new tab)",
    exact: true,
  });
  await expect(showcase).toHaveAttribute(
    "href",
    "https://www.reddit.com/r/MagicMirror/comments/1llfb76/smartmirror_with_fullfeatured_smart_ecosystem_we/",
  );
  await expect(showcase).toHaveAttribute("target", "_blank");
  await expect(showcase).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator(".flowento-hero .flowento-tags")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "How the pieces connect", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".mirror-parts li")).toHaveCount(7);
  await expect(page.locator(".flowento-contributions article")).toHaveCount(5);
  for (const technology of [
    "MongoDB / Mongoose",
    "React",
    "Node.js / Express",
    "JavaScript",
    "Three.js",
  ]) {
    await expect(
      page.getByRole("heading", { name: technology, exact: true, level: 3 }),
    ).toBeVisible();
  }
  await expect(
    page
      .getByRole("article", { name: "MongoDB / Mongoose" })
      .getByRole("heading", { name: "Persistence layer design" }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Three.js" }).getByText("Project context", { exact: true }),
  ).toBeVisible();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Čeština", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Technologie / Můj přínos", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Ukázka zrcadla na Redditu (otevře se v nové kartě)",
        exact: true,
      }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "English", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(modelRequests).toHaveLength(0);
}

export async function projectInteraction({ page }) {
  const modelRequests = [];
  page.on("request", (request) => {
    if (/\.glb(?:\?|$)/.test(request.url())) modelRequests.push(request.url());
  });
  await page.goto("/projects/flowento");
  await page.getByRole("button", { name: "Explore in 3D", exact: true }).click();
  await expect(page.getByRole("button", { name: "Front", exact: true })).toBeEnabled();
  const canvas = page.locator(".mirror-canvas canvas");
  await expect(canvas).toHaveCount(1);
  const angled = await canvas.screenshot();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  expect((await canvas.screenshot()).equals(angled)).toBe(false);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect((await canvas.screenshot()).equals(angled)).toBe(false);
  await page.getByRole("button", { name: "Čeština", exact: true }).click();
  await expect(page.getByRole("button", { name: "Zepředu", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "English", exact: true }).click();
  expect(modelRequests).toHaveLength(1); // Translating the UI must not recreate WebGL.
  await expect(page.getByRole("button", { name: "Original model", exact: true })).toHaveCount(0);
  expect(modelRequests).toHaveLength(1);
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Close 3D", exact: true }).click();
  await expect(canvas).toHaveCount(0);
  await expect(page.locator(".mirror-poster")).toBeVisible();
  await page.getByRole("button", { name: "Explore in 3D", exact: true }).click();
  await expect(page.getByRole("button", { name: "Front", exact: true })).toBeEnabled();
  await page.getByRole("link", { name: "Back to home", exact: true }).click();
  await expect(canvas).toHaveCount(0);
}

export async function projectModelFailure({ page }) {
  await page.route("**/*.glb", (route) =>
    route.fulfill({ status: 200, contentType: "model/gltf-binary", body: "invalid model" }),
  );
  await page.goto("/projects/flowento");
  await page.getByRole("button", { name: "Explore in 3D", exact: true }).click();
  await expect(
    page.getByText("3D is unavailable. You can still explore the project below."),
  ).toBeVisible();
  await expect(page.locator(".mirror-poster")).toBeVisible();
  await expect(page.locator(".mirror-canvas canvas")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Tech stack / My contribution", exact: true }),
  ).toBeVisible();
  await page.unroute("**/*.glb");
  await page.getByRole("button", { name: "Retry 3D", exact: true }).click();
  await expect(page.getByRole("button", { name: "Front", exact: true })).toBeEnabled();
  // Context loss is recoverable too, without trapping the reader in a blank canvas.
  await page
    .locator(".mirror-canvas canvas")
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
    );
  await expect(page.getByRole("button", { name: "Retry 3D", exact: true })).toBeVisible();
  await expect(page.locator(".mirror-canvas canvas")).toHaveCount(0);
}

export async function projectWithoutWebGL({ page }) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "webgl2" || type === "webgl" || type === "experimental-webgl") return null;
      return original.call(this, type, ...args);
    };
  });
  await page.goto("/projects/flowento");
  await page.getByRole("button", { name: "Explore in 3D", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry 3D", exact: true })).toBeVisible();
  await expect(page.locator(".mirror-poster")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tech stack / My contribution", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close 3D", exact: true }).click();
  await expect(page.getByRole("button", { name: "Explore in 3D", exact: true })).toBeVisible();
}

export async function projectAssembly({ page }) {
  const requests = [];
  page.on("request", (request) => {
    if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url());
  });
  await page.goto("/projects/flowento");
  await expect(
    page.getByText("Newer frame · October 2025 CAD export", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Explore in 3D", exact: true }).click();
  await expect(page.getByRole("button", { name: "Exploded view", exact: true })).toBeEnabled();
  const canvas = page.locator(".mirror-canvas canvas");
  const assembled = await canvas.screenshot();
  const stages = page.locator(".mirror-steps button");
  await expect(stages).toHaveCount(5);
  for (let index = 0; index < 5; index++) {
    await stages.nth(index).click();
    await expect(page.getByRole("slider", { name: "Part separation" })).toHaveValue(
      String((index + 1) * 20),
    );
    await expect(stages.nth(index)).toHaveAttribute("aria-current", "step");
  }
  await page.getByRole("button", { name: "Reassemble", exact: true }).click();
  const stageSlider = page.getByRole("slider", { name: "Part separation" });
  await expect(stageSlider).toHaveValue("0");
  await stageSlider.focus();
  for (let index = 0; index < 25; index++) await stageSlider.press("ArrowRight");
  await expect(stageSlider).toHaveValue("25");
  await expect(page.locator("#mirror-stage-status")).toHaveText(
    "Stage 2 of 5: Housing access door",
  );
  await page.getByRole("button", { name: "Housing access door", exact: true }).click();
  await expect(stageSlider).toBeDisabled();
  await page.getByRole("button", { name: "Show all parts", exact: true }).click();
  await stageSlider.focus();
  await stageSlider.press("Home");
  await page.getByRole("button", { name: "Exploded view", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Part separation" })).toHaveValue("100");
  expect((await canvas.screenshot()).equals(assembled)).toBe(false);
  await page.getByRole("button", { name: "Rear housing", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rear housing", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("slider", { name: "Part separation" })).toBeDisabled();
  await expect(page.locator(".mirror-part-description")).toHaveText(
    "The rear enclosure and its attachment pieces. The access door is a separate component.",
  );
  await page.getByRole("button", { name: "Čeština", exact: true }).click();
  await expect(page.getByRole("button", { name: "Zadní pouzdro", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Zobrazit všechny díly", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Rozestup dílů" });
  await expect(slider).toHaveValue("100");
  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  await expect(page.getByRole("button", { name: "Rozložený pohled", exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("button", { name: "Close 3D", exact: true }).click();
  await expect(page.locator(".mirror-parts li")).toHaveCount(7);
  await expect(page.getByRole("button", { name: "Rear housing", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(canvas).toHaveCount(0);
}

export async function projectAssemblyAnimation({ page }) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/projects/flowento");
  await page.getByRole("button", { name: "Explore in 3D", exact: true }).click();
  const slider = page.getByRole("slider", { name: "Part separation" });
  await expect(slider).toBeEnabled();
  await page.getByRole("button", { name: "Exploded view", exact: true }).click();
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await slider.inputValue();
  expect(Number(paused)).toBeLessThan(100);
  await page.waitForTimeout(200);
  await expect(slider).toHaveValue(paused);
  await page.getByRole("button", { name: "Reassemble", exact: true }).click();
  await expect(slider).toHaveValue("0", { timeout: 10000 });
  await expect(page.getByRole("button", { name: "Exploded view", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exploded view", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveValue("0");
  await expect(page.getByRole("button", { name: "Exploded view", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Exploded view", exact: true }).click();
  await expect(slider).toHaveValue("100", { timeout: 15000 });
  await expect(page.locator("#mirror-stage-status")).toHaveText("Fully separated");
  await expect(page.getByRole("button", { name: "Reassemble", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reassemble", exact: true }).click();
  await page.getByRole("button", { name: "Close 3D", exact: true }).click();
  await expect(page.locator(".mirror-canvas canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Explore in 3D", exact: true }).click();
  await expect(slider).toHaveValue("0");
  await expect(page.getByRole("button", { name: "Exploded view", exact: true })).toBeEnabled();
  // Losing WebGL during playback cancels the loop as well as releasing the canvas.
  await page.getByRole("button", { name: "Exploded view", exact: true }).click();
  await page
    .locator(".mirror-canvas canvas")
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
    );
  await expect(page.getByRole("button", { name: "Retry 3D", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toHaveCount(0);
  await expect(page.locator(".mirror-canvas canvas")).toHaveCount(0);
}

export async function projectLazyLoading({ page }) {
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  const isRenderer = (path) => /mirrorScene|mirrorAssembly|\/three(?:[./_-]|$)/i.test(path);
  const isModel = (path) => path.endsWith(".glb");
  const isProject = (path) => /FlowentoPage|mirror-preview|mirror-frame|\/flowento\//.test(path);
  await page.goto("/");
  const link = page.getByRole("link", { name: "View Flowento project" });
  await expect(link).toBeVisible();
  await link.hover();
  expect(requests.filter((path) => isProject(path) || isRenderer(path) || isModel(path))).toEqual(
    [],
  );

  await link.click();
  await expect(page.getByRole("heading", { name: "Flowento", exact: true })).toBeVisible();
  const poster = page.locator(".mirror-poster");
  await expect(poster).toHaveAttribute("loading", "lazy");
  await expect(poster).toHaveAttribute("decoding", "async");
  await poster.scrollIntoViewIfNeeded();
  await expect.poll(() => poster.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await page.locator("#contribution").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Čeština", exact: true }).click();
  await page.getByRole("button", { name: "English", exact: true }).click();
  expect(requests.filter((path) => isRenderer(path) || isModel(path))).toEqual([]);
  await expect(page.locator(".mirror-canvas canvas")).toHaveCount(0);

  const modelResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith(".glb"),
  );
  const rendererResponse = page.waitForResponse((response) =>
    /mirrorScene/.test(new URL(response.url()).pathname),
  );
  await page.getByRole("button", { name: "Explore in 3D", exact: true }).click();
  const model = await modelResponse;
  const renderer = await rendererResponse;
  await expect(page.getByRole("button", { name: "Front", exact: true })).toBeEnabled();
  expect(model.status()).toBe(200);
  expect((await model.body()).length).toBeLessThan(400000);
  expect(requests.filter(isModel)).toHaveLength(1);
  expect(requests.some(isRenderer)).toBe(true);

  // Vite development/preview has different headers. Production-container E2E
  // additionally enforces the actual NGINX compression and cache policy.
  const modelHeaders = await model.allHeaders();
  if (modelHeaders["content-security-policy"]) {
    expect(new URL(model.url()).pathname).toMatch(/^\/assets\/mirror-frame-2025-10-.+\.glb$/);
    expect(modelHeaders["cache-control"]).toContain("immutable");
    expect(modelHeaders["content-encoding"]).toBe("gzip");
    expect((await renderer.allHeaders())["content-encoding"]).toBe("gzip");
    const preview = await page.request.get(await poster.getAttribute("src"));
    expect(preview.headers()["cache-control"]).toContain("immutable");
    // Resource Timing reports encoded body bytes (excluding response headers).
    const modelBytes = await page.evaluate(
      (url) => performance.getEntriesByName(url).at(-1)?.encodedBodySize,
      model.url(),
    );
    const rendererBytes = await page.evaluate(
      (url) => performance.getEntriesByName(url).at(-1)?.encodedBodySize,
      renderer.url(),
    );
    expect(modelBytes).toBeGreaterThan(0);
    expect(rendererBytes).toBeGreaterThan(0);
    expect(modelBytes + rendererBytes).toBeLessThan(350000);
  }
  const rendererLoads = requests.filter(isRenderer).length;
  await page.getByRole("button", { name: "Close 3D", exact: true }).click();
  await page.getByRole("button", { name: "Explore in 3D", exact: true }).click();
  await expect(page.getByRole("button", { name: "Front", exact: true })).toBeEnabled();
  expect(requests.filter(isRenderer)).toHaveLength(rendererLoads);
  if (modelHeaders["content-security-policy"]) {
    const transfers = await page.evaluate(
      (url) => performance.getEntriesByName(url).map((entry) => entry.transferSize),
      model.url(),
    );
    expect(transfers.length).toBeGreaterThanOrEqual(2);
    expect(transfers.at(-1)).toBe(0); // The model was served from the browser's HTTP cache.
  }
}
