# ADR 0001: Use `my-backend` as the canonical backend

- Status: Accepted
- Date: 2026-09-02
- Decision owners: David and Codex

## Context

The repository contains three backend implementations:

- `backend`, an older NestJS implementation;
- `backend-go`, an older Go implementation with more features and development tooling;
- `my-backend`, the newest Go implementation, with clearer feature-oriented boundaries and the tests currently being developed.

Maintaining all three as active implementations would make every API, database, test, and deployment change ambiguous. The project also exists for learning, so its main architecture should remain small enough to understand and explain.

## Decision

`my-backend` is the canonical backend for all new application work.

It will remain a Go modular monolith using PostgreSQL and HTTP/JSON. New backend features, fixes, tests, migrations, and API contracts will target `my-backend` unless another ADR explicitly changes this decision.

`backend-go` is a reference implementation. Useful capabilities such as statistics, structured logging, migration tooling, Docker configuration, and graceful shutdown may be ported selectively after their design is reviewed. They should not be copied automatically.

`backend` is an obsolete reference implementation. Neither older backend will be removed until the required behavior has been ported or deliberately rejected and the canonical backend has been verified.

PostgreSQL is the only supported database for the application. The SQLite repository placeholder is an educational example of substituting an implementation behind the `Repository` interface; it is not a commitment to support SQLite.

Authentication, Kubernetes, microservices, and real infrastructure controls remain deferred until the product behavior justifies them.

## Consequences

### Benefits

- Contributors have one place for new backend work.
- API and database contracts no longer need to accommodate competing implementations.
- The cleaner package structure can be developed incrementally and explained during interviews.
- Existing features in `backend-go` remain available as examples while missing behavior is rebuilt deliberately.

### Costs and risks

- `my-backend` does not yet have feature parity with `backend-go`.
- The current Compose services and migration workflow still point at or depend on the older implementation and must be updated.
- Keeping reference implementations temporarily makes the repository noisier until they can be archived.

## Follow-up work

1. Make PostgreSQL startup and migrations reproducible for `my-backend`.
2. Define the reaction-result and leaderboard API/database contracts.
3. Port or redesign only the required capabilities from `backend-go`.
4. Archive the older implementations after parity and verification.

