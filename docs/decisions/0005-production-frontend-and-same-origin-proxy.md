# ADR 0005: Production frontend image and same-origin API proxy

- Status: Accepted
- Date: 2026-09-08
- Decision owners: David and Codex
- Supersedes ADR 0004 only where it keeps the game frontend on host Vite.

## Context

Go and PostgreSQL already run in E2E containers, but testing only Vite does not
exercise the shipped JavaScript, static routing, caching or reverse proxy. We
need a production-style artifact while retaining a fast learning/development loop.

## Decision

- Build React in a pinned Node 22.17.0 builder matching `.nvmrc`; copy only the
  output into a pinned unprivileged NGINX 1.28.2 runtime. Exclude `.env` and test
  data from the Docker context. No Node process or database secrets in runtime.
- Set the public API base to `/api` at build time. Serve pages and API calls on
  one browser origin. NGINX strips `/api/` before forwarding to Go; cookie and
  application error semantics remain unchanged. Keep hot reload on port 5187 and
  direct API diagnostics on 3107; packaged web uses 5188.
- Let React handle page routes, but return 404 for missing assets and hidden dev
  tooling. Cache fingerprinted assets, revalidate HTML, and do not store API
  responses. Set browser security headers without promising a full security audit.
- Use Docker DNS with dynamic upstream resolution. The proxy does not retry
  requests. NGINX-generated gateway errors become JSON 503, while Go responses
  pass through untouched. Web liveness is independent of backend readiness.
- All game browser tests use the production container. Swagger remains on a
  dedicated host Vite server (5197) with a same-origin development proxy. It is
  neither copied into the web image nor publicly exposed there.
- Reuse the isolated Compose project, ownership guards and run lock. Start DB,
  migrate/reset, start API, start web, then run Playwright. Collect all service
  logs on failure. Keep mode retains only PostgreSQL; clean up both HTTP services.

## Consequences

- CI exercises both artifacts through its existing job, without registry writes,
  deployment, paid infrastructure, secrets, migrations or Kubernetes changes.
- Browser tests check production routes/assets/cookies, hardened runtime, actual
  API removal/replacement with the same web container, and existing outage/lost
  response recovery through the proxy. Replacement may reuse Docker's old IP;
  that test does not guarantee the IP changed.
- Changes to React or NGINX require a rebuild/recreate; normal Vite hot reload
  remains available. Runtime `VITE_*` variables cannot modify precompiled JS.
- Browser storage is origin-specific: queues on 5187 stay there, not on 5188.
- The checked-in stack is local-only test infrastructure. HTTP, fixed disposable
  credentials and dependency-audit findings prevent treating it as public hosting.
  TLS/secure cookies, dependency and image scanning, backups, image tags and
  deployment require later work. Image digests pin content, not security freshness.

## Follow-up: security maintenance (2026-09-08)

Node 22.23.2 and unprivileged NGINX 1.30.4 replace the initial base versions, with
new verified digests. The ten npm findings were addressed with targeted updates;
see the [dependency review](../security/dependency-review-2026-09-08.md). The
same-origin proxy design remains unchanged. The local HTTP/test-credential stack
is still not a public deployment.
