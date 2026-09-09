# Configuration ownership

Configuration is split by the process that consumes it. `.env` is a local
convenience, not a deployment secret store. Never commit real credentials or
put them into Docker build arguments or `VITE_*` values.

## Local development

Copy root `.env.example` to `.env` only on first setup. Do not overwrite an
existing file, especially if its database already contains data.

| Setting | Consumer | Meaning / default |
| --- | --- | --- |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Root Compose PostgreSQL | Required initialization values; only initialize an empty volume |
| `POSTGRES_PORT` | Root Compose | Host port, default `5454`, bound to loopback |
| `DATABASE_URL` | API, Tern; collector when explicitly supplied | Required connection string; never returned to the browser |
| `BACKEND_PORT` | API | Listener port, default `3001`, range 1–65535 |
| `COOKIE_SECURE` | API | `false` for local HTTP; use `true` for public HTTPS |
| `CORS_ORIGIN` | API | One exact HTTP(S) origin, default `http://localhost:5173`; empty disables cross-origin CORS middleware |
| `MAX_CONNS`, `MIN_CONNS` | API PostgreSQL pool | Defaults `10`, `1`; require `0 <= MIN_CONNS <= MAX_CONNS`, with MAX at least 1 |
| `MAX_CONN_LIFETIME`, `MAX_CONN_IDLE_TIME` | API PostgreSQL pool | Positive Go durations, default `3m`, `1m` |
| `VITE_API_URL` | Vite/browser bundle | Public API base URL, local default `http://localhost:3001`; production image fixes `/api` at build time |
| `VITE_API_PROXY_TARGET` | Vite dev server only | Optional target for the development `/api` proxy; not used by the production image |

The API no longer requires `POSTGRES_*`: its pool already reads credentials,
database name and TLS options from `DATABASE_URL`. Keep the root example's URL
consistent with the Compose initialization values. Percent-encode special
characters in URL usernames/passwords. The PostgreSQL driver validates/parses
the connection string when the pool is opened; config unit tests never connect.

An origin is only scheme + host + optional port: `http://localhost:5173`, not
`http://localhost:5173/game`, a trailing slash, wildcard, or comma-separated list.
For the same-origin NGINX deployment, an explicit empty `CORS_ORIGIN` is supported.
CORS is a browser policy, not authentication or protection from scripted requests.

The API loads `../.env`, then `.env`, relative to its **working directory**, without
overwriting process variables. `task backend:dev` runs in `my-backend`, so the root
file is found first. Task's database/migration tasks read root `.env`. Vite reads
its own `frontend/.env*` files; root `.env` is not a frontend configuration file.
The collector uses process `DATABASE_URL` directly and has a fixed two-connection
pool; API pool variables do not configure it.

Existing ignored `.env` files are not rewritten during repository cleanup. If yours
is old, compare its **keys** with the example: remove obsolete `APP_ENV`, `API_PORT`,
`LOG_LEVEL`, `STATS_UPDATE_INTERVAL_SECONDS`, `SHUTDOWN_TIMEOUT_SECONDS`,
`DATABASE_URL_DOCKER` and `CORS_ORIGIN_DOCKER`; keep one correct `CORS_ORIGIN`.
Do not blindly replace working database credentials with the sample ones.

## Disposable test environment

`compose.e2e.yml`, `frontend/e2e/compose.env` and `e2e/support/environment.js` define
fixed test identities, ports and ownership boundaries. API gets `DATABASE_URL`;
PostgreSQL still needs `POSTGRES_*`. The test tooling may also carry these fixed
values when provisioning the test stack. They are intentionally public, isolated
from the development database, and must never be reused for deployment.

`KEEP_TEST_DB=true` only retains disposable test data after an E2E run. It is not
a backup setting; the next setup/test reset discards that data.

## Deployment contract — finalize with the platform owner

- Supply a production `DATABASE_URL` via the platform's secret mechanism. Use the
  provider's verified TLS settings and certificates, not the local `sslmode=disable`.
- Use appropriately restricted DB roles for the API/collector; use a separate role
  for migrations. Test container users are not a production permission design.
- HTTPS belongs at the selected edge; set `COOKIE_SECURE=true`. Keep only the web
  entry public. Direct Go, PostgreSQL and collector ingest must remain private.
- NGINX currently resolves `api:3001` using Docker DNS `127.0.0.11`. The collector
  listens on web's shared loopback network. Confirm platform support or adapt both
  before selecting a deployment file; do not assume every PaaS supports sidecars.
- Set a trusted-proxy policy using the actual ingress addresses before relying on
  per-client rate limits behind a load balancer. Never trust arbitrary forwarded IPs.
- Migrations run explicitly before the compatible app version; the API does not
  migrate or reset a database at startup. Do not reuse test/reset wrappers for CD.
- Choose registry/version tags, health checks, backup retention/restore access and
  rollback procedure together. No production config or credentials are generated here.

References: [Task dotenv behavior](https://taskfile.dev/docs/guide#env-files),
[Vite environment handling](https://vite.dev/guide/env-and-mode), and
[NGINX trusted proxy configuration](https://nginx.org/en/docs/http/ngx_http_realip_module.html).
