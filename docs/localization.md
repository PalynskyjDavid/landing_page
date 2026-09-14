
# Website localization

The public React UI uses i18next and react-i18next with bundled English and Czech
catalogs in `frontend/src/i18n/locales/en.json` and `cs.json`.
There is no translation service and no extra network request for translations.
Translations are authored in the repository; i18next selects them at runtime.

## Language selection

The header exposes a flag-and-code EN/CZ dropdown. Czech's language code is `cs`, not `cz`.
Selection order is the saved preference, the first supported browser language,
then English. Only `reactionGame.language` is saved in localStorage, not the
translation catalogs. Blocked storage permits switching for the current page.
The selected language updates the HTML `lang` attribute and page title.

Switching re-renders existing components; it does not remount the game, change
filters, restart score delivery, change anonymous identity, or translate score
payloads/player names. The language preference is independent of the score outbox.

## Adding text

Use `useI18n()` from `src/i18n/useI18n.js` in components and render
`t("Save score")`. Both catalogs use readable English keys; dots and colons
are literal because key and namespace separators are disabled. Add new static
keys to both files. For dynamic sentences, interpolate values, for example
`t("Round {{round}} / {{total}}", { round: 2, total: 5 })`.

Counted messages use semantic keys such as `gamesCount`, with i18next plural
suffixes. Czech needs `one`, `few`, `many` and `other`; keep the count
numeric so i18next can choose the form. Do not construct English sentences by
joining word fragments. English is the missing-translation fallback.

Use the hook's `n` and `date` helpers for displayed numbers and dates.
API values and filter inputs remain unchanged. Date displays and date filters
still use UTC, with locale-specific formatting. Error codes/statuses map to
translated user guidance; raw diagnostic text stays outside the public UI.
Render translations as React text, never through `dangerouslySetInnerHTML`.

## Czech writing style

Write Czech for a Czech reader, not as a sentence-by-sentence copy of English.
Keep a friendly, professional tone with consistent vykani, short sentences and
concrete verbs. Prefer "Načítáme…" to nominal status phrases and "výsledek" to
"skóre" in game messages. Use concise infinitives for actions. Technical names
such as React, API and MediaPipe stay unchanged; explain their role plainly.

Project descriptions should say what David actually did without expanding his
contribution or turning prototypes into finished products. Preserve privacy,
storage, retry and telemetry limitations even when shortening the wording.
Edit Czech values only; retain English keys, interpolation variables and all
plural forms. Update accessible-name assertions when the visible copy changes.

## Checks

- `task frontend:test`: catalog parity, interpolation, source-key coverage,
  Czech plurals, preference storage/fallback, UTC dates/numbers, safe errors.
- `task test:e2e -- localization.spec.js`: game/queue continuity, remembered
  language, unchanged filters, narrow-screen Czech statistics and blocked preference
  storage. This uses the
  existing isolated E2E database and resets its test data; it is not a production test.
- Review both languages on Home, Game, game/player Statistics and System statistics.

Homepage portfolio replacement and a full real-device/mobile accessibility review
remain separate tasks. Localization does not publish private CV material or change
the backend/OpenAPI field names. Developer-only Swagger documentation remains English.

Local verification (2026-09-12): 110 unit tests, formatting, lint and production
build passed. Isolated Chromium checks against the production preview, with all
API calls mocked, covered game/queue/reload continuity, populated statistics,
safe errors, preference fallback and blocked storage. EN/CZ layouts were checked
at 320, 360 and 768px with reduced motion; screenshots of Czech phone layouts were
reviewed. This does not replace a real-device/accessibility audit. The three new
Docker/database E2E scenarios are added but have not been executed in this slice.
No live website, database or private portfolio content was changed.

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

## Compact header controls (2026-09-14)

The two language buttons are now a fixed-width menu button showing an inline SVG
flag and EN/CZ. Menu options keep their full language names and current selection.
Enter/Space, Up/Down, Home/End, Escape, Tab and outside clicks are supported; focus
returns to the trigger after selection or Escape. Theme uses a fixed 44px sun/moon
button with a translated accessible action label and reduced-motion support.
Neither control loads external images or changes the existing storage policy.

The main navigation uses larger, stable-size links and a filled active tab, with
no tilt or text-nudge effects. Mobile navigation spans its own row. Keyboard focus
is visible and the dropdown overlays content without moving it.

E2E language changes now use selectLanguage() from e2e/support/language.js. The
header.spec.js scenario checks keyboard behavior, persistence, theme icons, active
routes, menu bounds and layout stability at 320/375/640/768/1440px. These checks,
the existing Flowento/Hand Controller navigation scenarios and blocked-storage
checks passed against Vite. No camera or database was used. The full Docker-backed
suite is still a separate verification step.
