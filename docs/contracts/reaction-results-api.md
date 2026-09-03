# Reaction Results API Contract

- Status: Draft
- Date: 2026-09-03
- Canonical implementation: `my-backend`

## Purpose

This document is the shared boundary between the React frontend and Go backend for saving reaction-game results and reading a leaderboard. It lets either side build against agreed examples before the other side is complete.

This is a design contract, not yet an OpenAPI specification. Items marked **Open decision** must be agreed before the affected endpoint is stable.

## Score submission

### Request

```http
POST /scores
Content-Type: application/json
```

```json
{
  "times": [241, 228, 255, 249, 235],
  "missclicks": 1,
  "sessionId": "local-session-id",
  "displayName": "David"
}
```

The implementation applies these rules:

- `times` must contain exactly five positive integer values in milliseconds.
- `missclicks` must be zero or greater.
- `sessionId` is optional; surrounding whitespace is removed and an empty value becomes `null`.
- `displayName` is optional; it is trimmed, an empty value becomes `null`, and its maximum length is 24 characters.
- Unknown JSON fields are rejected.

The client does not send `totalRounds` or `averageMs`. The service derives a round count of five and calculates the average from `times` using integer division, which rounds a positive fractional result down. For example, a sum of `1208` divided by `5` is stored as `241`.

### Success response

```http
HTTP/1.1 201 Created
Content-Type: application/json
```

```json
{
  "id": 42,
  "totalRounds": 5,
  "averageMs": 241,
  "displayName": "David",
  "createdAt": "2026-09-03T14:30:00Z"
}
```

`totalRounds` and `averageMs` in this response are the values calculated and stored by the backend.

### Error response

```json
{
  "error": {
    "code": "score_invalid_round_count",
    "message": "times must contain exactly five reaction times."
  }
}
```

| HTTP status | Code | Condition |
| --- | --- | --- |
| `400` | `invalid_json` | Body cannot be decoded or contains an unknown field. |
| `400` | `score_invalid_round_count` | `times` does not contain exactly five values. |
| `400` | `score_invalid_time` | A reaction time is not positive. |
| `400` | `score_invalid_missclicks` | `missclicks` is negative. |
| `400` | `score_display_name_too_long` | Trimmed `displayName` is longer than 24 characters. |

Unexpected failures use status `500`, code `internal_error`, and do not expose internal details.

## Deferred submission features

These features deliberately remain outside the current score-correctness slice:

1. The client sends an anonymous player identifier so multiple scores can belong to the same browser/player.
2. A later reliability release adds a client-generated idempotency key with a database uniqueness constraint.
3. Upper bounds are defined for reaction time, missclicks, and request size.

The nullable `display_name` column is now populated when a player chooses a name. The existing nullable `player_id` and `submission_id` columns remain unused until those contracts are agreed.

The frontend remembers a submitted non-empty display name in browser `localStorage` and pre-fills it for the next game. Clearing the field and saving anonymously removes that stored value. Browser storage is only a convenience; the backend still validates every request.

**Open decision:** whether anonymous identity belongs in the body or is supplied through a separate browser/session mechanism.

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
      "totalRounds": 5,
      "missclicks": 1,
      "createdAt": "2026-09-03T14:30:00Z"
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
