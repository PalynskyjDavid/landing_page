# Statistics and submission limits

## Using the app

Play at `/game`, then follow **View statistics and leaderboard**. The navigation
also opens `/statistics`; the old `/dev/analytics` URL redirects there.

Choose individual games or player groups. Filters include everyone/my scores,
last 7/30 days/all time/custom dates, literal player-name text, average/best
reaction ranges, misclick ranges, and minimum matching games per player.
Two sort columns and Top 5/10/20 remain available. Press **Apply filters** to send
one request for the complete selection. Reset clears it; Refresh rereads it.
Editing several fields does not send a request on every keystroke.

The server caps responses at 50 entries; the UI offers up to 20. A game's round
count is always five, so it is not a useful independent filter. Internal UUIDs are
not exposed as filter options or returned as player identities.

## What the numbers mean

1. Filter individual games, using their saved timestamp and measurements.
2. Optionally group those games by the anonymous player ID.
3. Exclude player groups below the minimum matching-game count.
4. Calculate the summary over all remaining games and rank/limit displayed rows.

For player groups, Average is the floored mean of the matching game averages,
Best is their fastest sample, and Misclicks/game is the arithmetic mean.
The game counts make it clear when a player average has little supporting data.
The chart shows the same limited player rows as the table, not every player.
The summary weights players by game count; it is not an average of player averages.
The summary's best game average is the best single matching game, not the best group.

Every game already contains five samples and its server-calculated, floored
average. Consequently these statistics aggregate stored game averages rather
than re-rounding all raw samples. Date periods are rolling 24-hour days based on
server time. Custom date controls use UTC and include the selected ending day;
the API's `to` timestamp is exclusive.

A single PostgreSQL statement supplies both summary and rows from the same
database snapshot. Pending filters cannot create independently inconsistent
chart/table/summary requests. Previous results may remain visibly stale during a
refresh. A successful score delivery invalidates the statistics query cache.

## Query design and measurements

The endpoint is `GET /scores/statistics`; see [OpenAPI](contracts/openapi.yaml).
The existing `GET /scores/leaderboard` remains compatible with older callers.

Migration 007 adds a stored, generated `best_ms` column and indexes for best-score
ordering and saved dates. PostgreSQL derives best_ms from the five samples;
neither the client nor Go supplies a second value that could drift.
Existing average-score and player/date indexes are retained.

Only a fixed allowlist supplies SQL sort fragments. Names, dates and numeric
values remain bound parameters. Queries are limited by a three-second context.
The planner can use separate paths for the limited ranking and whole-selection
summary. Grouping must still aggregate the relevant records; an index does not
make an unrestricted aggregate constant-time.

The integration suite creates 100,000 synthetic games and 1,000 players in an
owned temporary schema. Two 2026-09-09 local Windows/Docker runs measured these
approximate ranges (showing how timings vary even on the same machine):

| Query | Repository read | EXPLAIN execution |
| --- | ---: | ---: |
| All games | 50–144 ms | 52–169 ms |
| All player groups | 143–285 ms | 100–212 ms |
| Player groups, last 7 days | 6–13 ms | 4–9 ms |
| Combined date/name/number filters | 4–8 ms | 2–5 ms |

These are local, single-client samples, not a production latency promise or a
concurrency load test. The fixture disables name triggers only in its disposable
schema while generating already-consistent synthetic names, then reenables them.
The separate correctness tests exercise real insert/name behavior.

There is no new shared cache or precomputed aggregate table. TanStack Query keeps
responses in browser memory with the existing 30-second stale time; refresh and
successful score delivery invalidate them. Personal responses use private/no-store
HTTP caching. If hosted measurements require more, profile first and then consider
a bounded aggregate cache or materialized views with explicit freshness rules.
See [PostgreSQL's index-measurement guidance](https://www.postgresql.org/docs/16/indexes-examine.html).

## Rate limits and queued scores

NGINX applies these limits by the actual connection IP:

- All API requests: 5 requests/second with a burst allowance of 20.
- Score POST attempts: 12/minute with a burst allowance of 12.
- Request body: at most 8 KiB; Go enforces the same score-body limit.
- Invalid requests, cookie handshakes and idempotent retries count as attempts.

These are leaky-bucket limits, not exact calendar-minute counters. Browsers on the
same public IP share a quota. Cookie rotation and spoofed forwarding headers do
not create new buckets. Limits are in NGINX memory and reset on restart.
There is no distributed quota across multiple independent NGINX instances.
See the [NGINX rate-limit module](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html).

A rejection returns JSON code `rate_limited`, HTTP 429, and `Retry-After: 5`.
The outbox persists a not-before timestamp alongside the score, pauses the queue,
and displays a cooldown message. New games, manual retry, navigation and reload
do not bypass that timestamp. Afterward it retries the same submission; ordinary
database/API failures still use the readiness-recovery flow.
Read-query retries also respect Retry-After.
See [HTTP 429 and Retry-After](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429).

Important deployment boundary: the direct Go port 3107 and Vite debugging path
bypass NGINX. They are loopback-only local tools. A public deployment must expose
only the edge, keep Go/PostgreSQL private, configure HTTPS/secure cookies, and
revisit trusted ingress addresses if a CDN/load balancer is added.
Do not copy the test credentials into a public environment.

Rate limiting discourages flooding; it does not prove reaction measurements are
genuine, prevent every distributed attack, or turn an anonymous cookie into login
security. Client-reported scores remain explicitly unverified.

## Verification and next step

Run `task check`, `task backend:test:integration`, and `task test:e2e`.
The new browser cases cover filter/group/chart consistency and mobile layout,
actual edge limits despite cookie/header changes, and cooldown recovery.
The existing outage/idempotency scenarios now navigate to statistics.

Before test resets, the manual E2E database was backed up to ignored
`frontend/.e2e/manual-before-statistics-20260909.dump`. This is one-off preservation,
not a new automatic backup feature. Final runtime verification is recorded in
[the E2E log](testing/e2e.md).

Release scope is now the game, statistics and safe hosting. Project showcase,
Kubernetes and further minigames are post-launch work. Nothing in this slice
publishes the app, creates paid infrastructure, commits or pushes code.
