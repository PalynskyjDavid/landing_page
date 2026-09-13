# Browser tests: setup, reset, run, inspect

Latest focused verification: [Hand Controller, 2026-09-13](#hand-controller-focused-checks-2026-09-13).
Last full-stack verification: [26 scenarios before the Hand Controller addition](#flowento-localization-and-device-filters-2026-09-13).

The 28 registered scenarios use real Chromium, production React assets served by NGINX,
the containerized canonical Go backend, and PostgreSQL 16. Swagger alone uses
a development Vite server. Score/leaderboard values come from the real API; the lost-response
test deliberately discards selected real responses rather than inventing a save.

## Current coverage

1. **Save and reload:** play five rounds, save a named score, then reload and
   read it from the leaderboard.
2. **Idempotency:** submit a score through the API, replay the identical request
   without creating a duplicate, and reject changed data with the same UUID.
3. **Offline recovery:** simulate API connection loss, queue a score, reload,
   restore the connection, and verify that one score is saved and survives reload.
4. **Invalid input:** send malformed or invalid score requests, verify their
   error codes, and confirm that the leaderboard stays empty.
5. **API docs:** render local Swagger UI, execute a real health request, and check
   that no external documentation/CDN/validator origin is contacted.
6. **Lost responses:** discard the first cookie-only response and a later committed
   score response. Verify identical retries, a stable established cookie, and one row.
7. **Real database outage:** stop PostgreSQL, verify live=200/ready=503, queue two
   played games, reload, restart without resetting data, and recover one row per UUID.
8. **Real API crash:** check non-root/read-only runtime settings and successful
   SIGTERM shutdown, then SIGKILL the API before clicking Save. Start a new game,
   reload, resume the same container, and recover one stored row.
9. **Production web:** direct home/game loads and reload, hashed asset caching,
   browser security headers, same-origin API/cookies, no browser errors, and no
   exposed Swagger, Vite source, environment file or fallback HTML for missing APIs.
10. **Proxy recovery:** remove the API, check JSON 503 while web remains usable,
    create a replacement API and recover through the unchanged web container.
    Docker may reuse the old IP; this checks replacement, not a guaranteed IP change.
11. **Statistics:** seed two real players, compare grouped averages/chart/table,
    personal and numeric filters, empty/reset states, and narrow mobile layout.
12. **Real rate limit:** exceed the NGINX score quota while rotating cookies and
    spoofing forwarding headers; check JSON 429/Retry-After and oversized-body 413.
13. **Cooldown recovery:** inject one 429, navigate and reload while a score stays
    queued, then verify the same payload saves once after the cooldown.

14. **System statistics:** private request-ID correlation, aggregate-only public data,
    API/DB-outage buffering, error/rate-limit counters and responsive charts.
15. **Localization (three scenarios):** active game/outbox continuity, Czech mobile
    statistics, unchanged filter values and blocked preference-storage fallback.
16. **Device types (two scenarios):** stable changing controls, mobile/computer
    classification, persisted score payload and server-side filtering/grouping.
17. **Flowento (seven scenarios):** direct navigation/reload, EN/CZ mobile layout,
    real 3D rendering/cleanup, model failure/context loss, unsupported WebGL,
    part isolation/staged disassembly, animation cancellation, lazy loading,
    real gzip transfer size and browser HTTP-cache reuse.

18. **Hand Controller (two scenarios):** lazy navigation/reload, EN/CZ mobile
    layouts, keyboard-accessible illustrative action gating, contrast, preserved
    language-switch state and no camera/model access.

The idempotency and invalid-input tests call the real API using `page.request`;
they do not exercise the frontend submission flow. The offline scenario uses
the app's connection-loss switch, not a stopped backend/database or full browser
network loss. The new outage scenario actually stops only the owned test database
and restores it in `finally` if needed. The lost-response scenario is precise HTTP
fault injection; it does not kill the Go process. The separate backend scenario
does kill that process but does not claim to interrupt a SQL transaction mid-commit.
Full browser network loss remains a separate follow-up scenario.

The direct API tests first GET the leaderboard to establish a cookie. They do not
use the frontend adapter's automatic first-POST cookie handshake.

Run the new examples alone with:

```powershell
task test:e2e -- api-docs.spec.js
task test:e2e -- score-recovery.spec.js
task test:e2e -- backend-recovery.spec.js
task test:e2e -- production-web.spec.js
task test:e2e -- statistics.spec.js
task test:e2e -- zz-rate-limits.spec.js
```

## Commands from the repository root

Install dependencies after pulling the changes, then install Chromium once:

```powershell
npm ci --prefix frontend
task test:e2e:install
```

Docker Desktop must be running on Windows. Go, Node.js and Task must be installed.
On Linux CI, `task test:e2e:install -- --with-deps` installs Chromium and its
required system libraries; the normal local install command is unchanged.

```powershell
task test:e2e
task test:e2e KEEP_TEST_DB=true -- --headed
task test:e2e KEEP_TEST_DB=true -- --ui
```

- The normal command sets up/migrates the database, builds and starts Go API and
  production web and collector images, waits for health, runs tests, and removes all four
  containers plus the test volume. Browser tests use `http://127.0.0.1:5188` and
  its `/api` proxy. Go on the host runs Tern; Docker compiles the API and React.
  Playwright starts Vite on 5197 only for the development Swagger scenario.
- `--headed` shows the browser. `--ui` opens Playwright's test explorer; close it
  when done so the wrapper can finish. Forward Playwright options after `--`.
- Keep `KEEP_TEST_DB=true` **before** `--`; it is a Task variable. Putting it
  after `--` forwards it to Playwright as a test-file filter and finds no tests.
- `KEEP_TEST_DB=true` keeps PostgreSQL running with the **last executed test's**
  state, including after a test failure. It does not keep API/frontend processes.
- Cleanup is in a JavaScript `finally` block, so a nonzero test exit still cleans
  up. A force-killed process or computer shutdown cannot guarantee cleanup: use
  `task test:db:down` afterward.
- Failed setup/build/test runs print recent web, API and PostgreSQL logs before cleanup.
  If Docker itself is unavailable, log capture may also fail; the original
  failure is still reported. Keep mode does not claim setup succeeded when it did not.
- `task check` remains the quick, Docker-independent gate. E2E tests are separate
  from Vitest and now have their own job in `.github/workflows/ci.yml`. The job
  runs headlessly with cleanup enabled and uploads reports for seven days; see
  `docs/ci.md`. David reported all three hosted jobs green after the startup fix.
  These additional scenarios still need their own hosted verification after push.

Read the last browser report with:

```powershell
npm --prefix frontend run test:e2e:report
```

Failure screenshots/traces are under `frontend/test-results`; the HTML report is
under `frontend/playwright-report`. They are ignored by Git. Subsequent runs may
replace them, so save important evidence before rerunning.

## Database lifecycle

| Task | Effect on the isolated test database |
| --- | --- |
| `test:db:up` | Start/resume only; preserve data. |
| `test:db:setup` | Start, wait for health, apply all real migrations, then reset data. |
| `test:db:reset` | Restore `frontend/e2e/baseline.sql`; keep the schema and migration version. |
| `test:db:stop` | Stop the container; retain its data volume. |
| `test:db:down` | Remove test web/API/DB/collector containers and their disposable data volume. |
| `test:db:status` / `test:db:logs` | Inspect test container status/logs. |

The health check explicitly uses TCP on container port 5432. PostgreSQL's
initialization server accepts Unix-socket connections before its final TCP server
starts; a socket-only health check can therefore allow migrations to start too early.

For the complete manual stack, use `task test:stack:setup`, then open
`http://127.0.0.1:5188/game`. No host frontend process is required. The optional
`task test:frontend` still provides Vite hot reload and `/docs` on port 5187.
Setup resets test data. To resume without
resetting, use `task test:stack:up`; to restart only the API, use `test:api:stop`
and `test:api:up`. These commands refuse to interfere with an active E2E run.
See [the container walkthrough](../containers.md) for ports, Dockerfile explanation,
runtime configuration, health checks, shutdown, and cleanup.

The baseline currently means zero scores and one zeroed `stats_summary` row.
Shared seed data can be added to `baseline.sql`. A test that starts with an empty
leaderboard would then need a different explicit fixture or updated assertions.
Add newly introduced application tables to the reset script when needed. Do not
truncate the migration version table or use down migrations just to clear data.

Before **each test**, the automatic fixture in `frontend/e2e/fixtures.js` calls
the same reset helper and resumes stopped/unhealthy test services left by a failed
worker. It also runs before repeated tests/retries. There is no
reset between steps of one scenario, or after its last assertion. A fresh browser
context provides fresh cookies/localStorage/IndexedDB; the fixture independently
resets PostgreSQL. Browser isolation alone does not clear database data.

There is one browser project and one worker. Do not increase workers until we
give each worker a separate database/schema. The fixture rejects `--workers=2`.
A `landing-page-e2e-database.lock` file in the operating system's temporary
directory also prevents overlapping runs or manual resets while a run owns the
shared test database. This lock is shared across checkouts for the same OS user;
an error prints its full location. After a forced termination, inspect the PID
and repository path in that file and ensure the run and its servers have stopped
before removing that specific stale lock file. Normal completion removes it.

## Inspect with pgAdmin

After a `KEEP_TEST_DB=true` run, register a **separate** pgAdmin server:

| Field | Value |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `5547` |
| Maintenance database | `reaction_e2e` |
| Username | `e2e_user` |
| Password | `e2e_password` |

These are disposable local test credentials, not secrets or production values.
`reaction_e2e` is the database name, not the hostname. In Docker Desktop, expand
the `landing-page-e2e` Compose group to inspect `landing-page-e2e-db-1`; host
port `5547` forwards to PostgreSQL's container port `5432`.

Inspect `public.scores` and `public.schema_version`. To pause inspection while
preserving data, use `test:db:stop`, then `test:db:up` to resume. **Setup/reset
intentionally discards previous test data.** Down deletes that test volume;
discarded test rows are not recoverable unless you saved them yourself.

In Playwright UI mode, run only one test to inspect its result before starting
another. The save-and-reload test leaves one `E2E Player` score; the idempotency
test leaves one `Retry example` score; offline recovery leaves one `Offline
example` score. The invalid-input and docs tests leave no scores. Lost-response
recovery leaves one `Lost response player` score; the real-outage test leaves two
`Outage player` scores. Backend recovery leaves one `Backend restart player` score.
The two production-web tests leave no scores.
Inspect the last executed test, not an assumed fixed suite order.

The tooling uses the fixed `landing-page-e2e` Compose project and explicit
`compose.e2e.yml`/`compose.env` files. It checks container/volume ownership labels,
uses a fixed test connection string, and guards the reset SQL by database/user.
It never uses the development database URL as a reset target. The development
Compose project and its `pgdata` volume are outside this lifecycle.

## Files to read and modify

1. **`frontend/e2e/reaction-game.spec.js`**: the four scenarios listed above. Named
   `test.step` blocks organize actions inside the save-and-reload test.
2. **`frontend/e2e/fixtures.js`**: wraps Playwright's `test` with the reset hook.
3. **`frontend/e2e/baseline.sql`**: known starting data, separate from migrations.
4. **`frontend/playwright.config.js`**: Chromium, timeouts, reports, isolated ports,
   and frontend startup. It refuses unmanaged direct Playwright runs.
5. **`frontend/scripts/test-e2e.js`**: setup/test/cleanup sandwich. The database
   tasks and runner reuse `frontend/e2e/support/database.js`.
6. **`frontend/e2e/score-recovery.spec.js`**: response-loss and real-outage scenarios;
   shared real-game clicks are in `support/game.js`.
7. **`frontend/e2e/api-docs.spec.js`**: the Swagger UI smoke test.
8. **`frontend/e2e/backend-recovery.spec.js`**: real API stop/crash/recovery;
   `support/backend.js` reuses the same ownership guards and lock as `database.js`.

When creating another `*.spec.js` in `frontend/e2e`, always start with:

```javascript
import { test, expect } from "./fixtures.js";
```

Do not import `test` directly from `@playwright/test`: that skips our reset fixture.
ESLint enforces this import rule for browser specs.

Declare independent `test(...)` blocks beside one another, never inside another
test's callback. A `test.step(...)` is part of its enclosing test and shares its
database state; it does not trigger another reset.

Use UI labels/roles and assertions that wait for results, rather than fixed
sleeps. Do not assert an exact measured reaction time: browser scheduling varies
between computers.

Tests request reduced motion. The game's decorative green pulse respects this
browser preference, so Playwright can wait for a stable click target. The round
timers, input handling, HTTP requests and database writes are still real.

Suggested next manual exercise: add an independent test that leaves the name
blank and expects `Anonymous` on the leaderboard after saving and reloading.
Write it yourself; we can review it together. Other tests' named scores must
not leak into this test. Another useful check is:

```powershell
task test:e2e -- --repeat-each=2
```

Every test repetition must start with the baseline data. To deliberately practice
debugging, change one expected visible label, run with `KEEP_TEST_DB=true`, inspect
the failure report and database, then restore the correct assertion.

## Why not roll back one transaction after every browser test?

A repository test can use a single controlled connection/transaction and roll it
back. The browser talks to a running API whose pool uses independent connections
and commits requests. Rolling back a separate test connection cannot undo those
commits. For now we reset and reseed data; for a large fixture we can later restore
a dump or clone a prepared template database. PostgreSQL already has WAL for
durability/recovery; a custom transaction log is not needed for test cleanup.

References: [Playwright fixtures](https://playwright.dev/docs/test-fixtures),
[server lifecycle](https://playwright.dev/docs/test-webserver),
[PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html).

## Initial setup verification (2026-09-07, Windows)

- `npm ci` succeeded from the updated lockfile; Playwright is pinned to 1.63.0.
- `task check` passed: formatting, lint, Go tests, 21 Vitest tests, both builds.
- The real browser scenario passed twice with `--repeat-each=2`; both repetitions
  saw an empty leaderboard, and the retained DB held only the final score, ID 1.
- Stop/up preserved a probe score. Setup then removed it, restored the zeroed
  summary row, and kept schema version 6.
- A reset attempted during an active run was rejected by the lock.
- A temporary test wrote a score through the API and deliberately failed. With
  keep mode, its score and failure trace remained inspectable. Without keep mode,
  the exit remained nonzero and its test container/volume were removed. The probe
  test was removed afterward; it is not part of the delivered suite.
- A final normal run created a fresh database, applied all six migrations, passed
  the browser scenario, and cleaned up the database and API/frontend servers.

The first run exposed the continuously pulsing click target; reduced-motion
support was added to the app and enabled in Playwright. No game/API responses
were mocked. CI browser execution and automated real infrastructure outage
scenarios remain follow-up work; simulated API loss is covered by the suite.
The existing npm audit findings (10 total) were not changed by this setup.

## Four-scenario checkpoint (2026-09-07, Windows)

- David enabled the three additional examples as independent tests and verified
  them in Playwright UI mode. Obsolete exercise comments were then removed;
  the executable test code was unchanged apart from formatting.
- `task frontend:format` passed; only the browser spec needed formatting.
- `task check` passed: formatting, zero lint issues, Go tests, all 21 Vitest tests
  across five files, and both production builds.
- `task test:e2e KEEP_TEST_DB=true` passed all four scenarios in 55.3 seconds.
- The retained database was healthy on `127.0.0.1:5547`, at schema version 6,
  with zero scores and zero total games after the final invalid-input test.
  The test database lock and API/frontend listeners were gone after completion.
- At that checkpoint the runner still printed a keep-mode message if setup failed before the database
  starts; that message alone is not proof the database is available. Check Docker
  status when setup fails. The 2026-09-08 change below fixes this diagnostic.
- At this checkpoint, browser execution was still local only. The subsequent CI
  configuration and its verification status are recorded in `docs/ci.md`.

## Cold-start reliability fix (2026-09-08, Windows)

- E2E Compose and the CI integration service now check PostgreSQL over TCP.
- Three consecutive empty-volume setup/migration/cleanup cycles passed.
- A fourth empty-volume start passed all four browser scenarios with `CI=true`
  in 53.1 seconds; normal cleanup removed the disposable database afterward.
- Eight new runner unit tests cover failure logs before cleanup, preservation of
  the original error/nonzero exit, cleanup failures, and accurate keep-mode messages.
- The development database was not reset or removed. These local checks do not
  substitute for a successful GitHub-hosted run of the fix.
- Final verification after adding OpenAPI: `task check` passed (29 Vitest tests,
  Go tests including contract checks, formatting/lint, and both builds). PostgreSQL
  integration tests passed against the disposable E2E database. A final fresh-start
  browser run passed all four scenarios in 50.8 seconds and removed its test volume.

## Swagger and recovery checkpoint (2026-09-08, Windows)

- `task check` passed: formatting, lint, Go tests including HTTP contracts, all
  34 Vitest tests across seven files, and both production builds.
- `CI=true` with `task test:e2e KEEP_TEST_DB=false` passed all seven scenarios in
  about 2 minutes 12 seconds, including the real database outage and lost responses.
- The loss test forwards requests to the real API/database and discards selected
  responses; it does not kill the Go process. Actual backend restart remains next.
- The Swagger health smoke test executes a real request and checks that only the
  configured frontend/API origins are contacted. Docs assets are not in the
  production bundle; Scarf install analytics are opted out in `frontend/package.json`.
- Workflow lint (`actionlint`) and `git diff --check` passed. Normal cleanup removed
  the disposable database container/volume. The development database was untouched.
- The existing npm audit total remains 10 findings; no bulk dependency upgrade was
  performed. These are local results, not a hosted CI result for this new slice.

## Containerized backend checkpoint (2026-09-08, Windows / Docker Linux engine)

- Built the digest-pinned Go 1.26.1 image successfully. Inspected its non-root user,
  direct executable entrypoint, SIGTERM stop signal, and readiness probe. Runtime
  image configuration contains no database credentials.
- The first new scenario passed alone, but the first complete run exposed a test
  race: initial `queued` state was observed before an asynchronous request callback
  killed the API. The callback could then run after the test's cleanup. Fault
  injection now runs in the main test sequence, and assertions wait for exhausted
  retries rather than the brief initial outbox-write acknowledgement.
- A temporary test deliberately killed the API and failed without restoring it.
  The next worker's fixture restored readiness and its test passed. The command
  correctly remained nonzero; keep mode removed the API and retained only the DB.
  This deliberate-failure test was removed before final verification.
- Manual `test:stack:setup`, health, `stop`, `up`, and `down` passed. Stop/up kept
  both container IDs; the API returned readiness 200 after resuming.
- The final fresh-start `CI=true` / `task test:e2e KEEP_TEST_DB=false` run passed
  all eight scenarios in about 3.3 minutes. Cleanup removed both test containers,
  the test volume/network, and the run lock. The development DB was untouched.
- `task check` passed: 44 Vitest tests across eight files, Go tests including
  contracts/configuration/health/shutdown, formatting/lint, and both builds.
  HTTP/shutdown tests also passed twenty consecutive repetitions. actionlint and
  whitespace checks passed. No SQL migration or dependency upgrade was introduced.
- These are local results. No image publication, deployment, commit, push, or new
  GitHub-hosted success is claimed. See [the walkthrough](../containers.md).

### Production frontend and proxy verification (2026-09-08)

- The pinned Node/NGINX image built successfully. The targeted Swagger and two
  production-web tests passed (3 tests, 20.1 seconds).
- A fresh full `task test:e2e` run passed all ten scenarios in about 3.5 minutes.
  This reverified real DB/API outages, lost-response and cookie/idempotency behavior
  through NGINX, not only against the directly published Go port.
- `task check` passed, including 64 Vitest tests across ten files, Go tests,
  formatting/lint and both host builds. Compose/Task/CI YAML parsed and
  `git diff --check` passed. These checks do not constitute a hosted CI run.
- Tests cleaned up their three containers, volume/network and lock. Before the
  first reset, David's running manual E2E database was backed up. It was restored
  afterward, with matching SHA-256 of the data-only dump (including sequence values,
  excluding pg_dump's random restrict token). The ignored backup remains in
  `frontend/.e2e/manual-before-web-20260908.dump`. This one-off preservation is not
  an automatic backup feature of setup/reset tasks.
- `npm audit` reported ten existing dependency findings: seven high, one moderate,
  two low. No automatic upgrades were applied; triage remains a pre-hosting task.
- No development database reset, new migration, registry publication, deployment,
  commit or push was performed in this slice.

### Dependency/security verification (2026-09-08)

- Targeted updates and matching Node 22.23.2 / Go 1.26.8 / NGINX 1.30.4 images
  passed all ten browser scenarios in about 3.5 minutes, including both real
  service outages and API replacement behind NGINX.
- `task check` passed with 67 Vitest tests, Go tests, formatting/lint and builds.
  The PostgreSQL integration suite passed against the isolated test DB.
- `task security:check` passed: zero npm findings, no affected Go code paths.
  Tern's one module-only OpenPGP advisory is documented in the
  [review](../security/dependency-review-2026-09-08.md), not suppressed.
- The actual rebuilt Linux API binary also passed govulncheck. NGINX configuration,
  runtime users/read-only filesystems, YAML, actionlint and whitespace checks passed.
- Normal E2E cleanup removed the disposable stack/volume. The pre-run manual data
  was restored from `frontend/.e2e/manual-before-security-20260908.dump`, with an
  identical data/sequence checksum. The manual stack is healthy and running again.
- Development data and SQL migrations were unchanged. Hosted CI verification is
  still pending; full image OS scanning is not claimed by these results.

### Statistics and submission limits (2026-09-09)

- Full `task test:e2e` passed all thirteen scenarios in about five minutes. The
  first run caught an outdated Swagger endpoint count and an exact-label dropdown
  locator; both were corrected. Game saves, real outages and response-loss retries
  continue to work after moving the leaderboard to `/statistics`.
- A final shared-button contrast correction passed
  `task test:e2e -- statistics production-web`: three scenarios, 22 seconds of
  browser execution. Desktop, 360px mobile and dark-mode screenshots were inspected.
  The mobile table scrolls inside its container, not the whole page.
- The full passing HTML report was preserved before that focused rerun at ignored
  `frontend/.e2e/statistics-full-suite-report-20260909/`. The ordinary report folder
  contains the latest focused run. Statistics screenshots are in its test-results
  subdirectory; these are generated artifacts, not committed assets.
- `task check` passed: formatting, zero lint issues, Go/contract tests, 72 Vitest
  tests across thirteen files, and both builds. `task api:check` also passed after
  completing the 429 response documentation for every proxied API operation.
- `task security:check` passed: zero npm findings and no affected Go code paths;
  Tern's existing module-only advisory remains documented. No full image OS scan
  or public deployment security audit is claimed.
- PostgreSQL integration tests passed, including migration 007 down/up, bound
  filters, grouping/summary correctness, and 100,000 synthetic games in temporary
  schemas. [Query measurements](../statistics.md#query-design-and-measurements)
  record both local runs, not a production performance guarantee.
- The manual E2E database was backed up before resets to
  `frontend/.e2e/manual-before-statistics-20260909.dump`. After normal test cleanup,
  it was restored into the owned E2E database. COPY records and sequence states
  matched the backup exactly before migration; their normalized SHA256 was
  `c0a2f38edff9da70712810f66149240ab8dd2d088c18314bd8335e812c0e186e`.
  Migration 007 was then applied explicitly; status is 7 of 7.
- The final web/API/DB are healthy, `nginx -t` passes, and the proxied statistics
  endpoint reads the three preserved games for one player. The manual stack is
  running at `http://127.0.0.1:5188/statistics`. No test resets target development
  `events_db`; that database and machine-wide Node selection were not changed.
- Changes remain uncommitted/unpushed. Next is a reviewed CI checkpoint, then a
  hosting decision and HTTPS/secrets/private-port/backup/deploy checks. Project
  showcase and Kubernetes are intentionally outside this launch slice.

### System statistics and private diagnostics (2026-09-09)

- `task check` passed: formatting, zero lint issues, Go/contract tests, 77 Vitest
  tests across fifteen files and both host builds. Telemetry/HTTP package tests
  passed twenty repetitions. YAML validation and `git diff --check` passed.
- PostgreSQL integration passed, including migration 008 down/up, duplicate batch
  replay without double counting, aggregation/filtering/empty reports and retention.
  Existing game statistics and the 100k-game checks remained green.
- All fourteen browser scenarios passed in 6.2 minutes. The new scenario proves
  real DB-outage buffering, API-down 503 recording, 404/429 counters, route filtering,
  private request-ID correlation and absence of raw request details in public data.
- A focused final rerun passed in 37.1 seconds after adding assertions that wait
  for dark-mode color transitions. Desktop, 360px mobile and settled dark-mode
  screenshots were inspected. Graph labels remain readable on mobile; the table
  scrolls inside a keyboard-focusable region rather than widening the page.
- The full passing HTML report is preserved at ignored
  `frontend/.e2e/telemetry-full-suite-report-20260909/`. The usual report/test-results
  folders contain the final focused run and screenshots. Keep mode correctly
  removed web/API/collector and retained only the disposable PostgreSQL database.
- A subsequent manual lifecycle smoke check resumed that disposable stack,
  queued an unknown-path request and reset DB while the collector was running.
  Counters stayed zero across another flush; no buffered batch reappeared.
  `test:web:stop` / `test:web:up` then reattached the collector, and a new request
  was counted exactly once. Cleanup removed the owned stack and disposable volume.
- `task security:check` passed with no npm vulnerabilities or affected Go paths.
  Tern's pre-existing module-only advisory remains documented. This is not a full
  image/OS scan, security audit or independent uptime measurement.
- The pre-run manual backup `frontend/.e2e/manual-before-telemetry-20260909.dump`
  was restored afterward. COPY records and sequence states matched exactly;
  normalized logical SHA256:
  `bd366a92fdc2cca464db54fff36d33da3464a0bf1510c0c928c83801289cd44f`.
  Migration 008 was then applied; status is 8 of 8. The final four containers are
  healthy, `nginx -t` passes, and the proxied game summary reads three games for
  one player. The live system report has 61 hourly-view points and a collector
  heartbeat. Original scores and development `events_db` were not reset.
- The stack remains available at `http://127.0.0.1:5188/statistics?view=system`.
  Request metrics begin with new collected traffic; they are not reconstructed
  from old games. No commit/push, hosted-CI success, registry publication or public
  deployment is claimed. See [the guide](../observability.md) and ADR 0006.

### Flowento, localization and device filters (2026-09-13)

- Docker Engine 29.7.2 and Compose 5.5.1 were available. The API, NGINX web and
  collector images were rebuilt using the normal E2E runner, with PostgreSQL 16
  and real Chromium. All 26 scenarios passed in 9.2 minutes; retries remained disabled.
- The first run exposed six Flowento failures caused by one NGINX directory
  redirect, plus a System Statistics assertion still expecting raw filter codes.
  The fallback now checks files only before React's index.html, and the assertion
  expects the localized readable labels. Existing backend/SQL behavior was unchanged.
  The full suite was rerun after these fixes, not just the failed tests.
- Actual encoded renderer/model bodies total 257,573 bytes; both use gzip and
  immutable content-hashed URLs. Closing/reopening the viewer reused the renderer
  module and fetched the model from browser cache with zero transferred bytes.
  Home, hover and normal project reading did not load 3D.
- The shared quality gate passed: formatting, zero lint issues, Go tests, 150
  frontend unit tests across 24 files, both builds and 12 deployment safeguard tests.
  The lazy renderer still emits Vite's large-chunk advisory; it is not eager-loaded.
- Before each full run, the original stopped E2E database was backed up using the
  existing backup helpers. Each archive was restored separately and compared to
  every source public table and sequence before resetting any test data. After
  the suite, the original schema-8 database with three scores was restored and
  matched the same fingerprint. Only the disposable test-run data was discarded.
  Backups remain in ignored .backups/; the E2E database is stopped again.
- The extra local data-preservation wrapper encountered a lingering connection
  during the final database-name exchange. Restoration was completed after stopping
  and restarting only the owned E2E database, and verified against the original
  archive again. This was separate from the successful browser run and normal app
  container cleanup; no production restore helper or database was changed.
- The ordinary frontend/playwright-report and frontend/test-results directories
  contain the final full run. Development events_db and production were untouched.
  Migration 009 still needs the normal controlled target-database rollout.
- No commit, push, new hosted-CI result or live deployment is claimed. These checks
  are not a new dependency/image security audit or a physical-device review.

### Hand Controller focused checks (2026-09-13)

The new hand-controller.spec.js registers two scenarios using the normal isolated
fixture. For this frontend-only slice, its two exported scenarios and the existing
Flowento navigation/lazy-loading scenarios passed in Chromium against a temporary
production NGINX image, without starting any API or database. Both direct-route
spellings returned 200 HTML, and desktop/Czech mobile light/dark screenshots were
reviewed. The temporary frontend container was removed afterward.

The shared quality gate passed with 158 frontend unit tests and 12 deployment
safeguards. After a visual contrast fix, the frontend checks, container build and
all four focused browser scenarios passed again. The full suite now has 28 cases;
it has not been rerun since the prior 26-case checkpoint. The ordinary Playwright
report still represents that prior full run, not this focused verification.
No database data, public deployment or source-control history changed.

See [Hand Controller scope and evidence](../hand-controller-project.md). Run the
registered cases with task test:e2e -- hand-controller.spec.js; the usual runner
resets its test database, unlike the temporary frontend-only verification here.
