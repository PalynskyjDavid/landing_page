# Game/statistics CI checkpoint

Date: 2026-09-09. Branch: `codex/backend-foundation`. `main` remains unchanged.

## Scope

Capture the accumulated, locally tested release candidate and verify its exact
commit in GitHub Actions. Hosting/CD will be done together with David's friend,
who has access to PaaS/IaaS. This checkpoint neither publishes images nor deploys.

The commit groups are:

1. Pinned Go/Node and frontend dependency updates, with lockfiles.
2. The integrated app: game/statistics pages, identity/retry fixes, OpenAPI,
   production-style container images, private metrics collector, tests and CI.
   These changes share the router, Taskfile, Compose, fixtures and contract, so
   they are one buildable feature checkpoint instead of artificial partial stages.
3. Architecture decisions, verification evidence, learning guides and this handoff.

The first two commits are `9204f1a` (dependencies) and `d6a7853` (the integrated
feature checkpoint). This documentation commit sits on top of them, so one branch
push triggers CI for the complete reviewed tree.

## Pre-push review

- Canonical backend remains `my-backend`; legacy backend folders are untouched.
- The source review covered bound SQL filters, request/queue limits, retry identity,
  cookie handling, public metric privacy and isolated test cleanup.
- Pending files were checked for binaries, unexpectedly large files and common
  credential/private-key patterns. No such findings were detected. This basic
  preflight is not a comprehensive secret scanner or historical security audit.
- `.env` variants, private keys, dumps, logs and coverage are excluded. Public
  `.env.example` and fixed disposable CI/E2E credentials remain intentionally
  versioned; they must never be reused for a public deployment.
- `task check` passed again: formatting, lint, Go/contract tests, 77 Vitest tests
  and builds. Current dependency checks run through `task security:check`.
- The preceding implementation passed PostgreSQL integration tests and all fourteen
  browser scenarios (6.2 minutes), plus a final focused dashboard test. See
  [the detailed evidence](testing/e2e.md#system-statistics-and-private-diagnostics-2026-09-09).
- This checkpoint's local quality checks do not reset the restored manual DB.
  GitHub tests use their own disposable databases on the runner.

## Hosted acceptance

Open [the branch's Actions runs](https://github.com/PalynskyjDavid/landing_page/actions?query=branch%3Acodex%2Fbackend-foundation).
Match the run's SHA to `git rev-parse HEAD`; an older successful run is not enough.
All three jobs must succeed: quality/security, PostgreSQL migrations/integration,
and the fourteen Playwright scenarios. Reports are retained for seven days.

This document is the pre-push snapshot. The final result and failure logs, if any,
are attached to the exact commit in Actions; no green result is predeclared here.
The workflow has read-only repository permissions and no CD job.

## Handoff for the later CD session

Before choosing a deployment configuration, agree with David and his friend on:

- The actual platform, image registry and support for multiple containers/sidecars.
- Managed PostgreSQL versus persistent database storage, backups and restore access.
- Domain/HTTPS termination, private service connectivity and production secrets.
- How migrations run once, how an image version is selected, and how to roll back.

Reuse the existing images and API contracts. Do **not** deploy `compose.e2e.yml`
unchanged: it has disposable credentials, reset-capable tooling and test-only host
ports. The production edge should be public; API, database and telemetry ingest
should stay private. See [containers](containers.md) and [observability](observability.md).
