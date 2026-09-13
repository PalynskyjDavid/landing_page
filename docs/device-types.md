# Score device types and stable controls

## Behavior

- Scores store exactly `computer` or `mobile` in `scores.device_type`.
- Migration 009 assigns `computer` to all existing scores using PostgreSQL's
  constant column default. The column is NOT NULL and has an allowlist CHECK.
- Missing, null or empty API input also defaults to computer for old clients and
  previously queued submissions. Existing device data is never guessed anew.
- New games classify phones/tablets as mobile and other browsers as computer.
  Classification is captured at game start, saved in the IndexedDB payload, and
  reused unchanged through retry/reload. It is part of idempotency comparison.
- The statistics filter applies to games before grouping, minGames, summaries,
  charts and Top N. A player spanning both types is labeled Mixed when unfiltered.
  Mixed is a derived display value, never a stored score value or filter option.

This is a coarse browser-reported hint, not security, anti-cheat, verified hardware
or proof of touch versus mouse input. We use the mobile client hint where available,
then limited user-agent/iPad heuristics; resizing a computer does not change its
category. Only the category is persisted, not the user-agent string.
Browser detection is inherently fallible; see
[MDN's mobile hint](https://developer.mozilla.org/en-US/docs/Web/API/NavigatorUAData/mobile)
and [user-agent limitations](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Browser_detection_using_the_user_agent).

## Rollout

1. Back up the target database using the existing deployment/backup workflow.
2. Apply migration 009 before starting the new backend. Locally, `task db:setup`
   starts the development database and applies pending migrations without a reset.
3. Restart the backend, then serve the matching frontend. Old cached clients still
   work with the new API because deviceType is optional.
4. Check an old score (computer), a new mobile score and the statistics filter.

Do not deploy the new frontend against the old API: it rejects unknown JSON fields.
The down migration preserves scores but removes device classifications; reapplying
it labels all then-existing rows computer. Do not roll it down merely to restart
the app. The production deployment helper already backs up before migrations.

## Stable controls

The theme button reserves 9.5rem, each EN/CZ button 3rem, each main navigation link
6rem and the changing refresh button 10.5rem. Save already uses its full form width
and now explicitly reserves it. Rem sizing follows text size; the header can wrap
on narrow screens. Hover borders reserve space instead of changing layout size.
These rules target changing controls rather than assigning one width to all buttons.

## Verification (2026-09-12)

- All 120 frontend unit tests pass; frontend lint/build and backend lint pass.
- The full Go suite, including PostgreSQL integration and OpenAPI tests, passes
  against a separate disposable PostgreSQL 16 container.
- Real SQL tests cover backfill, constraints, replay/conflict, per-device ranking,
  summary/player averages, minGames and migration down/up without score loss.
- The 100,000-score fixture includes both device types. One local run of mobile
  player groups over seven days matched 478 games: about 16.5ms repository time,
  1.6ms EXPLAIN execution. This is a local sample, not a production guarantee.
- Isolated Chromium checks used the built frontend, real Go API and disposable DB.
  Header positions were unchanged across EN/CZ/theme switches at 320/360/768/1280px;
  refresh/save dimensions were stable. Mobile classification survived offline
  queuing/reload/recovery even after browser hints were changed before retry.
- Added CI regressions in `e2e/device-type.spec.js` and extended localization's
  offline scenario. The complete Compose/NGINX E2E suite was not rerun in this slice.

Only the disposable test database was migrated here. Development/production
databases, deployed site and private portfolio material were not changed.

## Full-container verification (2026-09-13)

The complete 26-scenario Chromium suite now passes against production NGINX,
the real Go API and isolated PostgreSQL. This includes the three localization
and two device/stable-control scenarios, plus existing saves, retries, outages,
statistics and rate limits. The shared quality gate passes with 150 frontend unit
tests and 12 deployment safeguards. See [the E2E record](testing/e2e.md#flowento-localization-and-device-filters-2026-09-13).

The original E2E database was restored exactly to schema 8 with three scores and
left stopped. Development/production databases and the live website were not
changed. Migration 009 and the matching API/frontend release remain pending for
the target environment. A full real-device/accessibility review is still separate.
