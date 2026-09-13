import { test } from "./fixtures.js";
import {
  handControllerNavigation,
  handControllerDemo,
} from "./support/hand-controller-scenarios.js";

test.use({ locale: "en-GB", reducedMotion: "reduce" });
test("Hand Controller navigation, lazy loading and EN/CZ mobile layouts", handControllerNavigation);
test("Hand Controller illustration gates clicks without camera or OS access", handControllerDemo);
