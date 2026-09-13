import { expect } from "@playwright/test";

async function forbidCamera(page) {
  await page.addInitScript(() => {
    window.__showcaseCameraRequests = 0;
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = () => {
        window.__showcaseCameraRequests++;
        return Promise.reject(new Error("Showcase must not request a camera"));
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
  await expect(page.getByRole("heading", { name: "A gesture is not yet an action" })).toBeVisible();
  await expect(page.locator(".hand-contributions article")).toHaveCount(4);
  await expect(page.locator(".hand-pipeline li")).toHaveCount(4);
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Čeština", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Gesto ještě není akce" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "English", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole("button", { name: "Dark mode", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".hand-demo-state")).toHaveCSS("color", "rgb(238, 241, 255)");
  await expect(page.getByRole("img", { name: "Illustrated hand landmarks" })).toBeVisible();
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
  await page.goto("/projects/hand-controller");
  const click = page.getByRole("button", { name: "Preview click", exact: true });
  const slider = page.getByRole("slider", { name: "Demo pinch distance" });
  await expect(page.locator(".hand-demo-state")).toHaveCSS("color", "rgb(238, 241, 255)");
  await expect(click).toBeDisabled();
  await expect(page.getByText("Demo clicks: 0", { exact: true })).toBeVisible();
  await slider.focus();
  await slider.press("Home");
  await expect(page.getByText("Gesture matches; demo is disarmed.")).toBeVisible();
  await expect(click).toBeDisabled();
  await page.getByRole("button", { name: "Arm demo", exact: true }).click();
  await expect(click).toBeEnabled();
  await expect(page.locator(".hand-demo-state")).toHaveCSS("color", "rgb(181, 239, 185)");
  await click.click();
  await expect(page.getByText("Demo clicks: 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Čeština", exact: true }).click();
  await expect(page.getByText("Kliknutí v ukázce: 1", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Vypnout ovládání", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "English", exact: true }).click();
  await slider.focus();
  await slider.press("End");
  await expect(click).toBeDisabled();
  await expect(page.getByText("Move the fingertips closer.")).toBeVisible();
  await page.getByRole("button", { name: "Disarm demo", exact: true }).click();
  expect(await page.evaluate(() => window.__showcaseCameraRequests)).toBe(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Arm demo", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(slider).toHaveValue("70");
  await expect(page.getByText("Demo clicks: 0", { exact: true })).toBeVisible();
}
