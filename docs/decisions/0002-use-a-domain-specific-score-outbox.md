# ADR 0002: Use a domain-specific outbox for reliable score delivery

- Status: Accepted
- Date: 2026-09-04
- Decision owners: David and Codex

## Context

The reliability demonstration must preserve a completed reaction score while
the API or PostgreSQL is temporarily unavailable. Retrying every failed request
independently would create unnecessary traffic, and a generic
`isQueueable: true` option could accidentally replay operations that are not
safe or meaningful later.

Score creation already has the prerequisite safety mechanism: every completed
game receives one client-generated `submissionId`, and the backend enforces
idempotent creation for that identifier.

## Decision

Reliable replay is implemented as a score-domain capability rather than a
generic API-client flag.

Before its first network attempt, a score submission is stored in an IndexedDB
outbox. The API client classifies whether a failure is temporary, while the
score-delivery service owns bounded retry, availability state, readiness
probing, and sequential outbox draining.

Temporary network, timeout, rate-limit, and server failures receive three
delayed retries. After those attempts are exhausted, the client stops sending
score commands and probes `GET /health/ready` approximately every 20 seconds
with jitter. It also probes on application startup, the browser `online`
event, and a manual retry action.

When readiness returns, pending scores are delivered oldest-first and one at a
time. The service stops draining on the first new temporary failure. Permanent
client errors are marked failed rather than retried indefinitely.

`GET /health/live` checks only the Go process. `GET /health/ready` checks
PostgreSQL with a bounded timeout. These endpoints may later also serve Docker,
load-balancer, and Kubernetes probes, but infrastructure deployment remains
deferred.

## Consequences

### Benefits

- A page refresh or browser restart does not discard a pending score.
- Repeated delivery is safe because every attempt reuses its original
  `submissionId`.
- An outage produces one readiness probe per browser rather than one retry loop
  per queued score.
- Queue policy remains close to the domain contract that makes replay safe.
- The delivery state machine and IndexedDB adapter can be tested independently
  from React components.

### Costs and risks

- IndexedDB adds asynchronous browser-storage lifecycle and failure cases.
- Anonymous identity remains browser-local; clearing cookies can cause a queued
  score to be delivered under a new anonymous player.
- Each browser still probes independently, so jitter and bounded polling remain
  important.
- Permanently failed records require a future inspection/removal experience.
- Multiple simultaneously open tabs are not yet coordinated by a leader lock.

## Rejected alternative

A generic `isQueueable` boolean on every API request was rejected. A boolean
does not describe idempotency, ordering, expiry, sensitive-data handling, or
how a permanent error should be resolved. Another domain operation may reuse
the outbox pattern later only after defining those rules explicitly.
