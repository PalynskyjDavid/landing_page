# System statistics: logs, metrics and the collector

Open `/statistics?view=system` on the containerized app. Game statistics remain
under the other tab. This is a public, anonymous traffic dashboard, **not a raw-log
viewer, security audit trail, uptime monitor or automatic restart system**.

## Follow one request

```text
Browser -> NGINX -> Go API -> PostgreSQL scores
             |
             +-> private JSON access log -> bounded Docker log files
             |
             +-> small UDP message -> Go collector -> request_metrics_minute
                                                        |
                          System statistics <- Go read API
```

NGINX is the observation point because it still sees requests when Go is stopped,
and rejects excessive requests before they reach Go. Counting only Go middleware
would miss both cases. Go also writes structured request logs for diagnosis, but
those logs are not counted again.

The new **collector** is a separate Go executable (`cmd/collector/main.go`), built
from the same module using the `collector` Dockerfile target. It receives NGINX
syslog datagrams on loopback UDP port 5514, groups them in memory, and flushes a
batch every five seconds. It has at most two database connections. The receiver
does not hold its mutex while the writer waits for PostgreSQL.

The collector shares web's network namespace (`network_mode: service:web`), like
a small sidecar. Its ingest port and HTTP liveness port 5515 are loopback-only:
there is no public write API, published collector port or Docker socket access.
Recreate it after restarting/recreating web; the Task lifecycle helpers do this.
Do not manually restart web alone and assume collection is still attached.

## What gets stored

Migration `008_request_metrics.sql` creates three separate tables. It does not
put operational counters into the old game `stats_summary` table.

| Table | Purpose |
| --- | --- |
| `request_metrics_minute` | UTC minute, route group, method group, counts and summed duration |
| `telemetry_batches` | Internal batch UUIDs preventing double counting on retry |
| `telemetry_collectors` | Internal process-instance UUID, last successful flush and known drops |

Route values are allowlisted: `/scores`, `/scores/leaderboard`, `/scores/statistics`,
or `<unmatched>`. Methods are GET, POST or OTHER. Random URLs cannot create an
unlimited number of metric keys. The database stores **no client IPs, raw paths,
query strings, request IDs, cookies, bodies, player IDs or display names** here.
Internal batch/collector UUIDs identify collection work, not visitors, and are
not returned by the public endpoint.

Only requests through NGINX's `/api` prefix are counted. Health endpoints and the
dashboard's own reads are excluded; otherwise polling would create its own
traffic. Static files, unknown paths outside `/api`, development Vite traffic and
the direct Go debugging port are not included. Private edge access logs can
still help diagnose those requests.

Minute buckets use **collector receipt time**, not a supplied browser timestamp.
Counts include requests, 4xx, 5xx, 404 and 429. Duration is NGINX request processing
time; it is not a measurement of the visitor's complete network round trip.
Average duration is `sum(duration) / sum(requests)`, not an average of averages.

## Reading and graphing

`GET /api/system/statistics?period=1h&route=/scores` is the proxied URL.
Go registers `/system/statistics`; NGINX removes `/api/` when proxying.
The [OpenAPI contract](contracts/openapi.yaml) documents this read-only endpoint.

The API accepts 1h, 24h or 7d and an optional allowlisted route. It combines
one-minute rows into minute, five-minute or hourly buckets. The response includes
the current partial bucket (at most 61, 289 or 169 points respectively), summary
totals, last collection time and known dropped-event count. No raw-log endpoint
exists. SQL values are bound parameters; reads have a two-second timeout.

The page refreshes every 15 seconds and preserves previous data while fetching.
It labels failed reads as stale and flags collection older than 30 seconds at
the server's report time. New traffic normally needs up to one flush plus a poll
to appear. Zero means **no requests recorded**, not proof that a service was up.
An empty bucket's average is shown as a dash in the table.

## Outages, retries and limits

- **Database down:** NGINX still serves the page and emits logs/metrics. The
  collector keeps receiving while its writer retries. The dashboard endpoint
  uses the same DB, so it returns a safe 503; already displayed data stays stale.
- **Database returns:** pending batches are retried. In one SQL transaction, the
  batch ID is inserted and counters added. If an acknowledgement was lost after
  commit, retrying that ID does not add the counts again.
- **Collector down/restarted:** the website still works. UDP delivery has no
  acknowledgement and the buffer is not durable. Missing datagrams and pending
  data lost with the process cannot be reconstructed by this implementation.
- **Bounded memory:** at most 120 pending batches (roughly ten minutes of continuous
  traffic at five-second intervals), and 128 current bucket keys. New events are
  discarded when full, with a known-drop counter. This counter cannot measure
  all UDP/process-loss gaps. Recovery attempts at most 20 batches per tick.
- **Retention:** hourly pruning keeps metrics for approximately seven days and
  dedup/process records for eight days; cleanup waits if DB/collector is down.
  Known drops refer to retained collector instances, not only the selected graph
  period/route. A quiet backlog can remain longer than ten minutes; the bound is
  batch count, not a durable time guarantee.
- **Shutdown:** allow up to two seconds for a final drain and log a warning if it
  cannot finish. SIGKILL cannot drain anything.

This intentionally small implementation is suitable for learning and portfolio
traffic, not lossless analytics. A durable collector queue or dedicated telemetry
service would be a separate decision if that becomes necessary.

## Private diagnostics

`task test:stack:logs` shows private web/API/collector/DB diagnostics. NGINX access
logs contain status, duration, a generated request ID, actual network peer address
and the first 160 characters of the normalized path; query strings, headers,
cookies and bodies are omitted. JSON escaping prevents user input adding fake
structured log entries. NGINX replaces incoming `X-Request-ID` before forwarding;
Go request logs use that ID and the matched route pattern for correlation.

**Treat Docker logs as sensitive.** Native NGINX error diagnostics may include
request URLs, and existing application/DB error messages may contain additional
details. The access-log format is not a universal redaction filter. Never put
secrets in URLs, expose Docker logs in the public statistics page, or upload
unreviewed production logs as CI artifacts. This test stack uses disposable data.

Compose rotates each service's JSON logs at 10 MB with three files. Its 1 MB
non-blocking logging buffer can drop output under pressure. Container removal
removes its logs; these are not a permanent archive. UDP collection does not
depend on reading these Docker files.

## Commands and a small experiment

With Docker Desktop running, `task test:stack:setup` builds all three app images,
migrates and starts four containers. **Setup resets disposable test data.**
Use `task test:stack:stop` / `task test:stack:up` to preserve existing data.

```powershell
Invoke-RestMethod http://127.0.0.1:5188/api/system/statistics?period=1h
task test:db:stop
# Play/save or request a nonexistent /api path while DB is down.
task test:db:up
# Wait for collection and the page's next poll.
task test:stack:logs
```

For collector code edits without resetting scores:

```powershell
task collector:image:build
task test:collector:up
```

`task test:collector:stop` demonstrates a collection gap, not an application
outage. `task test:web:up` reattaches a fresh collector to web. Standalone DB
reset temporarily stops a running collector so an old memory batch cannot
repopulate freshly reset statistics. Full E2E fixtures recreate it before every
test, not every `test.step`. Keep mode retains only PostgreSQL.

`task test:e2e -- system-statistics` exercises real DB/API outages, buffered
recovery, 404/429 counts, request-ID correlation, privacy and responsive UI.
Go tests check bounded parsing, duplicate batches, retention and migration down/up.

Before real hosting, use private service ports, HTTPS and deployment secrets,
separate least-privilege DB roles, log access/retention rules and external uptime
monitoring. No alerts, automatic service restarts, admin log browser, registry
publication or public deployment were added here.

References: [NGINX syslog](https://nginx.org/en/docs/syslog.html),
[NGINX access logging](https://nginx.org/en/docs/http/ngx_http_log_module.html),
[Docker JSON log rotation](https://docs.docker.com/engine/logging/drivers/json-file/).
