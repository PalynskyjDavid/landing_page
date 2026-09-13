# Flowento project showcase

Route: `/projects/flowento`, linked from the home-page project card. Start the
normal frontend dev server (`task frontend:dev`) and open this route. No Flowento
backend, account, database, or device connection is needed.

## What is included

- EN/CZ project overview and a technology-by-technology contribution section.
- A lazy-decoded static model preview; Three.js and the current CAD GLB load only after clicking
  **Explore in 3D**. Drag to orbit, or use front/back/reset and zoom buttons.
- One current CAD model, with seven color-coded component groups. The original
  comparison model and its public preview have been removed; source files in the
  separate Flowento project are untouched.
- Click a component to inspect it alone; **Show all parts** restores the assembly.
  **Exploded view** plays the five-stage sequence; **Pause**, stage buttons, and
  the keyboard-accessible **Part separation** slider provide manual control.
  **Reassemble** reverses the sequence. Reduced-motion users get immediate poses.
- Rendering only on interaction/resize or user-started playback, no idle loop,
  capped pixel ratio, bounded model loading, cleanup on route changes, and a retryable fallback
  for unsupported WebGL, context loss, or failed model loading.
- The page is independent of score delivery; changing the language does not
  recreate the viewer. Closing it releases its resources.

## Model provenance

Only purpose-built web assets are included in `frontend/src/assets/flowento`.
Vite emits them under content-hashed `/assets/` URLs in production.
Original CAD files and private project notes are **not** copied into public assets.

| Web asset                  | Source                                                              | Preparation                                                        |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `mirror-frame-2025-10.glb` | David's `Downloads/MirrorExport2.step`, export timestamp 2025-10-16 | Local STEP tessellation; 12 meshes, 9,648 triangles, 357,288 bytes |
| `mirror-preview.png`       | Screenshot of the current model in the new viewer                   | Static fallbacks; no third-party image or real user data           |

Newer source SHA-256:
`472f07553ccefac918bf4817ac78baec0933b56268e198d99ee22b8392e982bf`.

The newer STEP assembly identifies `Standard-camera-space-holes v10` and
`BoxV1 v12`. Conversion used **occt-import-js 0.0.23**, entirely locally, with
meter units, absolute linear deflection 0.0004 and angular deflection 0.4.
Its CAD coordinates were rotated -90° around X. The viewer then centers and
scales the model to a normalized display height. This is a presentation, not a dimensionally annotated CAD viewer.

Display materials on the new model are illustrative; geometry was not replaced
with a made-up mirror. The model uses a presentation palette: blue frame, turquoise panel, violet
inner panel, warm mounting accents, green housing, gold access door, and slate back cover. The conversion
tool is not a browser dependency. The viewer uses pinned Three.js 0.186.0.

## Copy and attribution boundaries

The product description follows the local Flowento home page and source code.
The original landing viewer lives in `frontend/src/components/ui/MirrorScene.jsx`;
its introduction appears under author **Fuzumie**, not a verified David alias.
This page does not claim that David authored that viewer or all mirror hardware.

Individual contribution copy is grounded in author-attributed commits:
`743ca14` (audits), `94b92ac` (response timing), `8474164` (aggregates),
`314909a` (grid filtering), `adf42ea` (route filtering), `1b8d091` (exports).
There are no invented performance metrics, customer counts, dates, or team size.
The wider product is explicitly presented as a team effort. MongoDB/Mongoose,
React, Node.js/Express, and JavaScript have scoped contribution subsections.
Three.js is included separately as project context, not a personal authorship claim.

Before public release, David should review the wording, confirm whether additional
UI/design/routing work belongs in his contribution section, and confirm any team
credits and links. The public Reddit showcase is linked below; no hosted application URL or team repository visibility is assumed.

## Tests and next steps

- `npm test`: GLB structure, geometry/size budgets, static preview assets, plus
  existing localization and app tests.
- `task test:e2e -- flowento-project.spec.js`: project navigation, mobile/Czech
  layout, actual WebGL interaction, staged motion, pause/cancellation, disposal, failure/retry, and
  unsupported WebGL. Uses the existing isolated E2E stack, not the production DB.
- Local browser-only runs can exercise the same exported scenarios in
  `e2e/support/project-scenarios.js` without bringing up a database.
- The lazy Three.js renderer chunk triggers Vite's >500 KB advisory (about 647 KB
  minified / 164 KB gzip); it is not part of the initial route download. Do not
  hide this warning or move the renderer into the main application bundle.

Remaining editorial work: approved screenshots with synthetic data, fuller
individual contribution story, and an agreed team/repository link. No publishing,
commit, target-database migration, or deployment is performed by this slice.
Migration verification uses only the isolated test database.

## Component mapping and exploded-view behavior

The manifest in frontend/src/components/flowento/mirrorModels.js maps actual
GLB nodes to component labels. It does not claim a complete electronics bill of
materials. The 12 meshes are grouped into mirror panel (mesh 4), outer frame
(5–6), inner display panel (7), mounting pieces (8–10), rear housing (0, 2–3),
housing access door (1), and back cover (11). Mesh indexes here are zero-based.

The door is the existing thin panel with an access slot, not newly fabricated
geometry. It was previously included in the housing group. Existing fitting
features are retained. The model does not establish a working hinge, so the
viewer demonstrates removal by sliding the panel out instead of inventing a pivot.

| Progress | Movement                                                    |
| -------- | ----------------------------------------------------------- |
| 0–20%    | Back cover moves rearward.                                  |
| 20–30%   | Access door slides out of the rear housing.                 |
| 30–40%   | Housing moves rearward; its extracted door travels with it. |
| 40–60%   | Mounting pieces separate.                                   |
| 60–80%   | Inner display panel separates.                              |
| 80–100%  | Mirror panel separates forward.                             |

The access-door motion is a substep of the second of five labeled stages. The
outer frame never moves. Each substep uses smoothstep easing; reversing the
progress restores the same poses in reverse order. A full playback takes about
5.5 seconds and starts only on request. Pausing, scrubbing, selecting a component,
closing, navigation, retry, and context loss cancel playback. Reduced-motion
preferences skip playback but keep the stage buttons and slider fully usable.

Offsets are illustrative, not mechanically verified disassembly instructions.
They are applied in normalized world coordinates from saved assembled positions,
so repeated slider changes do not drift. A fixed full-motion camera envelope
prevents continuous camera movement during separation. Selecting a component
fits that part and temporarily disables the slider. Close and retry reset
selection and separation; language switches preserve both.

Unit tests load the real GLB to verify one-to-one mesh coverage, colors,
translations, intermediate stage positions in both directions, the door's
combined motion, camera-envelope coverage, and exact reassembly. Browser tests
cover stage controls, animation and reduced motion, isolation, EN/CZ mobile
layout, cancellation, and WebGL recovery.

## Public showcase

David supplied the team's [Reddit showcase](https://www.reddit.com/r/MagicMirror/comments/1llfb76/smartmirror_with_fullfeatured_smart_ecosystem_we/). The post presents the
prototype and requests community feedback. The page links to it from the hero
in EN/CZ, opening a separate tab with noopener/noreferrer. No Reddit script,
iframe, video, or thumbnail is loaded by the portfolio page itself.

This is supporting project context, not evidence that David personally authored
every feature mentioned in the post, nor a claim of a current commercial launch.

## Integration and bandwidth

The home-page project card links to /projects/flowento using React Router. The
route itself is lazy-loaded; neither its code nor its model/preview is requested
on Home. On the project page, the small static preview loads as it approaches
the viewport (native lazy loading, asynchronous decode, reserved dimensions).
Scrolling, hovering the home-page link, and switching languages never opt into 3D.

Clicking **Explore in 3D** dynamically imports the scene renderer, then fetches
the GLB. There are no remote textures, CDN scripts, video embeds, or additional
model files. Loading is abortable and bounded, and closing the viewer frees GPU
resources. Reopening reuses the JavaScript module and the browser's normal HTTP
cache rather than adding an IndexedDB/service-worker cache for this feature.

Production assets use Vite's content-hashed names so the existing NGINX
immutable cache policy can safely reuse them. Changing an asset changes its URL.
The build copies the assets through the ordinary frontend Docker build: there
are no external download or manual-upload steps. Original CAD files stay private.

NGINX gzip is enabled only within the public /assets/ location, including JS,
CSS and GLB files. PNG files are already compressed. Responses vary by
Accept-Encoding; HTML remains revalidated and API responses stay no-store and
are not compressed by this change. No live-server configuration is changed
until a new frontend image is deployed.

Measured from the local production NGINX container on 2026-09-13 (decimal kB):

| When         | Additional Flowento data                                              |
| ------------ | --------------------------------------------------------------------- |
| Home         | No project, preview, renderer or model download                       |
| Open project | About 5 kB gzip page JS, 2 kB gzip CSS, 56 kB preview                 |
| Open 3D      | About 258 kB gzip renderer + model; about 1 MB without compression    |
| Reopen 3D    | Renderer module reused; model served from browser cache when retained |

Measured encoded bodies: page JS 4,584 bytes, page CSS 2,196 bytes, preview
56,333 bytes, renderer 164,712 bytes and model 92,861 bytes. The renderer/model
combined transfer is 257,573 bytes versus 1,004,254 raw bytes, about 74% smaller.
Both gzip and identity responses decode to the same bytes.

These figures exclude shared app code, HTTP headers and API traffic; they are
local-container measurements, not measurements from the public VPS. The browser
scenario verifies a cache hit (zero transfer bytes) when reopening the model. Cache
entries can still be evicted by the browser or bypassed by developer tools.

Every npm run build (also Docker and CI) runs scripts/flowentoBudget.js. It walks
the generated static import graph and fails if Flowento enters the initial app
bundle or Three.js enters either the initial or project-page bundle. It also
requires separate versioned model/preview assets and enforces these ceilings:
25 kB gzip additional page JS, 200 kB gzip on-demand 3D JS, 400 kB raw GLB and
80 kB preview. The existing large-chunk advisory is intentionally not suppressed.

The Flowento browser scenario additionally verifies real network requests and,
against the production NGINX container, gzip, immutable caching, an encoded
renderer-plus-model transfer below 350 kB, and a cache hit when reopening 3D.
The production-web scenario checks gzip and missing-asset 404 handling too.

Implementation references: [Vite asset handling](https://vite.dev/guide/assets.html)
and [NGINX gzip directives](https://nginx.org/en/docs/http/ngx_http_gzip_module.html).

## Container verification (2026-09-13)

All seven Flowento scenarios pass as part of the 26-scenario full-stack suite.
The full quality gate also passes: 150 frontend unit tests, Go tests, lint,
formatting, builds and 12 deployment safeguards. See [the E2E record](testing/e2e.md#flowento-localization-and-device-filters-2026-09-13).

The first container run caught a directory-routing bug that the Vite preview did
not expose. After assets moved into src/assets, an empty public/projects/flowento
directory could remain locally. NGINX's old directory fallback redirected the
route to its internal port 8080. The SPA fallback now checks files only, then
serves index.html. Direct URLs with and without a trailing slash return 200 HTML,
without redirects; refreshing the project works. Regression assertions cover
these URLs and preserve missing-asset 404 handling. See [NGINX try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files).

No commit, push or public deployment was made. Migration 009 was exercised only
in the isolated test database; its original schema-8 contents and three scores
were restored and fingerprint-verified afterward, and the database was stopped.
