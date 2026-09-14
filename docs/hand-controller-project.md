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

The original desktop application and OS-input controller were not launched.
No camera photographs, recordings, installers or private portfolio notes are
published. The only copied binary is the verified public pretrained model.

## Live, opt-in MediaPipe demo

The former pinch slider is replaced by a real camera/landmark view. Start camera
requests video only. After permission is granted, the page loads the pinned
MediaPipe 1.0.1 module worker, WebAssembly runtime and versioned float16 model.
The worker detects up to two hands; a mirrored canvas displays 21 landmarks per
hand over the matching video frame. This shows recognition only, not gesture
bindings, cursor movement, OS clicks or the complete desktop controller.

Video and landmarks remain in memory inside the browser. There is no upload,
recording, microphone, analytics event containing landmarks, or persistent demo
state. All model/runtime requests go to this same website; visitors do not fetch
scripts or models from Google/CDNs. Normal server access logs can still record
requests for these static files, but never receive camera images.

Stop camera, route unmount, pagehide, hidden tabs, disconnected tracks, model
errors and worker timeouts dispose of the stream/worker. Pending permission and
bitmap results are cancellation-safe. Camera access is never resumed automatically.
Language switches keep the active session and do not request the camera again.

## Performance and deployment

- React.lazy still defers the project page; no model, WASM or worker is fetched
  on Home, hover, project navigation or denied camera permission.
- Inference runs off the UI thread on the CPU, with one bitmap in flight and an
  upper limit of 15 frames/second. This is a cap, not a guaranteed frame rate.
- Frames are resized to 640 pixels wide; the preview preserves aspect ratio.
- The worker transfers each bitmap back with its landmarks. The UI draws both in
  one paint, keeping the previous complete preview visible during inference.
  Canvas dimensions change only when the frame size changes. This avoids the
  camera-only frames that previously made the skeleton flicker. Returned bitmaps
  are closed after drawing, including late results after cancellation.
- Skeleton lines have a dark outline for contrast on bright camera backgrounds.
  No stale landmarks are carried onto a new frame when no hands are detected.
- Runtime/model assets total about 20 MB raw / 9.43 MB at NGINX's gzip level 5.
  Content-hashed URLs use the existing immutable cache. Cache reuse depends on
  browser settings and eviction; this is not an offline guarantee.
- The production CSP permits same-origin workers and WebAssembly compilation
  (wasm-unsafe-eval), not arbitrary JavaScript eval or remote scripts. Permissions
  Policy allows same-origin camera and denies microphone/geolocation. Camera must
  remain allowed on Home as SPA navigation retains the original document policy.
- HTTPS or localhost is required. Unsupported browser features and permission,
  camera and model failures have EN/CZ messages and retry controls.
- No backend, migration or deployment helper changes are needed. Build/redeploy
  the web image normally; the model is included in the existing source COPY.

See [the model provenance](../frontend/src/assets/hand-controller/README.md) and
[Google's web guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js).

## Verification (2026-09-13, camera replacement)

Frontend formatting/lint pass, with 164 unit tests across 26 files.
Lifecycle unit tests cover late permission/bitmap cancellation, video-only access,
failure cleanup, worker timeout, single-frame backpressure and landmark drawing.
The model checksum and all EN/CZ status messages have regression checks.

Four exported Chromium scenarios cover lazy EN/CZ navigation/mobile layout,
permission denial/retry, the real model with a synthetic canvas video stream,
stop/restart, language continuity, route/tab cleanup, and model download failure.
They pass in Vite and against built assets served with the production CSP and
Permissions-Policy. These tests never activate a developer's physical webcam.
The synthetic-video case exercises inference but does not measure real-hand
recognition quality. A physical-camera check remains for David.

Docker Desktop reported that it could not start, so the actual updated NGINX image
and full database-backed suite still need verification. The temporary static
server is not a substitute for a Docker/NGINX check. No DB was started or reset.
The registered suite now has 30 scenarios; the earlier 26-case full run and
four old illustration checks are separate historical checkpoints.

Run task test:e2e -- hand-controller.spec.js when Docker is available; that normal
runner resets its isolated E2E database, as explained in [the E2E guide](testing/e2e.md).
No commit, push or public deployment is performed by this change.
