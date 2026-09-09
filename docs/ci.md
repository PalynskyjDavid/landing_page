# CI pipeline

The workflow lives in `.github/workflows/ci.yml`. This is continuous integration:
it checks changes, but does not deploy the app, publish images, or modify your
development database. The E2E job runs the same fourteen Playwright scenarios used
locally against its own disposable database.

## What runs

Pushes and pull requests start three
independent jobs on Ubuntu 24.04:

1. **Formatting, lint, unit tests, and builds** installs the pinned tools and
   locked frontend dependencies, then runs `task check` and `task security:check`.
2. **PostgreSQL migrations and integration tests** starts a fresh PostgreSQL 16
   service, applies every migration, runs migration again to check the no-op
   path, reports the schema version, and runs `task backend:test:integration`.
3. **Playwright end-to-end tests** installs Go, Node.js, Task, frontend dependencies,
   and Chromium with its Linux libraries. It runs `task test:e2e KEEP_TEST_DB=false`,
   then uploads the report and available failure evidence.

The quality job also checks `docs/contracts/openapi.yaml` against real HTTP
handler responses through the regular Go tests. `task api:check` runs just these
contract checks locally.

The security step runs `npm audit` for all dependencies and pinned govulncheck
v1.7.0 for the backend and Tern. npm findings or Go findings on affected code paths
fail the step. It needs network access and uses current advisory databases, so a
previously passing commit can fail after a new advisory is published. It never
applies fixes automatically. Source scans use the runner's platform; this is not
a secret scan, container OS scan, or proof that every vulnerability was found.
See the [dependency review](security/dependency-review-2026-09-08.md).

The jobs can run in parallel; none needs another job's outputs. Steps inside
each job run in order; normal steps stop on failure, but the E2E artifact step
also runs after a failure unless the workflow was cancelled. Each job has a
15-minute timeout.
A newer run for the same branch or pull request cancels its older unfinished run.

GitHub supplies and removes the PostgreSQL service for the integration job. The
credentials in the YAML are disposable test values, not production secrets.
Nothing connects to the PostgreSQL container on your computer. See GitHub's
[PostgreSQL service-container guide](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).

The E2E job is a separate runner. It uses Docker Compose via `task test:e2e` to
create its own PostgreSQL container, apply migrations, reset data, build the Go
API, collector and React/NGINX images, and start their containers. Browser scenarios use the
production web server and its `/api` proxy on port 5188. Only development Swagger
uses host Vite (5197). Tests run headlessly with one worker, including actual API
crash/replacement, DB recovery and anonymous traffic collection. The wrapper removes all four containers and
the test volume afterward; GitHub discards the runner at job end.
No Docker Desktop, pgAdmin, repository secrets, or deployed server is needed on
the hosted runner. The `postgres` job's service is not shared with the E2E job.

## How the files connect

- `ci.yml` describes the runner, tools, service database, and order of steps.
- `Taskfile.yml` owns the actual project check commands.
- `test:e2e:install` forwards arguments, so CI can use
  `task test:e2e:install -- --with-deps` to install Chromium's Linux dependencies.
- `frontend/scripts/test-e2e.js` owns the E2E lifecycle and calls Playwright.
- `frontend/playwright.config.js` owns browsers, development docs startup, and reporting;
  `compose.e2e.yml` defines isolated web/API/database/collector services, and `frontend/e2e/baseline.sql`
  supplies the data reset. `my-backend/Dockerfile` builds the Go runtime image;
  `frontend/Dockerfile` builds React and packages it with `frontend/nginx.conf`.
- `my-backend/go.mod` selects Go; `.nvmrc` selects Node.js.
- `frontend/package-lock.json` makes `npm ci` install the recorded dependencies.
- Task 3.53.1 and golangci-lint 2.13.1 match the documented local versions.
- Go lint includes the `integration` build tag, so opt-in test code is checked
  even when a database is not running. Unit tests remain database-independent.

The external actions are pinned to full commit IDs. The comments beside them
show the corresponding release tags. Update a pin only after checking its
official release, and keep local tool versions and this document consistent.
The setup-go v7.0.0 and setup-task v2.2.0 pins use Node 24, replacing the actions
that produced the earlier Node 20 runtime warnings. upload-artifact v7.0.1 also
uses Node 24. These action runtimes do not change the application's Node version
selected by `.nvmrc`, the Go version in `go.mod`, or Task 3.53.1.
The pins were checked against the official
[setup-go release](https://github.com/actions/setup-go/releases/tag/v7.0.0),
[setup-task release](https://github.com/go-task/setup-task/releases/tag/v2.2.0),
and [upload-artifact release](https://github.com/actions/upload-artifact/releases/tag/v7.0.1)
and their `action.yml` runtime declarations.
The workflow token has only `contents: read`, checkout does not retain Git
credentials, and this pipeline requires no repository secrets.

## First E2E CI run and review together

Local validation is not a GitHub-hosted run. After reviewing the commits, push
the existing branch normally. There is no need to merge it into `main` first.
Open the repository's **Actions** tab, choose **CI**, and open the latest run.

Read it from the outside in: **workflow → job → step → command output**. Expand
the first failed step if a job is red; the log should identify the same command
you can run locally. A green pipeline means these checks passed, not that every
possible game or outage scenario has been tested.

The workflow also declares `workflow_dispatch` for manual runs. GitHub normally
offers the **Run workflow** button once the workflow is on the default branch;
the initial feature-branch run is triggered by its push. See GitHub's
[manual-run documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

Branch protection and required checks are deliberately not changed here. We
will choose them after seeing a successful hosted run. Image builds now run inside
the existing E2E job; image publishing and deployment remain deferred. The first E2E hosted run failed during database
initialization, then David reported a successful follow-up run for all three jobs.
That success was user-reported rather than independently inspected. The additional
Swagger/recovery/container scenarios still need a new hosted run after pushing this slice.

## Download a replay after a failure

Open **Actions → CI → the run → Artifacts** and download
`playwright-results-<attempt>`. Artifacts are retained for seven days. This upload
contains only `frontend/playwright-report/` and `frontend/test-results/`, not the
database volume or the rest of the repository.

The HTML report is uploaded on successful and failed runs. The current Playwright
configuration retains traces and screenshots only for failed tests; passing tests
do not have saved traces. If setup fails before Playwright starts, there may be
no report to upload—read the failed setup step's log instead. Uploading a report
does not turn a failed test job green.

After extracting the downloaded ZIP to a folder you choose, use the locked
Playwright installation from the repository root (replace the example path):

```powershell
node frontend/node_modules/@playwright/test/cli.js show-report "C:\path\to\extracted\playwright-report"
```

Open the failed test in the report and select its trace to inspect actions,
screenshots, and network activity. Traces can contain request data and cookies,
so keep these tests pointed at disposable test data. See
[Playwright CI reports](https://playwright.dev/docs/ci-intro) and
[artifact retention](https://github.com/actions/upload-artifact#retention-period).

## Local equivalents

```powershell
task check
task security:check
task backend:test:integration
task test:e2e
```

The security command needs network access. The integration command needs PostgreSQL and `DATABASE_URL`. Locally, Task can load
that URL from `.env`; GitHub provides its own URL through the job environment.
The integration tests own temporary schemas and do not modify application scores.
The E2E command instead manages and resets the dedicated E2E database. See
`docs/testing/e2e.md` for local UI mode, keep mode, and pgAdmin inspection.

## Local verification (2026-09-07, Windows)

- actionlint v1.7.12 passed for `.github/workflows/ci.yml` (workflow/expression
  validation; optional ShellCheck/Pyflakes integrations were disabled).
- YAML assertions passed for the three independent jobs, read-only permissions,
  full-SHA action pins, shared Task commands, upload-after-failure condition,
  artifact paths, and seven-day retention.
- The Task dry run expands the Linux installation command to
  `node node_modules/@playwright/test/cli.js install chromium --with-deps`.
  A Playwright `--dry-run` also confirmed argument forwarding without installing
  browsers or system libraries on the developer's machine.
- `task check` passed, including Go tests, all 21 Vitest tests, and both builds.
- With `CI=true`, `task test:e2e KEEP_TEST_DB=true` passed all four scenarios in
  54.8 seconds and generated the HTML report. Keep mode preserved the developer's
  isolated test container; the workflow explicitly uses `KEEP_TEST_DB=false`.
- At this checkpoint the Ubuntu browser/library installation, action execution, and artifact upload
  have not run on GitHub yet. Commit/push and inspect that hosted run before
  considering the CI rollout verified.

## First hosted failure and fix (2026-09-08)

[Run 34161440677](https://github.com/PalynskyjDavid/landing_page/actions/runs/34161440677)
at `409aca1` passed quality and PostgreSQL integration checks. E2E reached database
setup but the first migration connection to port 5547 failed with
`connection reset by peer`. Playwright had not started, so no browser report existed.

The likely cause was the socket-only `pg_isready` health check accepting
PostgreSQL's temporary initialization server. Both test health checks now use
`-h 127.0.0.1 -p 5432` to wait for the final TCP server. The E2E wrapper prints
database logs before cleanup on failures, including failures before browser startup.
Log/cleanup errors no longer replace the original failure.

Local verification passed three empty-volume migration cycles and a fourth fresh
start running all four browser scenarios with `CI=true`. This is local Windows
verification; a successful GitHub-hosted run of this fix is still pending push.

After the OpenAPI slice, `task check`, PostgreSQL integration tests, actionlint,
and another fresh-start browser run all passed (four scenarios, 50.8 seconds).
The changes remain local and uncommitted; no hosted success is claimed for them.

### Follow-up reported by David

David subsequently reported green formatting/lint/unit/build and migration/
integration jobs (about 1m30s), plus green Playwright E2E (about 3m). The hosted run
was not independently inspected in this slice. The earlier "local/uncommitted"
notes above describe that historical checkpoint, not the current checkout.

The current E2E suite includes fourteen scenarios: the original game/API cases,
local Swagger, lost responses, real API/DB outages, production web smoke checks,
API replacement, statistics/grouping, two rate-limit/cooldown scenarios and
anonymous system-metric buffering/privacy. It builds pinned multi-stage Go API,
collector and React/NGINX images locally without publishing
them. The first uncached image build adds dependency downloads/compilation time;
there is not yet a cross-run Docker cache. The workflow still uses the shared
Task command, one worker, and disposable data.

See the official [PostgreSQL image entrypoint](https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh)
and [pg_isready options](https://www.postgresql.org/docs/current/app-pg-isready.html).
