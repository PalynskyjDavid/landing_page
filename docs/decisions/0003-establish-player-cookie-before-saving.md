# ADR 0003: Establish the player cookie before saving a score

- Status: Accepted
- Date: 2026-09-08
- Decision owners: David and Codex

## Context

The outbox safely repeats a submission UUID when an HTTP response is lost.
However, the old first POST could both assign a new player cookie and commit a
score. If that response never reached the browser, the saved score belonged to an
identity the browser never received. Retrying without that cookie assigned another
identity and produced a conflict, despite preserving the submission UUID.

## Decision

The anonymous-player middleware records whether the request already carried a
valid player cookie. If not, it issues a replacement cookie as before, but the
score handler returns `400 score_player_cookie_required` before calling the
service or repository. It must not save a score on that request.

The score API adapter in the frontend recognizes this exact status/code and
repeats the unchanged payload once. Browsers attach the HttpOnly cookie via
`credentials: include`; JavaScript does not read it. If the second call still
requires a cookie, surface a permanent error instead of looping indefinitely.
Other failures remain subject to the existing delivery policy.

Losing this cookie-only response is harmless because nothing was saved. Once the
browser sends the cookie back, the write may proceed; losing the successful write
response is handled by existing UUID idempotency with the same identity.

## Consequences

- Usually no extra call is needed: opening the leaderboard already establishes
  the cookie. Direct first-time POST callers must retain the cookie and retry.
- The service's duplicate-data and player-identity checks remain unchanged.
- Contract 2.0.0 records the changed first-POST behavior; coordinate frontend and
  backend updates and reload old tabs. Existing SQL and stored rows are unchanged.
- Clearing/replacing cookies later can still change identity and cause a conflict
  for an already-saved queued submission. This is not authentication and does not
  solve cross-tab coordination, deleted browser data, or permanent validation errors.
- The delivery worker runs only while the app is open; IndexedDB retains pending
  work for the next visit, not background execution after the browser closes.

## Alternatives not selected

- Loosening retry comparisons across player IDs would change the existing identity
  contract and hide the missing-cookie problem.
- A new bootstrap endpoint would add another route and would still need to prevent
  writes before the browser proved it received the cookie.
- Having JavaScript own the player cookie would abandon the existing HttpOnly design.

## Verification

Handler tests prove repeated missing/invalid-cookie requests do not call the
repository. Frontend tests prove one bounded, identical retry and no generic 400
retry. A browser scenario discards a real cookie-only response, then a real 201
response after PostgreSQL saved the score. It observes 400, 400, 201, 200 and one
stored score. Isolated request contexts ensure discarded Set-Cookie headers cannot
quietly update the browser's cookie jar during the test.
