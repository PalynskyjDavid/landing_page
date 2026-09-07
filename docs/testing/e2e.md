# Browser tests: setup, reset, run, inspect

The four scenarios use real Chromium, React, the canonical Go backend, and
PostgreSQL 16. Score submission and leaderboard responses are not mocked.

## Current coverage

1. **Save and reload:** play five rounds, save a named score, then reload and
   read it from the leaderboard.
2. **Idempotency:** submit a score through the API, replay the identical request
   without creating a duplicate, and reject changed data with the same UUID.
3. **Offline recovery:** simulate API connection loss, queue a score, reload,
   restore the connection, and verify that one score is saved and survives reload.
4. **Invalid input:** send malformed or invalid score requests, verify their
   error codes, and confirm that the leaderboard stays empty.

The idempotency and invalid-input tests call the real API using `page.request`;
they do not exercise the frontend submission flow. The offline scenario uses
the app's connection-loss switch, not a stopped backend/database or full browser
network loss. Direct database constraints and real infrastructure outages need
their own integration scenarios.

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

- The normal command sets up the database, compiles the Go API, lets Playwright
  start the API/frontend, runs tests, and removes the test container and volume.
- `--headed` shows the browser. `--ui` opens Playwright's test explorer; close it
  when done so the wrapper can finish. Forward Playwright options after `--`.
- Keep `KEEP_TEST_DB=true` **before** `--`; it is a Task variable. Putting it
  after `--` forwards it to Playwright as a test-file filter and finds no tests.
- `KEEP_TEST_DB=true` keeps PostgreSQL running with the **last executed test's**
  state, including after a test failure. It does not keep API/frontend processes.
- Cleanup is in a JavaScript `finally` block, so a nonzero test exit still cleans
  up. A force-killed process or computer shutdown cannot guarantee cleanup: use
  `task test:db:down` afterward.
- Failed setup/build/test runs print recent PostgreSQL logs before cleanup.
  If Docker itself is unavailable, log capture may also fail; the original
  failure is still reported. Keep mode does not claim setup succeeded when it did not.
- `task check` remains the quick, Docker-independent gate. E2E tests are separate
  from Vitest and now have their own job in `.github/workflows/ci.yml`. The job
  runs headlessly with cleanup enabled and uploads reports for seven days; see
  `docs/ci.md`. The first hosted E2E run failed during database initialization;
  the TCP-readiness fix still needs a new hosted run after pushing.

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
| `test:db:down` | Remove the test container and its disposable data volume. |
| `test:db:status` / `test:db:logs` | Inspect test container status/logs. |

The health check explicitly uses TCP on container port 5432. PostgreSQL's
initialization server accepts Unix-socket connections before its final TCP server
starts; a socket-only health check can therefore allow migrations to start too early.

The baseline currently means zero scores and one zeroed `stats_summary` row.
Shared seed data can be added to `baseline.sql`. A test that starts with an empty
leaderboard would then need a different explicit fixture or updated assertions.
Add newly introduced application tables to the reset script when needed. Do not
truncate the migration version table or use down migrations just to clear data.

Before **each test**, the automatic fixture in `frontend/e2e/fixtures.js` calls
the same reset helper. It also runs before repeated tests/retries. There is no
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
example` score. The invalid-input test leaves no scores, so a complete run in
file order ends with an empty `scores` table even though all four tests passed.

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
   and API/frontend startup. It refuses unmanaged direct Playwright runs.
5. **`frontend/scripts/test-e2e.js`**: setup/test/cleanup sandwich. The database
   tasks and runner reuse `frontend/e2e/support/database.js`.

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
