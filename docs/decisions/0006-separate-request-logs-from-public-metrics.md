# ADR 0006: Separate private request logs from public aggregate metrics

Date: 2026-09-09. Status: accepted for the local portfolio stack.

## Context

We want useful public request graphs, visibility into API errors and unknown
paths, and a database-outage demonstration. Raw request records would expose
private data and make hostile traffic create unbounded rows. Logging synchronously
to the scores DB would also make diagnosis depend on the failing component.

## Decision

Keep bounded private Docker logs. Emit allowlisted NGINX request metadata via
loopback UDP to a separate Go collector sharing web's network namespace. Store
minute aggregates asynchronously in PostgreSQL, with bounded memory buffering,
batch-ID deduplication, retention and read-only public summaries. Do not count Go
logs too. Show freshness and known loss rather than presenting this as an audit
trail or uptime measurement. Implement no automatic restarts or raw-log endpoint.

## Consequences

NGINX observations include rate-limit/gateway errors even when Go is down.
PostgreSQL outages do not block the static app or log emission, but prevent fresh
dashboard reads. UDP/process failures may lose metrics. One extra small image
and lifecycle dependency are necessary; collector must be recreated after web
restarts. A durable queue or dedicated observability platform is deferred.

See [the implementation guide](../observability.md) for exact limits, privacy
boundaries, new files, commands and tests.
