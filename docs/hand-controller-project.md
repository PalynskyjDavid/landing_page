# Hand Controller project showcase

Route: /projects/hand-controller, linked from the homepage alongside Flowento.
Both the project page and the homepage card have English and Czech copy.

## Content and evidence

The case study describes the newer Rust/Tauri Hand Controller thesis prototype,
not the earlier Qt/C++ and Python iteration as a separate finished product.
Content was checked read-only against the local hog/hand-controller source and
documentation on 2026-09-13 (parent repository HEAD 403abb6):

- README.md and docs/user-manual.md: actual prototype scope, configuration,
  diagnostics, Windows demonstration package and platform limitations.
- docs/gesture-decision-tree.md: pose matching, timing, priority, action arming,
  cooldowns and drag-release behavior.
- src/workers/vision.worker.ts and src-tauri/src/lib.rs: MediaPipe integration,
  Rust runtime and Enigo input handling.
- The thesis extended summary's AI-Assisted Development section: iterative
  implementation, diagnostics, testing and evaluation with AI assistance.

The page describes the work and its limitations without claiming independent
training of the vision model, a general mouse replacement, verified recognition
accuracy, an awarded degree, complete Linux support or universal latency results.
No historical benchmark is presented as a fresh measurement. The first-person
copy remains available for David's editorial review before public deployment.

No original application, webcam, OS-input controller or thesis test package was
launched. No source application files, installers, camera screenshots or private
portfolio notes are copied into the web assets. Public repository/download/video
links remain omitted until their availability and publication scope are confirmed.

## Lightweight illustration

The hero uses a native SVG hand-landmark schematic, not a webcam image or a
MediaPipe demo. The slider adjusts an illustrative thumb-index distance on a
0-100 scale. A value at or below 30 matches the example; an explicitly enabled
demo action can then increment a local counter. These are explanatory values,
not the desktop application's actual recognition thresholds or timing model.

No OS input, camera permissions, tracking model, backend call or new dependency
is used by this illustration. It has no animation loop or automatic activity.
Keyboard controls work, language switches preserve the example state, and
reloading or leaving the route resets it. Nothing is persisted to browser storage
by the demo itself; the existing language/theme preferences remain independent.

The real runtime is explained separately as landmarks -> gesture rules -> timing,
priority and arming -> operating-system action. This simplified demo does not
pretend to run those full algorithms.

HandControllerPage is loaded through React.lazy. The illustration ships as page
code with no images, fonts, video, WASM or remote scripts. Local NGINX measurement
after the final contrast fix: 3,345 encoded bytes of page JS and 1,791 bytes of CSS,
about 5.1 kB combined. This excludes the shared app and bundled EN/CZ catalogs.
The existing Flowento model and Three.js remain independently opt-in.

## Verification (2026-09-13)

- The shared quality gate passed: Go tests/lint/build, frontend formatting/lint,
  158 frontend unit tests across 25 files, production build and 12 deployment checks.
- After the visual contrast correction, frontend formatting/lint/unit tests and
  the actual frontend Docker build passed again.
- Four focused Chromium scenarios passed against a fresh production NGINX image:
  the two new Hand Controller scenarios plus existing Flowento navigation and
  lazy-loading/cache checks. The same exported scenarios are registered in the
  ordinary E2E suite for CI.
- Verified direct URLs with/without trailing slash, reload, homepage navigation,
  no eager project chunk on Home/hover, no camera request or vision/3D downloads,
  the demo's activation gate, language continuity and reset on reload.
- EN/CZ widths 320, 375, 768 and 1440 were checked for page-wide overflow.
  Desktop, contribution cards and Czech mobile light/dark screenshots were reviewed.
  A low-contrast status line was corrected and protected by browser assertions.
- A unique frontend-only test container was removed afterward. No API or database
  was started or reset; original E2E and development data remained untouched.
- The preceding 26-scenario full-stack run is a separate checkpoint. The full
  expanded 28-scenario database-backed suite has not been rerun for this page.
  There is no new hosted-CI result, commit, push or public deployment.

Run the registered cases with task test:e2e -- hand-controller.spec.js. That normal
runner resets only its isolated E2E database, as described in the [E2E guide](testing/e2e.md).

## Next editorial slice

Review the contribution wording and choose an approved screenshot or short
demonstration recording from the actual desktop app. Keep camera images and
personal desktop content out unless explicitly approved. No installer or live
camera functionality is needed just to explain this project on the portfolio.
