import { selectLanguage } from "./language.js";
import { expect } from "@playwright/test";

async function forbidCamera(page) {
  await page.addInitScript(() => {
    window.__showcaseCameraRequests = 0;
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = () => {
        window.__showcaseCameraRequests++;
        return Promise.reject(
          new DOMException("Permission denied for this test", "NotAllowedError"),
        );
      };
    }
  });
}

export async function handControllerNavigation({ page }) {
  await forbidCamera(page);
  const paths = [];
  const errors = [];
  page.on("request", (request) => paths.push(new URL(request.url()).pathname));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const link = page.getByRole("link", { name: "View Hand Controller project" });
  await expect(link).toBeVisible();
  await link.hover();
  expect(paths.some((path) => path.includes("HandControllerPage"))).toBe(false);
  await link.click();
  await expect(page).toHaveURL(/\/projects\/hand-controller$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hand Controller." })).toBeVisible();
  expect(paths.some((path) => path.includes("HandControllerPage"))).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "From camera to action" })).toBeVisible();
  await expect(page.locator(".hand-contributions article")).toHaveCount(4);
  await expect(page.locator(".hand-pipeline li")).toHaveCount(4);
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await selectLanguage(page, "Čeština");
    await expect(page.getByRole("heading", { name: "Od kamery k akci" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await selectLanguage(page, "English");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".hand-demo-state")).toHaveCSS("color", "rgb(238, 241, 255)");
  await expect(page.getByRole("button", { name: "Start camera", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__showcaseCameraRequests)).toBe(0);
  expect(
    paths.filter((path) =>
      /\.glb$|\.wasm$|\.task$|mirrorScene|mediapipe|vision_bundle/i.test(path),
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
  await page.getByRole("link", { name: "View Flowento project" }).click();
  await expect(page).toHaveURL(/\/projects\/flowento$/);
}

export async function handControllerDemo({ page }) {
  await forbidCamera(page);
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/projects/hand-controller");
  await expect(page.getByRole("button", { name: "Stop camera", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => window.__showcaseCameraRequests)).toBe(0);
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByText(/Camera permission was denied/)).toBeVisible();
  expect(await page.evaluate(() => window.__showcaseCameraRequests)).toBe(1);
  expect(
    requests.filter((url) => /\.wasm|\.task|handLandmarker.worker|vision_bundle/.test(url)),
  ).toEqual([]);
  await selectLanguage(page, "Čeština");
  await expect(page.getByText(/Prohlížeč nepovolil přístup ke kameře/)).toBeVisible();
  await page.getByRole("button", { name: "Zapnout kameru", exact: true }).click();
  expect(await page.evaluate(() => window.__showcaseCameraRequests)).toBe(2);
  await page.reload();
  await expect(
    page.getByText("Kamera je vypnutá. Zapněte ji, až budete chtít ukázku vyzkoušet.", {
      exact: true,
    }),
  ).toBeVisible();
}

// A synthetic canvas stream exercises the REAL worker/model without accessing
// a developer's webcam, recording personal video, or relying on CI hardware.
export async function handControllerLive({ page }) {
  await page.addInitScript(() => {
    window.__cameraTracks = [];
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext("2d");
      let n = 0;
      const paint = setInterval(() => {
        context.fillStyle = "#18223b";
        context.fillRect(0, 0, 640, 480);
        context.fillStyle = "#cbb8ff";
        context.fillRect((n++ * 5) % 500, 100, 80, 80);
      }, 67);
      const stream = canvas.captureStream(15);
      const track = stream.getVideoTracks()[0];
      const stop = track.stop.bind(track);
      track.stop = () => {
        clearInterval(paint);
        stop();
      };
      window.__cameraTracks.push(track);
      return stream;
    };
  });
  const requests = [];
  const errors = [];
  page.on("request", (request) => requests.push(request));
  page.on("pageerror", (error) => errors.push(error.message));
  // Starting through Home also checks CSP/Permissions-Policy after SPA navigation.
  await page.goto("/");
  await page.getByRole("link", { name: "View Hand Controller project" }).click();
  await expect(page.getByRole("button", { name: "Start camera", exact: true })).toBeVisible();
  expect(requests.some((r) => /\.wasm|\.task|handLandmarker.worker/.test(r.url()))).toBe(false);
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(
    page.getByText("Camera is on. Hold one or both hands in view.", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(
    page.getByRole("img", { name: "Mirrored camera view with hand landmarks" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const pixel = document
          .querySelector(".hand-camera-canvas")
          .getContext("2d")
          .getImageData(0, 0, 1, 1).data;
        return pixel[0];
      }),
    )
    .toBe(24);
  expect(requests.some((r) => r.url().includes(".wasm"))).toBe(true);
  expect(requests.some((r) => r.url().includes(".task"))).toBe(true);
  expect(requests.every((r) => new URL(r.url()).origin === new URL(page.url()).origin)).toBe(true);
  expect(requests.filter((r) => r.method() !== "GET")).toEqual([]);
  await selectLanguage(page, "Čeština");
  await expect(
    page.getByText("Kamera běží. Ukažte do ní jednu nebo obě ruce.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__cameraTracks.length)).toBe(1);
  await page.getByRole("button", { name: "Vypnout kameru", exact: true }).click();
  expect(await page.evaluate(() => window.__cameraTracks[0].readyState)).toBe("ended");
  await page.getByRole("button", { name: "Zapnout kameru", exact: true }).click();
  await expect(
    page.getByText("Kamera běží. Ukažte do ní jednu nebo obě ruce.", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await selectLanguage(page, "English");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    delete document.hidden;
  });
  await expect(
    page.getByText("Camera stopped. You can start it again at any time.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.__cameraTracks.every((track) => track.readyState === "ended")),
  ).toBe(true);
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(
    page.getByText("Camera is on. Hold one or both hands in view.", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await page.getByRole("link", { name: /Back to home/ }).click();
  await expect(page).toHaveURL(/\/$/);
  // Client-side navigation schedules React's unmount cleanup after the click.
  await expect
    .poll(() =>
      page.evaluate(() => window.__cameraTracks.every((track) => track.readyState === "ended")),
    )
    .toBe(true);
  expect(errors).toEqual([]);
}

export async function handControllerLoadingCancel({ page }) {
  await page.addInitScript(() => {
    window.__stopped = false;
    navigator.mediaDevices.getUserMedia = async () => {
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = 480;
      c.getContext("2d").fillRect(0, 0, 640, 480);
      const stream = c.captureStream(1);
      const track = stream.getVideoTracks()[0];
      const stop = track.stop.bind(track);
      track.stop = () => {
        window.__stopped = true;
        stop();
      };
      return stream;
    };
  });
  await page.route(/hand_landmarker.*\.task/, (route) => route.abort());
  await page.goto("/projects/hand-controller");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByText(/Hand tracking could not load or run/)).toBeVisible({
    timeout: 60000,
  });
  expect(await page.evaluate(() => window.__stopped)).toBe(true);
  await expect(page.getByRole("button", { name: "Start camera", exact: true })).toBeEnabled();
}

// Slow, deterministic inference makes the image-only flicker reproducible.
// This uses real transferable bitmaps but never opens a physical camera.
export async function handControllerStablePreview({ page }) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const source = document.createElement("canvas");
      source.width = 640;
      source.height = 480;
      const context = source.getContext("2d");
      let frame = 0;
      const paint = setInterval(() => {
        context.fillStyle = "rgb(" + (32 + (frame++ % 128)) + ", 34, 59)";
        context.fillRect(0, 0, 640, 480);
      }, 33);
      const stream = source.captureStream(30);
      const track = stream.getVideoTracks()[0];
      const stop = track.stop.bind(track);
      track.stop = () => {
        clearInterval(paint);
        stop();
      };
      return stream;
    };
  });
  await page.route(/handLandmarker\.worker.*\.js/, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `self.onmessage = ({ data }) => {
      if (data.type === "init") self.postMessage({ type: "ready" });
      else if (data.type === "frame") setTimeout(() => {
        const points = [[.5,.8],[.38,.69],[.30,.60],[.24,.50],[.20,.40],
          [.39,.51],[.37,.36],[.35,.25],[.34,.15],
          [.50,.47],[.50,.30],[.50,.18],[.50,.08],
          [.60,.50],[.63,.35],[.65,.24],[.66,.15],
          [.68,.57],[.74,.47],[.78,.38],[.81,.30]];
        self.postMessage({ type: "landmarks", frame: data.frame,
          landmarks: [points.map(([x,y]) => ({x,y}))] }, [data.frame]);
      }, 150);
    };`,
    }),
  );
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/projects/hand-controller");
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".hand-camera-canvas")
        .evaluate((canvas) =>
          Array.from(canvas.getContext("2d").getImageData(320, 384, 1, 1).data),
        ),
    )
    .toEqual([255, 204, 125, 255]);
  const samples = await page.locator(".hand-camera-canvas").evaluate(
    (canvas) =>
      new Promise((resolve) => {
        const context = canvas.getContext("2d");
        const backgrounds = new Set();
        let missing = 0,
          count = 0;
        function sample() {
          const [r, g, b] = context.getImageData(320, 384, 1, 1).data;
          if (r !== 255 || g !== 204 || b !== 125) missing++;
          backgrounds.add(context.getImageData(0, 0, 1, 1).data[0]);
          if (++count === 120) resolve({ missing, backgrounds: backgrounds.size });
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }),
  );
  // Also prove the preview advances: a frozen canvas would hide the bug.
  expect(samples.backgrounds).toBeGreaterThan(2);
  expect(samples.missing).toBe(0);
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  expect(errors).toEqual([]);
}
