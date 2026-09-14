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
  expect(
    await page.evaluate(() => window.__cameraTracks.every((track) => track.readyState === "ended")),
  ).toBe(true);
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
