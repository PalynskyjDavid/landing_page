# Landing Page Development Roadmap

This roadmap is both the project TODO list and the working agreement for learning-oriented development.

## How we will work

- David chooses which implementation tasks he wants to write manually.
- Before coding starts, we define the task, constraints, acceptance criteria, and relevant tests.
- Codex reviews the resulting diff and explains issues, tradeoffs, and possible improvements.
- Codex does not rewrite David's manual work unless explicitly asked to implement a fix.
- Large changes are split into reviewable tasks that can normally be completed in one focused session.
- At the end of each task, this roadmap is updated and the next one or two tasks are prepared.

### Ownership labels

- **David** — intended as a manual learning task.
- **Codex** — setup, repetitive infrastructure work, or work explicitly delegated to Codex.
- **Pair** — design together; David implements; Codex reviews and verifies.

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

## Current milestone: Stage 0 — Protect the baseline

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

## Next milestone preview: Stage 1 — Product and architecture decisions

### Goal

Agree on what the application is and select one maintainable technical direction.

### TODO

- [x] Write a short product statement: audience, purpose, and primary user journey. **David**
- [x] Define the initial portfolio, reaction-game, leaderboard, and reliability-lab journeys. **David**
- [ ] Decide whether analytics remains a developer page or becomes a product feature. **Pair**
- [x] Select `my-backend` as the canonical Go backend after comparing architectural quality and feature completeness. See ADR 0001. **Pair**
- [x] Reject NestJS as the production backend; Go is the learning and implementation language. **David**
- [ ] If `my-backend` is selected, port required stats, worker, logging, Docker, and migration tooling from `backend-go`. **Pair**
- [ ] Archive or remove the unselected Go implementation only after feature parity and verification. **Pair**
- [ ] Archive or remove the obsolete NestJS `backend` after the baseline checkpoint. **Pair**
- [ ] Decide whether the separate statistics worker is justified. **Pair**
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
- [ ] Consolidate or archive duplicate backends without deleting history. **Pair**
- [ ] Create one reliable local startup command. **Pair**
- [ ] Normalize environment-variable names and validation. **David**
- [x] Make database migrations reproducible with a pinned Tern tool and Task commands. **Pair**
- [ ] Add seed data for local development and tests. **David**
- [ ] Add health and readiness checks. **David**
- [ ] Document setup, startup, shutdown, and reset procedures. **Pair**

## Stage 3 — API and database contracts

Depends on Stages 1 and 2.

- [ ] Define the supported score, statistics, and event use cases. **Pair**
- [ ] Define leaderboard reads and anonymous player identity. **Pair**
- [ ] Define client-generated idempotency keys and duplicate-submission behavior. **Pair**
- [ ] Distinguish backend liveness from database-dependent readiness. **Pair**
- [ ] Specify API requests, responses, validation errors, and status codes. **David**
- [ ] Introduce an OpenAPI document. **David**
- [ ] Decide whether to generate Go server types and frontend client types. **Pair**
- [ ] Define migration ownership and compatibility rules. **Pair**
- [ ] Remove or implement orphaned frontend calls such as `/events`. **David**

The first draft contract is recorded in `docs/contracts/reaction-results-api.md`. It separates the currently implemented score submission from proposed leaderboard and identity changes; open decisions must be resolved before it is promoted to OpenAPI.

The score-correctness slice now fixes a completed game at five rounds. The backend validates the five raw reaction times and derives both `totalRounds` and the rounded-down `averageMs`; anonymous identity and idempotent retries remain deferred.

The result screen now accepts an optional display name, remembers it locally in the browser, and stores the backend-trimmed value with the score. Stable anonymous player identity is still a separate future decision.

## Stage 4 — Quality foundations

Frontend and backend work can proceed in parallel after Stage 2; contract-dependent tests also require Stage 3.

### Shared tooling

- [x] Add one read-only local quality command for formatting, linting, tests, and builds. **Codex setup**
- [x] Pin and document the initial Node.js, Task, golangci-lint, and Prettier versions. **Codex setup**
- [ ] Manually resolve the baseline formatting findings. **David; Codex reviews**
- [ ] Manually resolve the baseline lint findings. **David; Codex reviews**
- [ ] Review dependency-audit findings without applying an automatic bulk upgrade. **Pair**

### Frontend

- [ ] Plan an incremental JavaScript-to-TypeScript migration. **Pair**
- [ ] Add Vitest and React Testing Library. **David**
- [ ] Extract and test the reaction-game state machine. **David**
- [ ] Test API error, loading, empty, and success states. **David**
- [ ] Add automated accessibility checks. **Codex setup; David fixes findings**

### Backend

- [ ] Expand Go service and handler unit tests. **David**
- [ ] Add PostgreSQL repository integration tests. **David**
- [x] Add formatting, `go vet`, and lint checks. **Codex setup**
- [ ] Test configuration and graceful shutdown behavior. **David**
- [x] Test migrations from an empty PostgreSQL database. **Pair**

## Stage 5 — Feature redesign

Depends on the contracts and safety nets from Stages 3 and 4.

- [ ] Redesign the landing-page content and navigation. **David**
- [ ] Add project showcase content to the home page. **David**
- [ ] Finish the reaction-game setup and result summary. **David**
- [ ] Add score submission and leaderboard presentation. **David**
- [ ] Redesign analytics around useful questions rather than raw JSON. **Pair**
- [ ] Add responsive, keyboard, loading, offline, and failure behavior. **David**
- [ ] Add tests with each redesigned feature. **David**

## Stage 6 — Integration and end-to-end testing

Depends on a coherent full-stack feature flow from Stage 5.

- [ ] Run the complete stack against an isolated PostgreSQL database. **Codex setup**
- [ ] Add Playwright. **Codex setup**
- [ ] Test playing a game, saving a score, and viewing updated analytics. **David**
- [ ] Test that the same idempotency key cannot create duplicate scores. **David**
- [ ] Test a queued score submission across a controlled temporary outage. **David**
- [ ] Test validation, network failure, and unavailable-service behavior. **David**
- [ ] Define a small production smoke-test suite. **Pair**

## Stage 7 — Continuous Integration

Depends on deterministic checks from Stages 4 and 6.

- [ ] Add GitHub Actions for formatting, linting, tests, and builds. **Pair**
- [ ] Run PostgreSQL integration tests in CI. **David**
- [ ] Run the Playwright smoke suite in CI. **Pair**
- [ ] Build production Docker images without publishing them. **Codex setup**
- [ ] Protect the main branch with required checks. **David, repository settings**

## Stage 8 — Artifacts and deployment infrastructure

Depends on successful CI and the deployment decisions from Stage 1.

- [ ] Create production multi-stage Dockerfiles. **David**
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

- [ ] Add structured logs and request IDs. **David**
- [ ] Add frontend error reporting. **Pair**
- [ ] Add uptime and basic service metrics. **Pair**
- [ ] Add dependency, secret, and container scanning. **Codex setup**
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
