# Real outage verification — 2026-09-06

## Scope

This was a browser-driven verification session, not a committed Playwright suite.
The browser used the real frontend, Go API, cookies, IndexedDB outbox, readiness
checks, and PostgreSQL. No fetch mocks or connection-simulation switch were used.

The existing development database was not used. A disposable `postgres:16`
container, `landing-page-outage-20260906`, listened only on `127.0.0.1:5546`.
All six migrations were applied to its empty `outage_test` database. A temporary
Go executable listened on port 3101; a separate Vite instance used port 5183
and pointed at that API. The API allowed only that frontend origin for CORS.

## Results

| Scenario                     | During outage                                                                                                                | After recovery                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Backend process stopped      | Four send attempts failed; the score stayed in IndexedDB through refresh.                                                    | Restarting the API was enough: automatic readiness polling drained the queue and refreshed the leaderboard.           |
| PostgreSQL container stopped | Liveness stayed `200`; readiness returned `503`. Score POSTs returned `500` and were retried, then retained through refresh. | Restarting PostgreSQL, without restarting the API, restored readiness to `200` and automatically delivered the score. |

Both scenarios were played through the five-round game and submitted through
the Save score button. The browser remained online and the simulation switch
remained off. The final IndexedDB pending queue was empty.

Submission IDs observed in the disposable database:

- Backend outage: `4094cdc6-c423-4fc0-a4e0-4c13773331e4`.
- Database outage: `0abb0c61-9201-498e-bcd1-a374ab766d49`.

Both original HTTP requests were then replayed from the same browser. Each
returned `200 OK` and its existing score ID. A SQL count grouped by
`submission_id` returned exactly one row per ID, with two scores total.

## Repeating the check

Use an isolated test database and separate frontend/API ports. Apply migrations,
start both app processes, and confirm `/health/ready` is `200` before beginning.
Keep the same frontend address and browser profile throughout each scenario.

1. Finish a game, stop the test API, and save the score.
2. Wait for the queued state, then refresh. Confirm the queue still contains it.
3. Restart the API and let automatic readiness polling recover it without using
   Try now or the simulation's Restore button.
4. Repeat with only the test database stopped. Confirm live=`200`, ready=`503`.
5. Restart the database and confirm ready=`200`, an empty pending queue, and the
   leaderboard entry. Verify exactly one database row for each submission ID.
6. Replay each original request with the same cookie and payload; verify `200`
   and unchanged row counts.

Stop the temporary app processes and remove only the disposable test container
and its test volume afterward. Never use a volume-removal command against the
normal development database to perform this check.

This does not establish coverage for lost responses after a committed write,
simultaneous browser tabs, failed-record management, every validation error,
analytics, or accessibility. Choosing a browser-test framework and automating
repeatable scenarios is the next discussion.
