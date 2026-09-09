# ADR 0004: Containerize the canonical Go API for E2E tests

- Status: Accepted
- Date: 2026-09-08
- Decision owners: David and Codex

## Context

The database was already containerized, but Playwright launched a host-built API
process. Testing real backend crashes needs ownership-aware process control that
behaves the same on Windows and Linux. We also need a build artifact suitable for
later deployment, while retaining the fast local development workflow.

## Decision

- Build `my-backend` with a multi-stage Dockerfile. Pin the existing Go 1.26.1
  builder by image digest; copy a statically linked executable and CA certificates
  into a non-root `scratch` runtime. No source code, shell, migrations, or `.env`.
- Use this image for **all** E2E scenarios, not a second optional execution mode.
  Keep Vite/Chromium on the host, and keep normal developer hot reload unchanged.
- Extend the existing `landing-page-e2e` Compose project with an `api` service.
  Use fixed disposable runtime configuration, loopback-only host ports, read-only
  filesystem, dropped capabilities, and no-new-privileges. No automatic restart
  policy: fault scenarios explicitly resume the container.
- Keep migrations explicit: the runner starts the DB, waits for TCP health,
  runs Tern/reset, builds the API, starts it, and waits for readiness before tests.
  Database readiness alone does not prove the schema is migrated.
- Reuse the test run lock and verify service/project labels and DB identity before
  operating on containers. The runner owns API shutdown, diagnostics, and cleanup;
  Playwright owns frontend startup and browser lifetime.
- Handle SIGTERM with a ten-second HTTP drain deadline and close the DB pool after
  the server finishes. Compose allows fifteen seconds before force-killing it.
  The executable's `healthcheck` subcommand probes readiness without curl/a shell.

## Consequences

- CI builds and exercises the runtime image using its existing E2E job. No image
  registry, deployment, paid service, public stop endpoint, or Kubernetes is added.
- Initial builds download the Go builder/dependencies; cached local builds are
  faster. Updating Go requires intentionally updating both go.mod and the Docker
  builder tag/digest. A pinned version is reproducible, not automatically secure.
- `KEEP_TEST_DB=true` retains only the final database state. The API is stopped and
  removed even in keep mode; images/build cache remain locally for reuse.
- Normal container stop preserves database data. Explicit test setup resets it;
  down removes only disposable test resources. Old development Compose services
  and the `events_db` volume are not migrated or removed in this slice.
- A browser test verifies graceful exit, then kills the actual API before clicking
  Save. IndexedDB survives a new game/reload and one row is saved after
  restart. Existing response-loss coverage handles the distinct committed-write /
  lost-response ambiguity. We do not claim a deterministic mid-SQL crash test.
- Keep container fault injection in the main test sequence, not asynchronous
  network callbacks. The fixture restores stopped services after failed workers
  before starting the next scenario, so an outage cannot cascade across the suite.
- Build provenance/scanning, cross-run CI image caching, image publishing, frontend
  containerization, production secrets/backup handling, and deployment remain later work.

## Follow-up: security maintenance (2026-09-08)

The builder and both Go modules now use Go 1.26.8; targeted module updates and
repeatable vulnerability checks are recorded in the
[dependency review](../security/dependency-review-2026-09-08.md). The architectural
decision above is unchanged. Full container OS scanning remains separate work.
