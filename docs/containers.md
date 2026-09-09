# Containerization: what we built and how it connects

Both the canonical Go backend and the production React frontend now have runtime
images, and the game E2E tests use them. PostgreSQL stays in its own container.
An additional small Go collector stores anonymous edge-request summaries; see
[observability](observability.md) and ADR 0006. Playwright stays on your computer
(or the GitHub runner); Vite is used only for
the development-only Swagger test and optional local hot reload.

Root `docker-compose.yml` is intentionally database-only for host Go/Vite
development. It no longer starts either retired backend. Use the
[README](../README.md) to choose between editing locally and the isolated
container demo below; neither Compose file is a production deployment template.

## Image versus container

An **image** is the built package: our executable, certificate files, and metadata
such as which command/user to run. A **container** is a running or stopped instance
of that image. Building an image does not start the app. Restarting a container
does not compile your latest edits. Rebuild and recreate it to run changed code.

PostgreSQL data lives in a **named volume**, separate from either image. Stopping
the API or DB does not delete that volume. Our explicit test cleanup deletes it.

## 1. Dockerfile: package the program

Read `my-backend/Dockerfile` from top to bottom:

1. `FROM golang:... AS build` starts a builder with the same Go version as go.mod.
   The readable tag names the version; the SHA-256 digest fixes the actual image.
2. `COPY go.mod go.sum` and `RUN go mod download` fetch dependencies. Docker can
   reuse this layer when you change application code but not dependency versions.
3. `COPY cmd/` and `COPY internal/` bring in the application. `.dockerignore`
   allowlists build inputs and excludes tests, `.env` files, and private-key files.
4. `go build` produces one Linux executable. `CGO_ENABLED=0` avoids depending on
   native C libraries; `-trimpath` removes build-machine paths and `-s -w` omits
   debug symbols. `GOTOOLCHAIN=local` makes a mismatched Go version fail explicitly.
5. `FROM scratch` begins a separate empty runtime stage. Only the executable and
   CA certificates are copied from the builder. The Go compiler/source are not
   carried into the final image. Certificates support verified outbound TLS.
6. `USER 65532:65532` runs without root. `ENTRYPOINT ["/app/api"]` starts the Go
   executable directly, so it receives Docker's stop signal without a shell wrapper.

The image does not contain database credentials. Compose supplies test values
at runtime. These disposable values are deliberately public; do not put production
secrets into the Dockerfile, build arguments, or this checked-in test configuration.
Runtime environment variables can still be inspected by someone with Docker access.

`EXPOSE 3001` documents the intended port; it does not publish a port to your PC.
That is Compose's job. Multi-stage builds are described in the
[Docker guide](https://docs.docker.com/build/building/multi-stage/).

## 2. Frontend: build with Node, serve with NGINX

Read `frontend/Dockerfile`, then `frontend/nginx.conf`:

1. The Node builder installs the exact lockfile (`npm ci`) and runs `vite build`.
   It produces `dist/`: HTML, CSS, and browser JavaScript. Node is a build tool here,
   not the production web server. The `.dockerignore` allowlist excludes `.env`,
   test data, dependencies from your PC, and private keys from the build context.
2. A separate pinned, unprivileged NGINX stage receives only `dist/` and our server
   configuration. It runs as UID 101 on port 8080, without Node/npm/source code.
   The root filesystem is read-only; NGINX's PID/temp files use a bounded `/tmp`
   memory filesystem. Logs go to Docker stdout/stderr. SIGQUIT drains requests.
3. The image uses `VITE_API_URL=/api` **at build time**. The browser combines this
   with the page's own origin; no developer-machine URL or database credential is
   included. Setting a VITE variable on an already-built container cannot rewrite
   JavaScript. See [Vite's environment guide](https://vite.dev/guide/env-and-mode).
4. NGINX serves `/` and falls back to `index.html` for React routes such as `/game`.
   Missing assets stay 404. Hashed assets are cacheable for a year; HTML must
   revalidate, so it can point to a new build. API responses are not stored.
5. `/api/scores` is forwarded to `http://api:3001/scores`. The trailing slash on
   `proxy_pass` removes the `/api/` prefix. Cookies and Go's status/error bodies
   pass through. NGINX-generated gateway failures become a retryable JSON 503.
   The proxy does not replay requests; our score outbox owns POST retry decisions.
6. Docker DNS is refreshed every five seconds so API replacement can be resolved
   without restarting web. `/healthz` checks only web; `/api/health/ready` also
   checks Go and its database. An API outage must not take the static game offline.
7. Per-connection-IP limits protect `/api/` reads and score writes. An excessive
   burst gets JSON 429 plus Retry-After; the browser preserves queued scores and
   waits. See [limits and their deployment boundaries](statistics.md#rate-limits-and-queued-scores).

All production browser requests now use one origin, so cross-origin CORS is not
needed for this path. The direct API port and old Vite workflow remain available.
Security headers limit browser resources/connections to this origin. This is a
local production-style artifact, **not a public production deployment**: test
credentials and HTTP remain unsuitable for public hosting. Basic rate limiting
now exists at NGINX, but direct Go access bypasses it; public hosting must keep
Go and PostgreSQL private.
TLS, secure cookies, backups, trusted-proxy configuration and full image scanning
were initially deferred. Local backup/restore rehearsal and app image scans are
now available: see [backups](backups.md) and the
[2026-09-09 release review](security/release-review-2026-09-09.md). TLS, proxy trust
and production backup arrangements still belong to the paired hosting session.
The [2026-09-08 dependency review](security/dependency-review-2026-09-08.md)
updated Node to 22.23.2, Go to 1.26.8 and NGINX to 1.30.4, with matching image
digests. Known npm and reachable Go findings were addressed; that is not a full
security audit. The backend now keeps the connection's actual peer address and
does not trust caller-supplied forwarding headers. Behind NGINX this is NGINX's
address, until an explicit trusted-proxy policy is introduced.

References: [unprivileged NGINX image](https://github.com/nginx/docker-nginx-unprivileged),
[proxy URI behavior](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass),
[dynamic upstream resolution](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server).

## 3. Compose: connect running services

`compose.e2e.yml` describes four services and one volume in `landing-page-e2e`:

| Caller | Address it uses | Destination |
| --- | --- | --- |
| Browser / Playwright | `http://127.0.0.1:5188` and `/api/...` | NGINX container port 8080 |
| NGINX container | `api:3001` | Go API container |
| Optional direct API / Vite | `http://127.0.0.1:3107` | API container port 3001 |
| API container | `db:5432` in `DATABASE_URL` | PostgreSQL container |
| NGINX | loopback UDP `127.0.0.1:5514` | Collector in web's shared network namespace |
| Collector | `db:5432` | PostgreSQL anonymous metrics tables |
| Host migration tool / pgAdmin | `127.0.0.1:5547` | PostgreSQL container port 5432 |
| Optional hot reload | `http://127.0.0.1:5187` | Vite on the host |
| Playwright's Swagger test only | `http://127.0.0.1:5197/docs` | Vite with a development `/api` proxy |

Inside the API container, `localhost` means **that API container**, not your PC
and not PostgreSQL. Compose provides the service name `db` on its network. This
is why the API connection string uses `db:5432`, while host migrations use port 5547.
The browser cannot use the internal name `db`; it uses published host addresses.

The port mapping `127.0.0.1:3107:3001` means host address : host port : container
port. Binding to 127.0.0.1 limits these test ports to the local computer.
The test credentials/origins are fixed rather than inherited from your main `.env`.

Compose also applies a read-only API filesystem, drops Linux capabilities, and
prevents gaining additional privileges. The API stores scores in PostgreSQL, so
it does not need writable application files or its own data volume.

## 4. Health, migrations, and shutdown are different concerns

- **DB health:** PostgreSQL accepts TCP connections. It does not say our tables exist.
- **Migrations:** the host runs the existing pinned Tern task against the test DB.
  The application does not secretly migrate/reset its own database at startup.
- **API readiness:** `/health/ready` can reach PostgreSQL; E2E startup waits for it.
  Docker runs `/app/api healthcheck`, whose small HTTP client exits nonzero unless
  readiness returns 200. `/health/live` only says the HTTP process responds.
- **Health status is not a restart command.** With `restart: "no"`, the test itself
  decides when to bring a stopped/crashed API back. Existing frontend readiness
  polling separately decides when to drain its outbox.
- **Graceful stop:** Docker sends SIGTERM. `main.go` cancels the signal context;
  `server.go` stops accepting connections and allows active requests up to ten
  seconds to finish. Then the database pool closes. Compose allows fifteen seconds.
- **Abrupt crash:** SIGKILL cannot be caught. PostgreSQL and its volume remain;
  the client retries its persisted submission UUID after the API returns.

Unit tests in `server_test.go` prove active requests drain and stuck requests are
closed after the deadline. `backend-recovery.spec.js` checks an actual container
exit code 0 after SIGTERM and 137 after SIGKILL, then verifies browser recovery.
It kills the API before clicking Save, not at a deterministic SQL instruction.
The separate lost-response scenario checks the case where the write did commit.

## 5. Task and JavaScript: repeat the workflow safely

`Taskfile.yml` is the command menu. `test-e2e.js` owns this sequence:

1. Acquire the shared E2E lock; remove the old collector and stop retained web/API.
2. Start PostgreSQL, wait for TCP health, apply migrations, reset baseline data.
3. Build/start API, web and collector images; wait for their health checks.
4. Launch Playwright against the web container; start Vite only for the Swagger test.
5. On failure, collect private web, API, collector and DB logs while containers exist.
6. In `finally`, stop/remove collector, web and API, remove DB unless keep mode is set,
   and release the lock. A machine shutdown / forced runner kill can interrupt cleanup.

`e2e/support/backend.js`, `web.js` and `collector.js` implement lifecycle commands. They reuse the lock,
explicit Compose file, and ownership checks in `database.js`; it cannot select an
arbitrary container. Database reset remains before each test, **not each step**.
The fixture also resumes stopped test services if an earlier worker failed before
it could restore them. Destructive fault injection stays in the main test sequence,
not an asynchronous network callback that could run after the test has finished.
Keep mode retains only DB data, not HTTP listeners or an always-running browser.

This is also what the existing GitHub Actions E2E job runs. It builds local images
on the runner but does not push it to a registry or deploy anything. An uncached
build costs extra download/compile time; Docker caching across CI runs is not yet configured.

## Commands to try

Docker Desktop must be running. From the repository root:

```powershell
task test:stack:setup
Invoke-RestMethod http://127.0.0.1:5188/api/health/ready
task test:stack:status
```

**Setup resets only disposable E2E data**, then migrates/builds/starts the stack.
Open `http://127.0.0.1:5188/game`; no separate npm/Vite command is needed.
For hot reload or Swagger, optionally run `task test:frontend` in another terminal
and use `http://127.0.0.1:5187/game` or `/docs` instead.
IndexedDB/localStorage are separate for each origin (including port): pending scores
on 5187 do not migrate to 5188. Reopen the original origin to deliver its old queue.
Cookies use host/path rather than port, so the local anonymous cookie may be shared.

```powershell
task test:api:stop
# Play/save while the API is down, then:
task test:api:up
```

Up resumes the API without rebuilding or resetting DB data. For edited Go code:

```powershell
task backend:image:build
task test:api:up
```

The image is rebuilt, and Compose recreates the API if its image changed. For the
whole existing stack use `test:stack:stop` / `test:stack:up` to pause/resume without
resetting data. Use `test:stack:logs` for diagnostics.

For edited React code or `nginx.conf`, rebuild/recreate only web, without a reset:

```powershell
task frontend:image:build
task test:web:up
```

```powershell
task test:e2e -- backend-recovery.spec.js
task test:e2e -- production-web.spec.js
task test:e2e
```

Playwright owns port 5197 for docs. A manual Vite process on 5187 can remain open,
but do not use it during E2E: it shares the same test DB, whose data the tests reset.
Manual lifecycle commands refuse to interfere while E2E holds the lock.

When finished inspecting, stop Vite with Ctrl+C and run:

```powershell
task test:stack:down
```

This removes the test web/API/DB/collector containers and **deletes disposable test data**. It
does not touch `events_db`. The built image and Docker build cache remain reusable.
No deployment, registry publication, or Kubernetes was added.

Decision records: [ADR 0004](decisions/0004-containerize-canonical-api-for-e2e.md)
and [ADR 0005](decisions/0005-production-frontend-and-same-origin-proxy.md).
References: [Dockerfile instructions](https://docs.docker.com/reference/dockerfile/)
and [Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/).
