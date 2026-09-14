import { test } from "./fixtures.js";
import { publicCv } from "./support/cv-scenarios.js";

// Follow the shared clean-state fixture used by the full E2E suite.
test.use({ locale: "en-GB", colorScheme: "light", reducedMotion: "reduce" });
test("public CV, contact links, localized reading and on-demand PDF download", publicCv);
