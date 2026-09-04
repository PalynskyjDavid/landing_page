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
  "submissionId": "550e8400-e29b-41d4-a716-446655440000",
  "times": [241, 228, 255, 249, 235],
  "missclicks": 1,
  "displayName": "David"
}
```

The implementation applies these rules:

- `submissionId` is a required UUID generated once for each completed game by the client. Every retry of that score reuses the same value.
- `times` must contain exactly five positive integer values in milliseconds.
- `missclicks` must be zero or greater.
- `displayName` is optional; it is trimmed, an empty value becomes `null`, and its maximum length is 24 characters.
- Unknown JSON fields are rejected.

The browser does not send `playerId` in the JSON body. The backend reads it from the `reaction_player_id` cookie so a caller cannot select another player merely by changing the request body. If the cookie is missing or invalid, the backend generates a UUID and returns a one-year, `HttpOnly`, `SameSite=Lax` cookie. Production sets the cookie's `Secure` attribute through `COOKIE_SECURE=true`.

The client does not send `totalRounds` or `averageMs`. The service derives a round count of five and calculates the average from `times` using integer division, which rounds a positive fractional result down. For example, a sum of `1208` divided by `5` is stored as `241`.

### Success response

```http
HTTP/1.1 201 Created
Content-Type: application/json
```

```json
{
  "id": 42,
  "submissionId": "550e8400-e29b-41d4-a716-446655440000",
  "totalRounds": 5,
  "averageMs": 241,
  "displayName": "David",
  "createdAt": "2026-09-03T14:30:00Z"
}
```

`totalRounds` and `averageMs` in this response are the values calculated and stored by the backend.

Repeating the same `submissionId` with identical normalized score data returns the existing score with `200 OK`. It does not insert another row. Reusing it with different times, missclicks, display name, or player cookie returns `409 Conflict`.

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
| `400` | `score_invalid_submission_id` | `submissionId` is missing or is not a UUID. |
| `400` | `score_invalid_round_count` | `times` does not contain exactly five values. |
| `400` | `score_invalid_time` | A reaction time is not positive. |
| `400` | `score_invalid_missclicks` | `missclicks` is negative. |
| `400` | `score_display_name_too_long` | Trimmed `displayName` is longer than 24 characters. |
| `409` | `score_submission_conflict` | `submissionId` already belongs to different normalized score data or a different player. |

Unexpected failures use status `500`, code `internal_error`, and do not expose internal details.

## Deferred submission features

These features deliberately remain outside the current score-correctness slice:

1. A durable client outbox stores submissions that remain pending during a longer outage.
2. Personal-score and personal-best endpoints use the anonymous player identifier.
3. Upper bounds are defined for reaction time, missclicks, and request size.

`submission_id` and `player_id` are required UUID columns for migrated databases. Existing rows receive generated UUIDs during migration because their original browser and submission identities are unknowable. The older nullable `session_id` column is no longer used and remains only for a later data-retention decision.

The frontend remembers a submitted non-empty display name in browser `localStorage` and pre-fills it for the next game. Clearing the field and saving anonymously removes that stored value. Browser storage is only a convenience; the backend still validates every request.

The anonymous cookie identifies one browser profile, not a verified person. It can be deleted and does not provide authentication or authorization.

## Leaderboard read

```http
GET /scores/leaderboard?limit=10&sort=averageMs:worst,missclicks:best
```

The optional `limit` defaults to `10` and must be between `1` and `50`.

The optional comma-separated `sort` contains one or two different `field:direction` pairs. Fields are selected from `averageMs`, `bestMs`, and `missclicks`; directions are `best` or `worst`. The first pair is the primary order and the second breaks ties. `best` means the lowest value comes first and `worst` means the highest value comes first. A field without an explicit direction defaults to `best`.

If `sort` is omitted, it defaults to `averageMs:best,missclicks:best`. If only one field is supplied, the service chooses a different sensible secondary field using the `best` direction. Remaining ties are ordered by:

1. Earliest `createdAt`.
2. Lowest `scoreId` as the final stable tie-breaker.

`bestMs` is the lowest of the five stored reaction times. A missing `displayName` is omitted from JSON and displayed as `Anonymous` by the frontend.

The response shape is:

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

Invalid text or values outside the supported limit return:

```json
{
  "error": {
    "code": "score_invalid_limit",
    "message": "limit must be between 1 and 50."
  }
}
```

Unknown fields or directions, duplicate fields, or more than two pairs return code `score_invalid_sort`. The backend maps the allowed names to fixed SQL expressions; query values are never inserted as raw SQL column names.

The frontend presents two sorting rows containing a Best/Worst selector and a Column selector. Selected table headers display their priority and direction: `↑` means best/lowest first and `↓` means worst/highest first.

Pagination remains deferred until the amount of data makes it useful.

## Contract-first implementation sequence

1. Agree on the open product decisions and concrete JSON examples.
2. Convert this document into an OpenAPI document with reusable schemas and errors.
3. Add handler contract tests using HTTP requests without PostgreSQL.
4. Define the service and repository operations required by the contract.
5. Design and migrate the PostgreSQL schema and indexes.
6. Add repository integration tests against an empty migrated PostgreSQL database.
7. Implement the frontend against the agreed contract.

Dependencies point inward: HTTP handlers depend on service contracts, services depend on repository interfaces, and PostgreSQL implements those interfaces. Tests can substitute fakes at either boundary while unfinished layers are developed.
