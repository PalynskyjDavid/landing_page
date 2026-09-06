# Development Workflow

## Supported local versions

- Go 1.26.1, as declared by `my-backend/go.mod`.
- Node.js 22.17.0, as declared by `.nvmrc`.
- Task 3.53.1.
- golangci-lint 2.13.1.
- Tern 2.4.3, pinned in `my-backend/tools/go.mod`.
- Prettier is installed through `frontend/package.json`.

Task and golangci-lint are developer-machine tools. Their executables are normally installed in the Go binary directory:

```powershell
go env GOPATH
```

On the current Windows machine that directory is `C:\Users\David\go\bin`. It must be present in `PATH` before `task` and `golangci-lint` can be invoked by name in a new terminal.

## Main commands

Run these from the repository root.

```powershell
task check
```

Runs the complete read-only quality gate in this order:

1. Backend and frontend formatting checks.
2. Go and JavaScript static analysis.
3. Go and frontend unit tests.
4. Go and frontend production builds.

The command reports problems but is not intended to rewrite source files.

```powershell
task format
```

Rewrites Go and frontend files with the configured formatters. Review the resulting Git diff before committing.

Individual groups can be run with:

```powershell
task format:check
task lint
task test
task build
```

More specific tasks are available through:

```powershell
task --list
```

## Local PostgreSQL and migrations

Docker Desktop must be running. The application itself still runs directly on
the host; Compose starts only the PostgreSQL dependency.

From the repository root, run:

```powershell
task db:setup
```

This command:

1. starts the `db` Compose service;
2. waits for its PostgreSQL health check;
3. runs all pending migrations with the pinned Tern tool.

The local database listens on `localhost:5454`. Keep `POSTGRES_PORT` and
`DATABASE_URL` consistent when overriding the values from `.env.example`.

Useful narrow commands are:

```powershell
task db:up
task db:status
task db:logs
task db:migrate
task db:migration:status
task db:stop
```

`task db:stop` preserves the named PostgreSQL volume. There is intentionally
no reset command yet because deleting the development database should be an
explicit action.

Create a migration skeleton with:

```powershell
task db:migration:new NAME=add_leaderboard_identity
```

Tern stores each migration in one numbered SQL file. SQL above
`---- create above / drop below ----` migrates forward; SQL below it rolls
that migration back. The backend does not migrate automatically at startup:
schema changes remain an explicit development and deployment step.

### Player-name synchronization (migration 006)

Run `task db:migrate` and restart the Go backend after pulling this slice: the
idempotency lookup now requires `submitted_display_name`. Deploy the migration
and backend together; an older running backend compares against the mutable name.

The migration preserves each score's original submitted name, then backfills all
scores for a player from that player's latest named score (`created_at`, then
`id`). Future inserts capture the original name in a BEFORE trigger and synchronize
the displayed name in an AFTER trigger. Only inserts trigger synchronization;
editing a row manually in pgAdmin is not a supported profile-update operation.
A blank name inherits an existing name, and a replay cannot change any names.

To inspect a player in pgAdmin:

```sql
SELECT id, player_id, display_name, submitted_display_name, created_at
FROM scores
WHERE player_id = '7106fc1f-c70d-4735-a14b-c013b96e5c84'
ORDER BY created_at, id;
```

Run the real PostgreSQL tests with the local database running:

```powershell
task backend:test:integration
```

These opt-in Go tests use `DATABASE_URL` from `.env`, create a randomly named
`score_names_test_...` schema, and remove only that schema during cleanup. They
do not migrate or change `public.scores` or the application's schema version.
The database role needs permission to create schemas. Tests cover backfill,
renames, blank names, player isolation, duplicate/conflicting retries, concurrent
inserts, and migration down/up. Rolling migration 006 down restores each score's
original submitted name; no scores are deleted.

The tradeoff is that a rename updates multiple score rows. For a larger app,
a separate players table joined by the leaderboard would avoid this duplication.
PostgreSQL's [trigger documentation](https://www.postgresql.org/docs/16/trigger-definition.html)
explains why the row-level AFTER trigger does not run for a skipped duplicate insert.

## Connection-loss demonstration

On the Game page, the **Reliability lab** provides **Simulate connection loss**
and **Restore connection** buttons. While enabled, the API client blocks this
tab's API calls (including readiness checks) and aborts any in-flight calls.
Requests already received by the server cannot be undone; score idempotency
handles a retry when the original response was lost.

The switch uses sessionStorage, so it survives refreshes in the same tab and
does not broadcast changes to other tabs. If sessionStorage is unavailable,
the panel reports that the switch cannot survive refresh. The score outbox
continues to use IndexedDB. Browser storage remains scoped to the frontend
origin; use the same browser profile and frontend address throughout the demo.

1. Start the backend, PostgreSQL and frontend, and open the Game page.
2. Click **Simulate connection loss**, play a game and click **Save score**.
3. Observe the retry popup followed by **Scores saved for later**.
4. Refresh: both the simulation banner and queued score should remain.
5. Click **Restore connection**. The app checks readiness, drains waiting scores,
   and refreshes its leaderboard queries. If the real API is unavailable, scores
   remain queued until it recovers.

The banner also offers Restore on other pages. This simulation does not change
Wi-Fi, Docker, the database, or the computer's internet connection. It tests the
client's recovery behavior; a real container outage remains a separate test.

## Tool responsibilities

- `.editorconfig` supplies basic encoding, newline, and indentation conventions to compatible editors.
- `gofmt` and `goimports`, run through golangci-lint, define Go formatting and import ordering.
- golangci-lint's `standard` set checks suspicious constructs, unchecked errors, ineffective assignments, static-analysis findings, and unused code.
- ESLint checks JavaScript and React code for correctness-oriented problems.
- Prettier owns frontend formatting. It does not replace ESLint.
- Task gives local development and future CI one shared command vocabulary.

## Manual-fix workflow

1. Run `task check`.
2. Read one category of findings.
3. Fix that category manually.
4. Run the narrow task for that category.
5. Review the Git diff.
6. Run `task check` before committing.

Do not run automatic dependency upgrades or broad `--fix` commands merely to make the check green. Findings should be understood before they are changed.

## Current scope

- The Go test suite is included.
- PostgreSQL startup and migrations are reproducible through Task and were
  verified from an empty database.
- Vitest runs frontend unit tests, including the IndexedDB score outbox and
  reliable-delivery state machine.
- CI has not been added yet.
- Vulnerability remediation is a separate reviewed task; dependency audit results are not automatically modified.

The production dependency audit currently reports no known vulnerabilities
after a targeted React Router update. Development-only audit findings remain a
separate review task and were not modified automatically.

## Baseline results (2026-08-27)

Passing checks:

- Go tests (`task backend:test`).
- Go compilation (`task backend:build`).
- Vite production build (`task frontend:build`).

Known findings intentionally left for manual work:

- Go formatting is inconsistent in 14 files, mostly because of line endings; `cmd/api/main.go` also needs import ordering and `repository.go` contains extra whitespace.
- Go lint reports one unnecessary struct literal conversion and two unused `statusRecorder` declarations.
- Prettier reports 17 frontend files that do not match the configured format.
- ESLint reports unused variables/imports in `ReactionGame.jsx` and `Shell.jsx`, plus React hook memoization/export findings in `ReactionProvider.jsx`.
- The frontend dependency install reports 11 audit findings (2 low and 9 high). These require a separate dependency review before any upgrades are applied.
