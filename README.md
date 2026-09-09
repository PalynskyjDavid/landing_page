# Reaction game and statistics

A learning-focused portfolio app built with React, Go and PostgreSQL. Play five
reaction rounds, submit a score, then explore filtered game/player statistics.
Scores remain queued in the browser during an outage and retry using the same
submission ID, so a lost response does not create a duplicate score.

The System statistics tab shows anonymous request/error/latency aggregates.
Raw diagnostic logs remain private. Client-reported scores are **not verified
anti-cheat measurements**, and the anonymous player cookie is not a login.

## Start here

The current release candidate is on **`codex/backend-foundation`**; `main` has not
been updated. Hosting/CD will be configured with David and his friend. Nothing
here provisions hosting or publishes images.

```powershell
git clone --branch codex/backend-foundation https://github.com/PalynskyjDavid/landing_page.git
cd landing_page
```

Use Node **22.23.2**, Go **1.26.8**, Task **3.53.1**, and Docker with the Compose
plugin and Linux containers. The versions are recorded in `.nvmrc`, the Go modules,
and CI. Install golangci-lint **2.13.1** to run the full quality gate. Tern and
frontend tooling are pinned by the repository; no global Tern/Vite installation
is needed. See [development setup](docs/development.md).

### Local development: edit code

Docker must be running. Copy the example only if you do not already have `.env`:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
task dev:setup
```

Review `.env` before setup, especially when using an existing database. Setup
installs frontend dependencies, starts **only PostgreSQL**, and applies pending
migrations. It does not reset data. Changing POSTGRES credentials in `.env` does
not change users/passwords in an already initialized database volume.

Run these in two terminals at the repository root:

```powershell
task backend:dev
```

```powershell
task frontend:dev
```

Open <http://localhost:5173/game> or `/statistics`. Vite hot-reloads React edits;
stop/restart `backend:dev` after Go edits. API health is at
<http://localhost:3001/health/ready>; development Swagger UI is at
<http://localhost:5173/docs>. Ctrl+C stops each process; `task db:stop` stops the
database without deleting its volume. Keep the same browser origin when testing
queued scores. Optional frontend overrides are in `frontend/.env.example`.

This direct development path bypasses NGINX: it does not demonstrate edge rate
limits or collect new System statistics. Use the full container stack for those.

### Container demo and browser tests: disposable data

After `npm ci --prefix frontend`:

```powershell
task test:stack:setup
```

**This resets only the isolated E2E database.** Open
<http://127.0.0.1:5188/game>. It runs NGINX, the canonical API, PostgreSQL and the
metrics collector. No Vite server is required. See [container commands](docs/containers.md)
for pause/resume, logs and outage demonstrations. Never deploy `compose.e2e.yml`
unchanged or point test/reset tooling at a real deployment database.

```powershell
task test:e2e:install
task test:e2e
```

E2E tests reset their database before each test and own the isolated stack while
running. They must not be run while preserving manual scores in that test DB
unless those scores have been backed up. Development `events_db` is separate.

## Code map

```text
frontend/                  React pages, API client, browser outbox, NGINX image
my-backend/cmd/api/         Canonical HTTP API entry point
my-backend/cmd/collector/   Private anonymous-metrics collector
my-backend/internal/       HTTP transport, game services/repositories, telemetry
my-backend/migrations/     Numbered SQL migrations; Tern tracks schema_version
docs/contracts/           OpenAPI and behavior documentation
docs/decisions/           Architecture Decision Records (ADRs)
Taskfile.yml               Shared local/CI commands
.github/workflows/ci.yml   Quality, PostgreSQL and full-stack browser checks
```

`backend/` (NestJS), `backend-go/` (previous Go version) and the old Vite Dockerfile
have been retired. Their source remains in Git history at `f300a4a`; see
[the retirement decision](docs/decisions/0007-retire-legacy-backends.md).

## Verification

```powershell
task check                       # Formatting, lint, unit/contract tests, builds
task security:check              # Current npm/Go advisory checks; network required
task backend:test:integration    # Uses DATABASE_URL; creates isolated test schemas
task test:e2e                    # Disposable full-container/browser scenarios
task --list
```

The integration command needs a running PostgreSQL and a role allowed to create
schemas; do not run it with production credentials. CI runs against disposable
databases. [Actions runs](https://github.com/PalynskyjDavid/landing_page/actions)
must be checked for the exact commit being released, not an older green run.

## Handoff and scope

- [Configuration ownership and environment separation](docs/configuration.md)
- [Backups and isolated restore rehearsal](docs/backups.md)
- [Source/image release checks and remaining advisory](docs/security/release-review-2026-09-09.md)
- [Container design and lifecycle](docs/containers.md)
- [Statistics and query behavior](docs/statistics.md)
- [Private diagnostics versus public metrics](docs/observability.md)
- [Testing and recovery scenarios](docs/testing/e2e.md)
- [Release checklist and friend handoff](docs/release-checkpoint.md)
- [Roadmap](ROADMAP.md)

Before public hosting: select the platform, configure HTTPS/secure cookies and
private services, select production DB roles/secrets, verify backup/restore and
deploy/rollback, and review proxy/rate-limit behavior. Current NGINX DNS and the
collector's shared network namespace assume Docker-style networking.

Project showcases, accounts, Kubernetes and additional games are post-launch
work. Browser connection simulation affects only the visitor's tab; the app does
not expose public endpoints that can stop containers or the database.
