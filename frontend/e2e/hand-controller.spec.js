import { test } from "./fixtures.js";
import {
  handControllerNavigation,
  handControllerStablePreview,
  handControllerDemo,
  handControllerLive,
  handControllerLoadingCancel,
} from "./support/hand-controller-scenarios.js";
test.use({ locale: "en-GB", reducedMotion: "reduce" });
test("Hand Controller navigation, lazy loading and EN/CZ mobile layouts", handControllerNavigation);
test("Hand Controller camera opt-in and denied-permission recovery", handControllerDemo);
test("Hand Controller real MediaPipe worker with synthetic video and cleanup", async (args) => {
  test.setTimeout(150000);
  await handControllerLive(args);
});
test("Hand Controller model failure releases the camera", async (args) => {
  test.setTimeout(90000);
  await handControllerLoadingCancel(args);
});

test(
  "Hand Controller skeleton stays visible while inference is pending",
  handControllerStablePreview,
);
