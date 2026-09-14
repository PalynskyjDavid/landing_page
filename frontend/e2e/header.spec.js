import { test } from "./fixtures.js";
import { headerControls } from "./support/header-scenarios.js";

test.use({ locale: "en-GB", colorScheme: "light", reducedMotion: "reduce" });
test("header icons, keyboard language menu and stable responsive navigation", headerControls);
