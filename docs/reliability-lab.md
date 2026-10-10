# Reliability lab: real, bounded container outages

This is an **opt-in local demo**, not a control API on palyndav.dev. It runs a
second API and database with disposable data. Never expose this controller using
a public tunnel or put a Docker socket in the public application.

## Run it

From the repository root, with Docker Desktop/Linux containers running and the
normal Node/Go/Task dependencies installed:

```powershell
npm ci --prefix frontend   # only when dependencies are not installed/current
task lab:setup
task lab:serve
```

Open <http://127.0.0.1:5196/statistics?view=reliability>. Container controls now live
in **Statistics → Reliability lab**, not on the game page. Keep the controller terminal open.
This uses the **built** frontend, not Vite hot reload. Run setup again after edits;
stop the controller before rebuilding/updating the stack. Setup applies pending
migrations but does not reset scores or limits.

1. Keep the existing browser-only connection simulation **off**.
2. Click **Stop for 30 seconds** on API or Database.
3. Open the **Play a game** link in another tab and save a score. It should remain queued.
4. Leave the page open, start another game, or refresh. The queue survives.
5. Wait for recovery, or click **Start now**. The existing readiness poll notices
   recovery (normally around 20 seconds between polls), then replays saved scores
   with their original submission IDs. A recovered service does not imply an
   instant browser retry.

Manual Stop also provides Start now, but has a **60-second maximum reservation**.
There is no indefinite stop option, arbitrary duration, container ID or command.

When finished: Ctrl+C in the controller terminal, then `task lab:stop` in another
terminal. Both the demo database and limiter state are kept. `task lab:status`
shows the dedicated containers.

## Shared limits

| Rule                | Scope                                          |
| ------------------- | ---------------------------------------------- |
| One active outage   | API and DB combined, across every browser/tab  |
| Three stop attempts | Rolling 10-minute window                       |
| 90 reserved seconds | Same rolling window; timed = 30, manual = 60   |
| 30-second cooldown  | Begins after both services are healthy again   |
| Recovery            | Never denied for budget or cooldown exhaustion |

The **entire maximum duration is reserved before stopping Docker**. An early Start
or failed/uncertain stop does not refund it. Thus one manual + one timed stop uses
90 seconds; three timed stops also use 90 seconds. A rejected stop doesn't consume
a reservation. Polling is observational, not another stop attempt.

The durable state (`.lab/controller.json`, ignored by Git) lives outside the
database that can be stopped. It is atomically replaced before side effects.
Missing state is initialized only on first use; corrupt state is not silently
reset: the controller attempts to start both services and refuses to run.
Do not delete this file to work around a budget or while an outage is active.

## How the pieces connect

```text
Browser (127.0.0.1:5196)
  ├─ built frontend + /lab-api/* → independent Go controller on the host
  │                              ├─ durable limiter + recovery ticker
  │                              └─ Docker CLI → allowlisted lab API or lab DB
  └─ /api/* → proxy → lab API (127.0.0.1:3117) → lab PostgreSQL
```

The controller is `my-backend/cmd/lab-controller`, not a route inside `cmd/api`.
It acquires the fixed loopback listening socket before loading state, allowing
only one controller instance. The browser never receives Docker privileges.

`compose.lab.yml` creates project `landing-page-lab` and volume
`landing-page-lab_data`. It has fixed, disposable credentials, no database host
port, bounded logs/resources, and no production/external network or volume.
The controller checks Compose/service/demo labels, database settings, volume and
network ownership before using a validated container ID. It cannot stop itself,
the web server, production, E2E, or arbitrary containers.

Only the controller injects an HTML marker that enables the controls. Normal
production pages neither display them nor poll their API. The separate browser
origin isolates IndexedDB/localStorage. **Cookies are not port-scoped**, so the
proxy translates a separate `lab_reaction_player_id` cookie as well.

Host/Origin checks reject foreign origins and DNS-rebinding hosts; commands are
small, validated JSON, with no CORS allowance. Requests have bounded timeouts and
concurrency. These are local guardrails, **not public authentication or a complete
Internet-facing abuse defence**.

## Controller API contract

- `GET /lab-api/health`: cached five-minute history of `/health/live` and
  `/health/ready` probes, with HTTP status and time to response headers (ms).
  Status 0 and null latency mean no HTTP response, never a zero-ms success.

- `GET /lab-api/status`: cached service health, server time, outage/deadline,
  remaining eligibility, shared usage, cooldown and the last 20 lifecycle events.
- `POST /lab-api/commands`:

```json
{ "action": "stop", "service": "api", "mode": "timed" }
```

`service` is `api` or `db`; stop mode is `timed` (30 s) or `manual` (60 s).
Start is `{"action":"start","service":"api"}`, with no mode.
There is no queue/retry policy on this client: if a response is uncertain, refresh
status rather than blindly retrying a destructive command.

Responses: 200 accepted/completed command; 400 invalid command; 403 wrong
Host/Origin; 409 active outage/concurrent command; 429 shared budget/cooldown
(`Retry-After` included); 503 unavailable storage/Docker/services. Status includes
`recovering` until **both** services are healthy. A successful Start response does
not guarantee that readiness has finished.

## Recovery guarantees and limits

### Reading the health dashboard

The controller samples both fixed loopback health endpoints concurrently every
two seconds, with a two-second request timeout and no redirects. One sampler
serves every browser: opening more tabs only reads its cache. Its own lock and
background loop are separate from Docker commands and the recovery ticker.

- **API liveness** shows whether the process responds successfully.
- **Ready to save scores** includes the API's database check. A stopped database
  can leave liveness green while readiness returns HTTP 503.
- **Database** in the dependency diagram uses cached Docker health, not a browser
  database connection. Unknown/stale readings are not shown as healthy.
- Response times are controller-to-API **header latency**, including HTTP error
  responses, not end-user latency. Missing responses leave gaps in the line.
- The percentage is successful readiness **samples**, not a time-weighted uptime
  or SLA. Grey space means no measurements; history is never backfilled.

History is capped at 151 samples / five minutes and lives in controller memory.
It survives browser navigation and refresh, but restarts empty with the controller.
The limiter state remains durable and independent. No health measurements are
written to the application database. A text table exposes the latest ten samples.
The existing lifecycle event log below the controls records stops and recovery.

### Recovery behavior

A host-owned 2-second ticker initiates restoration at the deadline even if the
browser is closed, the API is unavailable or PostgreSQL is down. Docker operations
are bounded; a service becoming healthy may take longer than the displayed
30/60-second deadline. The deadline is a **start-attempt deadline**, not a promise
that health is restored at that exact second.

Failed start attempts retain the durable lease, block new outages and are retried
by the ticker. A controller restart immediately restores any recorded outage.
Graceful shutdown also attempts restoration.

**A hard-killed controller or stopped Docker daemon cannot execute its timer.**
Start Docker and rerun `task lab:serve` to recover. If the state is corrupt or
the controller cannot run, `task lab:setup` starts this isolated stack again
without deleting data. Investigate the state-file error before re-enabling
controls; do not silently clear the budget.

The lab is not a general service supervisor: containers stopped outside the
controller are not assigned a lease. Use Start now or setup to restore them.
The container restart policy is deliberately `no`; this demo's recorded deadlines,
not Docker's restart policy, control recovery.

## Verification and next slice

Statistics dashboard update (2026-10-03): `task check` passed, including 180
frontend tests and the Go monitor/HTTP tests. The real lab smoke passed with the
controls on Statistics and gameplay in another tab: API outage, DB readiness
failure, recovery, refresh-persistent history, stale-monitor handling and narrow
mobile layout. Six focused Statistics/system-statistics/localization browser
scenarios also passed. Normal pages do not display or poll the lab.

The health monitor is independent of the application's existing traffic statistics;
no production deployment or public monitoring has been enabled by this update.

Verified locally on 2026-10-03:

- `task check` passed: formatting, lint, Go tests, 175 frontend tests, both
  builds, 13 production safeguards and 3 lab-boundary checks.
- `task lab:test:smoke` passed against real Docker containers: timed API
  recovery, queued-score replay after a new game/reload with exactly one DB
  row, manual DB recovery, shared limits, cookie isolation and EN/CZ mobile layout.
- All 33 existing browser scenarios passed (10.6 minutes).
- Controller restart retained the 2-stop/90-second allowance. Eight concurrent
  Start requests succeeded without refunding it. The next run waited for the
  rolling window to expire naturally, without clearing state.
- Go regression tests cover the 60-second manual safety timer, restart recovery,
  persistence failure, concurrent commands and readiness-gated recovery. They
  were also repeated ten times. The optional Go race-detector run was unavailable
  in this Windows environment because CGO is disabled and no C compiler is on PATH.

The real test found and fixed a race between manual Start and health inspection:
recovery now waits for the current operation; simultaneous stop commands are
still rejected. Controller unit tests preserve this regression case.

After verification the lab was stopped without deleting its data or limits.
The ordinary E2E runner removed only its own disposable resources.

- `task check` includes Go limiter/storage/HTTP/ownership tests, frontend client
  tests and static lab isolation checks.
- `task lab:test:smoke` requires setup + a running controller and enough available
  allowance for one timed and one manual stop (90 reserved seconds). It checks real API and DB outages/recovery,
  durable score replay after refresh, shared limits and mobile EN/CZ layout.
  It never resets the budget; wait 10 minutes if the allowance is exhausted.
  The test creates clearly labelled demo scores and keeps them for inspection.

Before making this public, choose a **separate demo host**, add authentication or
an explicitly reviewed public-use policy, an independent recovery watchdog,
operator alerts, durable single-writer state management and tighter HTTP abuse
controls. Do not point these controls at the production leaderboard database.
