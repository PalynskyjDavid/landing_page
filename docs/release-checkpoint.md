# Game/statistics CI checkpoint

Date: 2026-09-09. Branch: `codex/backend-foundation`. `main` remains unchanged.

## Checkpoint result and next preparation slice

The subsequent backup/security slice is locally complete: read-only backups of
both local DBs, two isolated restorations with identical public tables/sequences,
and 102 passing Vitest tests plus the Go/quality gates. Full local-ref history and
shareable-tree scans have no unreviewed candidates after two exact false-positive
dispositions. API/collector image scans are clear; the minimized web image has no
high/critical findings and one documented medium BusyBox advisory matched to
three packages. See [backups](backups.md) and [the security review](security/release-review-2026-09-09.md).
The narrowed web image passed a read-only browser smoke test. The E2E ownership
guard was also corrected to accept API containers without the retired POSTGRES_*
variables while still requiring the exact test database URL and ownership labels.

Next: review/commit/push the accumulated local changes when requested and verify
all three CI jobs on that exact commit before friend handoff. Private backups,
scanner binaries/reports and image archives stay ignored. No deployment, history
rewrite, public credential testing or existing database reset was performed.

Hosted [CI run #5](https://github.com/PalynskyjDavid/landing_page/actions/runs/34346372439)
passed at commit `f300a4a4c8e412afe5bdab2f7d09a6b146dfd2b1`: quality/security in
2m, PostgreSQL in 1m28s, and full-container browser tests in 9m26s.
The sections below record the original pre-push review, not an assertion that
subsequent commits have already passed CI.

The next preparation slice adds a newcomer README and configuration guide,
retirements under ADR 0007, and explicit canonical development tasks. Reusable
backup/restore rehearsal and full-history/image scanning remain next; platform
selection and CD remain with David and his friend. No deployment or registry
publication is part of this cleanup.

Cleanup local verification (2026-09-09): `task check` passed (82 Vitest tests plus
Go tests/format/lint/build), and `task security:check` passed with the documented
unreachable Tern advisory. Compose validation and dry runs confirmed the normal
development path is database-only plus host Go/Vite. A separate temporary API
image/container started with only DATABASE_URL and explicit empty CORS_ORIGIN;
readiness, liveness, image healthcheck and disabled CORS were verified. The
temporary container was removed; original containers and database data were
untouched. The full E2E reset suite was not rerun in this cleanup, and these edits
have not yet been committed/pushed or hosted-tested. The fresh-clone `dev:setup`
path was dry-run, not executed against the existing development database.

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
