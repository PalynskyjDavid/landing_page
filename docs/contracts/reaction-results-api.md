# Reaction Results API Contract

- Status: Draft
- Date: 2026-09-02
- Canonical implementation: `my-backend`

## Purpose

This document is the shared boundary between the React frontend and Go backend for saving reaction-game results and reading a leaderboard. It lets either side build against agreed examples before the other side is complete.

This is a design contract, not yet an OpenAPI specification. Items marked **Open decision** must be agreed before the affected endpoint is stable.

## Existing score submission

### Request

```http
POST /scores
Content-Type: application/json
```

```json
{
  "totalRounds": 3,
  "times": [241, 228, 255],
  "missclicks": 1,
  "averageMs": 241,
  "sessionId": "local-session-id"
}
```

The current implementation applies these rules:

- `totalRounds` must be greater than zero.
- `times` must contain exactly `totalRounds` positive integer values in milliseconds.
- `missclicks` must be zero or greater.
- `averageMs` must be greater than zero.
- `sessionId` is optional; surrounding whitespace is removed and an empty value becomes `null`.
- Unknown JSON fields are rejected.

`averageMs` is currently supplied by the client and only checked for being positive. This is transitional behavior, not a guarantee that the final contract trusts it.

### Success response

```http
HTTP/1.1 201 Created
Content-Type: application/json
```

```json
{
  "id": 42,
  "createdAt": "2026-09-02T14:30:00Z"
}
```

### Error response

```json
{
  "error": {
    "code": "score_times_mismatch",
    "message": "times length must match totalRounds."
  }
}
```

| HTTP status | Code | Condition |
| --- | --- | --- |
| `400` | `invalid_json` | Body cannot be decoded or contains an unknown field. |
| `400` | `score_invalid_total_rounds` | `totalRounds` is not positive. |
| `400` | `score_missing_times` | `times` is empty. |
| `400` | `score_times_mismatch` | Number of times differs from `totalRounds`. |
| `400` | `score_invalid_time` | A reaction time is not positive. |
| `400` | `score_invalid_missclicks` | `missclicks` is negative. |
| `400` | `score_invalid_average_ms` | `averageMs` is not positive. |

Unexpected failures use status `500`, code `internal_error`, and do not expose internal details.

## Proposed stable submission contract

Before expanding the handler, agree on these changes:

1. The server calculates `averageMs` from `times`; the client does not send it.
2. The client sends an anonymous player identifier and optional display name.
3. A later reliability release adds a client-generated idempotency key with a database uniqueness constraint.
4. Upper bounds are defined for round count, reaction time, display-name length, and request size.

**Open decision:** whether anonymous identity belongs in the body or is supplied through a separate browser/session mechanism.

**Open decision:** whether idempotency is included in the first leaderboard schema now, even though offline retry is a later feature.

## Proposed leaderboard read

The next endpoint will conceptually be:

```http
GET /scores/leaderboard?limit=10
```

A candidate response shape is:

```json
{
  "entries": [
    {
      "rank": 1,
      "scoreId": 42,
      "displayName": "Anonymous Fox",
      "averageMs": 241,
      "bestMs": 228,
      "totalRounds": 3,
      "missclicks": 1,
      "createdAt": "2026-09-02T14:30:00Z"
    }
  ]
}
```

**Open decision:** rank by lowest average reaction time, lowest individual time, or a score that also penalizes misclicks. The query and index depend on this choice.

**Open decision:** define the default and maximum `limit`, tie-breaking order, and whether pagination is needed in the first release.

## Contract-first implementation sequence

1. Agree on the open product decisions and concrete JSON examples.
2. Convert this document into an OpenAPI document with reusable schemas and errors.
3. Add handler contract tests using HTTP requests without PostgreSQL.
4. Define the service and repository operations required by the contract.
5. Design and migrate the PostgreSQL schema and indexes.
6. Add repository integration tests against an empty migrated PostgreSQL database.
7. Implement the frontend against the agreed contract.

Dependencies point inward: HTTP handlers depend on service contracts, services depend on repository interfaces, and PostgreSQL implements those interfaces. Tests can substitute fakes at either boundary while unfinished layers are developed.
