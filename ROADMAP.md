# Landing Page Development Roadmap

This roadmap is both the project TODO list and the working agreement for learning-oriented development.

Current focus (2026-09-09): finish the game/statistics release, then choose safe
hosting so David can share it with employers. Project showcase, Kubernetes and
additional minigames are post-launch work. The new `/statistics` page moves the
leaderboard out of the game, adds column/range/date/personal filters, groups by
player and charts player averages. Migration 007 supplies generated best scores
and measured indexes. Basic NGINX rate limits and persistent 429 cooldown protect
submission flow. See [the statistics guide](docs/statistics.md).

Release decision (2026-09-09): finish the source-control/CI checkpoint here.
David and his friend will choose PaaS/IaaS hosting and work on CD together.
Do not configure hosting, publish images or deploy infrastructure in this slice.

Checkpoint complete: [CI run #5](https://github.com/PalynskyjDavid/landing_page/actions/runs/34346372439)
passed for `f300a4a` on `codex/backend-foundation`; `main` is unchanged. Current
work is the pre-deployment repository/configuration cleanup, including retirement
of the two legacy backends explicitly requested by David. See the new root README,
[configuration guide](docs/configuration.md) and ADR 0007.

Backup and security preparation is now locally verified too. See
[backup/restore commands](docs/backups.md) and the
[source/image review](docs/security/release-review-2026-09-09.md). These changes
are not yet committed/pushed; the next slice is final review and hosted CI.

The System statistics tab adds anonymous API traffic/error/latency graphs.
Migration 008 and a separate Go collector persist bounded request summaries;
private Docker logs remain separate. See [observability](docs/observability.md)
and [ADR 0006](docs/decisions/0006-separate-request-logs-from-public-metrics.md).
This is best-effort telemetry, not uptime monitoring or an automatic restart system.

Release checklist:

- [x] Separate game and statistics routes; keep queued saves alive across navigation.
- [x] Server-side filters, player grouping, graph, summary and bounded Top N.
- [x] Query correctness and migration round trip against PostgreSQL; measure 100k games.
- [x] Edge rate limits, body bounds, Retry-After and reload-safe submission cooldown.
- [x] Finish final browser/quality verification and review this slice.
- [x] Add anonymous public request graphs with private logs, retention and outage buffering.
- [x] Commit/push the game/statistics checkpoint and verify all hosted CI jobs (`f300a4a`).
- [x] Add a root README, canonical host development tasks and clear environment ownership.
- [x] Retire the legacy backend source and default startup after checking active references.
- [x] Verify local cleanup: quality/security gates, setup guards, Compose/dry runs and a temporary API startup smoke test.
- [ ] Commit/push the cleanup when requested and check the new exact SHA in CI.
- [x] Add repeatable read-only backups and isolated restore/dump/restore verification.
- [x] Scan all local Git refs/shareable source and rebuild/scan all three app images.
- [ ] Review the remaining BusyBox medium advisory with the hosting owner and recheck before public release.
- [ ] With David and his friend, choose the PaaS/IaaS target, then prepare HTTPS,
  private services, secrets, backups and deploy/rollback. CD is deferred to that session.

Cleanup verification (2026-09-09): `task check` passed, including 82 Vitest tests
and Go configuration/contract tests; `task security:check` passed with the existing
non-reachable Tern advisory. Both Compose files validated and new development
tasks were dry-run. A separately built temporary API container passed readiness,
liveness and image health checks without POSTGRES_* variables; explicit empty
CORS was verified over HTTP. The container was removed afterward. Existing
containers, `.env` and data were not changed. Full reset-heavy E2E was not rerun
for this cleanup; its last hosted pass is the earlier `f300a4a` checkpoint.
These cleanup edits remain uncommitted/unpushed pending review.

Recovery/security verification (2026-09-09): read-only backups succeeded for both
existing DBs; the E2E archive restored with schema 8 and three scores, then matched
all public tables and sequence state after another dump/restore. Temporary offline
DB containers were removed. `task check` passed with 102 Vitest tests; dependency
checks passed with the documented unreachable Tern advisory. Gitleaks scanned 25
local-ref commits and the shareable tree: two exact historical false positives
were documented; no unreviewed candidates remain. Grype reported zero findings
for API/collector. Removing unused NGINX modules/curl removed high findings; three
medium package matches for one BusyBox CVE remain visible. The narrowed web image
passed a read-only Chromium smoke test. No existing services were replaced, no
source data reset, and no full E2E reset suite or hosted CI was run in this slice.

Game/statistics verification before the `f300a4a` checkpoint: `task check`, `task security:check`, API contract checks,
PostgreSQL integration tests and all fourteen browser scenarios passed (6.2 minutes).
The final dark-mode contrast assertions passed in a focused rerun. Quality checks
include 77 Vitest tests; telemetry/HTTP tests also passed twenty repetitions.
Standalone reset and web restart/collector reattachment passed. Manual E2E data
was restored and compared exactly with its backup before applying migration 008.
All four containers are healthy at `http://127.0.0.1:5188/statistics?view=system`;
the three original games remained, and development data was untouched. This was
subsequently committed/pushed at `f300a4a`; nothing was deployed. Detailed evidence
is in `docs/testing/e2e.md`.

Historical checkpoint (2026-09-08, now included in `f300a4a`): Dependency review is complete for the canonical app
and Tern. Targeted npm/Go updates and matching Node 22.23.2, Go 1.26.8 and NGINX
1.30.4 image pins resolved known npm and reachable Go findings. The router no
longer trusts caller-supplied IP headers. `task security:check` now runs locally
and in CI; Tern's one unused OpenPGP module advisory has a documented disposition.
Local checks passed: 67 Vitest tests, Go/contract tests, formatting/lint, builds,
PostgreSQL integration tests, all ten browser scenarios in about 3.5 minutes,
workflow lint, and a vulnerability scan of the actual Linux API executable.
The manual E2E database was backed up and restored with identical data/sequence
checksum. The ignored backup is `frontend/.e2e/manual-before-security-20260908.dump`.
The rebuilt manual stack is running at 5188. No development data, SQL migration,
machine-wide Node selection, registry or deployment changed. These and the earlier
Swagger/recovery/container changes remain uncommitted/unpushed; hosted verification
is pending. See [the review](docs/security/dependency-review-2026-09-08.md),
`docs/containers.md`, `docs/testing/e2e.md`, `docs/ci.md`, and ADR 0005.

## How we will work

- Codex now implements the next bounded roadmap slices by default, as David requested.
- Codex announces new concepts/tools or interesting design changes while working,
  so David can pause to inspect code or ask questions without following every edit.
- David can reserve any task for manual implementation; existing manual work is preserved.
- Before coding starts, we define the task, constraints, acceptance criteria, and relevant tests.
- Codex reviews the resulting diff and explains issues, tradeoffs, and possible improvements.
- Codex does not rewrite David's manual work unless explicitly asked to implement a fix.
- Large changes are split into reviewable tasks that can normally be completed in one focused session.
- At the end of each task, this roadmap is updated and the next one or two tasks are prepared.
- Deployment, spending, access changes, and destructive actions outside disposable
  test data require an explicit decision; development autonomy does not imply them.

### Ownership labels

- **David** — intended as a manual learning task.
- **Codex** — setup, repetitive infrastructure work, or work explicitly delegated to Codex.
- **Pair** — design together; David implements; Codex reviews and verifies.

Older ownership labels record the original learning plan; unless David reserves
a task, the implementation-first agreement above now applies.

### Current prepared slice: final Git/CI checkpoint and friend handoff

- **Outcome:** a reviewed release candidate that the friend can clone and evaluate.
- **Scope:** review the cleanup/retirement, backup tooling, image minimization and
  security evidence; commit/push when requested. Exclude all private backups,
  scan inputs/reports, binaries and image archives. Keep `main` unchanged.
- **Acceptance:** all three existing CI jobs pass for the new exact commit,
  including the complete browser suite on its own disposable database. An older
  green result or the local smoke test is not a substitute.
- **Then:** share the branch and README with the friend, review the residual
  advisory and choose platform-specific deployment settings. No extra game
  features before handoff.
- **Then, with David and his friend:** select the available PaaS/IaaS target and release method. Keep the
  existing container images, add immutable commit-based tags and image scanning,
  and verify backup/restore plus deploy/rollback before sharing a public link.
- **Deferred:** registry publication, paid hosting, TLS/secrets/deployment, and
  Kubernetes require separate decisions. No public container-control endpoint.

The pre-push review and handoff are described in [the release checkpoint](docs/release-checkpoint.md).
Hosted success is recorded on the matching commit's GitHub Actions run, not inferred
from local checks or an earlier green commit.

### Task lifecycle

1. **Plan** — define the outcome and acceptance criteria.
2. **Implement** — David or Codex writes the agreed code.
3. **Review** — inspect the diff and discuss design choices.
4. **Verify** — run relevant automated and manual checks.
5. **Document** — record decisions and update this roadmap.

## Dependency overview

```text
0. Protect baseline
        |
1. Product and architecture decisions
        |
2. Repository and local-development cleanup
        |
3. API and database contracts
        |
4. Frontend and backend quality foundations
        |
5. Feature redesign
        |
6. Integration and end-to-end tests
        |
7. Continuous Integration
        |
8. Build artifacts and deployment infrastructure
        |
9. Staging deployment
        |
10. Observability and security validation
        |
11. Production deployment and rollback
```

Stages can contain parallel tasks, but a stage should not be treated as complete until its exit criteria are satisfied.

## Stage 0 — Protect the baseline

### Goal

Make the current work recoverable and establish exactly what exists before restructuring anything.

### TODO

- [x] Locate the actual repository at `C:\git_projects\landing_page`. **Pair**
- [x] Identify current uncommitted and untracked work. **Codex**
- [x] Confirm `my-backend` is the newest Go iteration, while `backend-go` is the more feature-complete predecessor. **Codex**
- [x] Confirm the backend remains Go rather than NestJS/JavaScript. **David**
- [x] Review the current changes and separate intentional work from experiments. **Pair**
- [x] Make `my-backend` canonical and port only the required working features from `backend-go`. See ADR 0001. **Pair**
- [x] Checkpoint the current work before retiring either reference implementation. **Pair**
- [x] Create and push the `codex/pre-refactor-checkpoint` safety branch. **David**
- [x] Confirm `.env` is ignored and no obvious secrets are tracked. **Codex review**
- [x] Record commands that currently build and test each active component. Startup commands remain a Stage 2 task. **Pair**
- [x] Run the baseline checks and record known failures rather than fixing them silently. **Codex**

### Exit criteria

- All existing work is recoverable from Git.
- We know which changes are intentional.
- Baseline commands and known failures are documented.
- No architecture cleanup has begun prematurely.

## Stage 1 — Product and architecture decisions

### Goal

Agree on what the application is and select one maintainable technical direction.

### TODO

- [x] Write a short product statement: audience, purpose, and primary user journey. **David**
- [x] Define the initial portfolio, reaction-game, leaderboard, and reliability-lab journeys. **David**
- [ ] Decide whether analytics remains a developer page or becomes a product feature. **Pair**
- [x] Select `my-backend` as the canonical Go backend after comparing architectural quality and feature completeness. See ADR 0001. **Pair**
- [x] Reject NestJS as the production backend; Go is the learning and implementation language. **David**
- [x] Redesign required statistics, logging, Docker and migration behavior in `my-backend`; reject the old periodic stats worker (ADR 0007). **Codex**
- [x] Retire the unselected Go implementation after required behavior was redesigned and verified (ADR 0007). **Codex**
- [x] Remove the obsolete NestJS `backend`, preserving Git history (ADR 0007). **Codex**
- [x] Use on-demand game statistics and a separate bounded telemetry collector, not the old stats worker (ADRs 0006/0007). **Codex**
- [x] Defer authentication until business requirements justify it; use anonymous identity initially. **David**
- [x] Defer Kubernetes, microservices, and real infrastructure controls until later milestones. **David**
- [x] Start recording decisions as short Architecture Decision Records under `docs/decisions/`. **Pair**

### Exit criteria

- The app has a concise product definition.
- One backend is canonical.
- Major components and responsibilities are clear.
- Deferred features are explicitly recorded instead of partially implemented.

## Stage 2 — Repository and local-development cleanup

Depends on Stage 1.

- [ ] Agree on the target repository layout. **Pair**
- [x] Consolidate duplicate backends without deleting history. **Codex**
- [ ] Create one reliable local startup command. **Pair**
- [x] Document environment ownership and remove unused API credential requirements. **Codex**
- [x] Make database migrations reproducible with a pinned Tern tool and Task commands. **Pair**
- [ ] Add seed data for local development and tests. **David**
- [x] Add health and readiness checks. **Codex**
- [ ] Document setup, startup, shutdown, and reset procedures. **Pair**

## Stage 3 — API and database contracts

Depends on Stages 1 and 2.

- [ ] Define the supported score, statistics, and event use cases. **Pair**
- [x] Define leaderboard reads and anonymous player identity. **Pair**
- [x] Define client-generated idempotency keys and duplicate-submission behavior. **Pair**
- [x] Distinguish backend liveness from database-dependent readiness. See ADR 0002. **Pair**
- [ ] Specify API requests, responses, validation errors, and status codes. **David**
- [x] Introduce OpenAPI for implemented scores, leaderboard, and health endpoints;
  validate routes and real HTTP responses in `task api:check` and normal Go tests. **Codex**
- [x] Add development-only Swagger UI from that same contract, with a real health-request browser test. **Codex**
- [x] Establish the player cookie before saving a score; document direct-client compatibility and lost-response safety in ADR 0003. **Codex**
- [ ] Decide whether to generate Go server types and frontend client types. **Pair**
- [ ] Define migration ownership and compatibility rules. **Pair**
- [ ] Remove or implement orphaned frontend calls such as `/events`. **David**

The behavior guide is `docs/contracts/reaction-results-api.md`; the machine-readable
contract is `docs/contracts/openapi.yaml`. Deferred statistics/authentication/profile
features are not advertised as implemented endpoints.

The score-correctness slice now fixes a completed game at five rounds. The backend validates the five raw reaction times and derives both `totalRounds` and the rounded-down `averageMs`.

The result screen accepts an optional display name, remembers it locally in the browser, and stores the backend-trimmed value with the score. The backend now issues a long-lived anonymous player cookie, while each finished game receives a client-generated submission UUID for safe retries.

The first leaderboard read is defined and implemented with a default limit of 10, a maximum of 50, and safe two-level sorting by average time, best time, or misclicks in either best-first or worst-first direction. Creation time and score ID provide deterministic final tie-breaking. Pagination remains deferred.

The leaderboard UI now offers Top 5, Top 10, and Top 20 views. Each selection is sent to the backend as the existing `limit` query parameter; the browser does not truncate a larger result locally.

### Prepared next slice: reliable score delivery

- [x] Define the `submissionId` contract and the response for a repeated ID. **Pair**
- [x] Generate one UUID when a finished game becomes a score submission and reuse it for every attempt. **Codex**
- [x] Make score creation idempotent in the Go service and PostgreSQL repository. **Codex**
- [x] Add a small in-memory retry policy for retryable network, timeout, rate-limit, and server failures. **Codex**
- [x] Store still-pending score submissions in IndexedDB as a domain-specific outbox. See ADR 0002. **Codex**
- [x] Drain the outbox on application startup, the browser `online` event, and a manual retry action. **Codex**
- [x] Show queued, sending, saved, and permanently failed states without blocking a new game. **Codex**
- [x] Add dismissible delivery popups across pages for saving, retries, waiting scores, recovery, and completion; coalesce repeated health probes. **Codex**
- [x] Add per-tab connection-loss simulation and restore controls, with a persistent banner and recovery after refresh. **Codex**
- [x] Synchronize player display names using a migration and triggers, preserving original names for idempotent retries; add PostgreSQL integration coverage. **Codex**
- [x] Verify real backend and database outages, refresh persistence, automatic recovery, and exactly one saved row per submission. See the 2026-09-06 verification record. **Codex**

The score outbox is intentionally domain-specific. The API client identifies
temporary failures, but it does not accept a generic queueable boolean. New
operations may adopt durable replay only after their idempotency, ordering,
expiry, and permanent-failure behavior are defined.

## Stage 4 — Quality foundations

Frontend and backend work can proceed in parallel after Stage 2; contract-dependent tests also require Stage 3.

### Shared tooling

- [x] Add one read-only local quality command for formatting, linting, tests, and builds. **Codex setup**
- [x] Pin and document the initial Node.js, Task, golangci-lint, and Prettier versions. **Codex setup**
- [x] Resolve the baseline formatting findings in a separate formatting-only commit. **Codex, authorized by David**
- [x] Resolve the baseline lint findings; the complete local quality gate passes. **Pair**
- [x] Review dependency-audit findings, apply targeted fixes, document the unused OpenPGP advisory and verify the full stack. **Codex**

### Frontend

- [ ] Plan an incremental JavaScript-to-TypeScript migration. **Pair**
- [x] Add Vitest and outbox/delivery unit tests. **Codex**
- [ ] Add React Testing Library if selected for component-level tests. **Pair**
- [ ] Extract and test the reaction-game state machine. **David**
- [ ] Test API error, loading, empty, and success states. **David**
- [ ] Add automated accessibility checks. **Codex setup; David fixes findings**

### Backend

- [ ] Expand Go service and handler unit tests. **David**
- [x] Add PostgreSQL integration coverage for player names, retries, concurrency, and migration down/up. **Codex**
- [x] Add formatting, `go vet`, and lint checks. **Codex setup**
- [x] Test environment defaults/validation, health probes, in-flight request draining, and shutdown deadlines. **Codex**
- [x] Test migrations from an empty PostgreSQL database. **Pair**

## Stage 5 — Feature redesign

Depends on the contracts and safety nets from Stages 3 and 4.

- [ ] Redesign the landing-page content and navigation. **David**
- [ ] Add project showcase content to the home page. **David**
- [ ] Finish the reaction-game setup and result summary. **David**
- [x] Add score submission and leaderboard presentation. **Pair**
- [ ] Redesign analytics around useful questions rather than raw JSON. **Pair**
- [ ] Add responsive, keyboard, loading, offline, and failure behavior. **David**
- [ ] Add tests with each redesigned feature. **David**

## Stage 6 — Integration and end-to-end testing

Depends on a coherent full-stack feature flow from Stage 5.

- [x] Run the complete stack against an isolated PostgreSQL database for real-outage verification. **Codex**
- [x] Select Playwright for browser tests, alongside existing Vitest unit tests. **Pair**
- [x] Set up Playwright and verify isolated database setup/reset/cleanup and inspection mode. **Codex setup**
- [x] Add the first real browser scenario: play five rounds, save a named score, and reload the leaderboard. **Codex setup**
- [ ] Add a browser scenario for saving an anonymous score; review together. **David**
- [ ] Test playing a game, saving a score, and viewing updated analytics. **David**
- [x] Test that identical submissions reuse a score and changed data with the same UUID returns a conflict. **Pair**
- [x] Test that a queued score survives reload during simulated API loss and saves once after recovery. **Pair**
- [x] Test invalid API inputs, error codes, and absence of stored scores. **Pair**
- [x] Distinguish requested keep mode from successful setup and print database logs before failure cleanup. **Codex**
- [x] Wait for PostgreSQL TCP readiness and verify repeated empty-volume startup/migration cycles. **Codex**
- [x] Automate a real database outage: two games queue, survive reload, and save once each after restart. **Codex**
- [x] Drop cookie-only and committed-save HTTP responses and verify safe retry without duplicate rows. **Codex**
- [x] Verify Swagger UI serves the contract and executes a real health request using only local stack origins. **Codex**
- [x] Automate actual backend SIGTERM/SIGKILL and recovery after a new game/reload; verify one stored row. **Codex**
- [x] Restore stopped test services after a failed worker; verify with a deliberate-failure experiment. **Codex**
- [x] Define local production-image smoke tests for routes, assets, cookies, headers and proxy recovery; deployed smoke checks remain later work. **Codex**

## Stage 7 — Continuous Integration

The initial pipeline uses deterministic Stage 4 checks and PostgreSQL integration
tests. Browser automation from Stage 6 can be added afterward.

- [x] Add GitHub Actions for formatting, linting, tests, and builds. **Codex**
- [x] Configure a disposable PostgreSQL service for migrations and integration tests in CI. **Codex**
- [x] Push the branch and inspect the first successful GitHub-hosted run together; David reported success for `b7857ff`. **Pair**
- [x] Update setup-go and setup-task action pins to verified Node 24-compatible releases. **Codex**
- [x] Configure the Playwright CI job with seven-day report/failure artifact uploads; it discovers all ten current scenarios. **Codex**
- [x] Push the startup fix; David reported a successful hosted E2E run after the initial startup failure in run `34161440677`. Not independently inspected. **Pair**
- [ ] Inspect/download the hosted Playwright report together. **Pair**
- [ ] Commit/push the Swagger/cookie-recovery/container slices and verify the ten-scenario hosted run. **Pair**
- [x] Configure the existing E2E job to build/use the Go runtime image without publishing it; locally verified, hosted run pending. **Codex**
- [x] Build/test the production frontend runtime image without publishing it; hosted verification pending. **Codex**
- [ ] Protect the main branch with required checks. **David, repository settings**

## Stage 8 — Artifacts and deployment infrastructure

Depends on successful CI and the deployment decisions from Stage 1.

- [x] Create a pinned multi-stage Dockerfile for the canonical Go API and exercise it in isolated E2E tests. **Codex**
- [x] Create the frontend production multi-stage Dockerfile and same-origin NGINX proxy configuration; see ADR 0005. **Codex**
- [ ] Tag immutable images with the Git commit. **Codex setup**
- [ ] Publish images to GitHub Container Registry. **Pair**
- [ ] Choose and document the hosting model. **Pair**
- [ ] Define secrets, TLS, networking, database, and backup handling. **Pair**
- [ ] Create infrastructure as code where it improves reproducibility. **Pair**

## Stage 9 — Staging deployment

Depends on both artifact publishing and deployment infrastructure.

- [ ] Deploy successful `main` builds to staging. **Pair**
- [ ] Apply migrations safely. **David**
- [ ] Run health checks and smoke tests after deployment. **Pair**
- [ ] Prevent promotion when staging validation fails. **Codex setup**

## Stage 10 — Observability and security validation

Uses staging from Stage 9 as the proving environment.

- [x] Add private structured request logs and NGINX-to-Go correlation IDs. **Codex**
- [ ] Add frontend error reporting. **Pair**
- [x] Add bounded anonymous request/error/timing graphs with freshness and known-loss labels. **Codex**
- [ ] Add independent uptime checks and alerting after hosting is selected. **Pair**
- [x] Add current npm and reachable Go dependency/standard-library checks to local tasks and CI. **Codex**
- [ ] Add secret and container OS scanning; review PostgreSQL image freshness. **Codex setup**
- [ ] Test database backup and restore. **David**
- [ ] Review rate limits, CORS, and HTTP security headers. **Pair**

## Stage 11 — Production deployment and rollback

Depends on successful staging operation and observable failure modes.

- [ ] Require approval before production deployment. **Pair**
- [ ] Promote the exact artifact tested in staging. **Codex setup**
- [ ] Run production health checks and smoke tests. **Pair**
- [ ] Define application and database rollback procedures. **David**
- [ ] Tag releases and maintain a changelog. **David**

## Decisions still needed

- What exact projects and supporting links belong on the portfolio home page?
- Which features belong in the first complete release?
- What anonymous identity and display-name rules should the leaderboard use?
- Should the first reliability demo simulate failure in the application or control isolated containers?
- What deployment model should the project eventually teach?

## Review notes

Review findings and design discussions should be linked here or recorded in `docs/decisions/` once that directory is introduced. Completed checkboxes should only be marked after their exit condition or verification has been satisfied.
