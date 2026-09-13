import { test } from "./fixtures.js";
import {
  projectNavigation,
  projectLazyLoading,
  projectAssembly,
  projectAssemblyAnimation,
  projectInteraction,
  projectModelFailure,
  projectWithoutWebGL,
} from "./support/project-scenarios.js";
test.use({ locale: "en-GB", reducedMotion: "reduce" });
test("Flowento navigation, localization, and mobile layout", projectNavigation);
test("Flowento real 3D model interaction and cleanup", projectInteraction);
test("Flowento model failures and context loss are recoverable", projectModelFailure);
test("Flowento remains readable without WebGL", projectWithoutWebGL);

test("Flowento colored parts can be separated, isolated, and reassembled", projectAssembly);

test("staged disassembly animates, pauses and cancels cleanly", projectAssemblyAnimation);

test("Flowento downloads 3D only on demand and caches production assets", projectLazyLoading);
