# backend-go

Go backend for score writes, aggregated stats reads, and periodic stats refresh.

## Endpoints

- `GET /health`
- `POST /scores`
- `GET /stats/summary`

## Layout

- `cmd/api` API startup and wiring
- `cmd/worker` stats worker startup and wiring
- `internal/apperror` application error model
- `internal/database/postgres` Postgres bootstrap
- `internal/platform/http` shared router and HTTP helpers
- `internal/reaction` shared reaction-game domain types
- `internal/reaction/results` result write domain
- `internal/reaction/stats` stats read and aggregation domain

## Env

- `APP_ENV`
- `API_PORT`
- `DATABASE_URL`
- `LOG_LEVEL`
- `STATS_UPDATE_INTERVAL_SECONDS`
- `CORS_ORIGIN`
- `SHUTDOWN_TIMEOUT_SECONDS`

## Local commands

```bash
go run ./cmd/api
go run ./cmd/worker
go test ./...
```

## Migrations with tern

Install tern:

```bash
go install github.com/jackc/tern/v2@latest
```

Run migrations:

```bash
tern migrate
```
