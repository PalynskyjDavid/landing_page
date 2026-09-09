# Working with the API contract

`openapi.yaml` is the machine-readable HTTP contract for the canonical Go backend.
`reaction-results-api.md` explains the product rules and the reasons behind them.
Update both when intentionally changing the API; neither is generated from the other.

## What is new here?

OpenAPI describes HTTP **paths**, **operations**, **parameters**, **request bodies**,
and **responses**. Reusable **schemas** describe the JSON shapes. A `$ref` reuses
another definition in the same file, much like reusing a named Go type.

Start with `paths → /scores → post`. Its request points to `CreateScore`, while its
201 and 200 responses both point to `SavedScore`. This makes the distinction between
client input and server-calculated output explicit.

This document is not executable business logic. For example, five samples can be
expressed as `minItems: 5` and `maxItems: 5`, but comparing a retry against an existing
score still belongs in the service. The 24-character display-name limit is applied
after trimming, so it cannot be represented as a simple limit on the raw input.

## The automated check

From the repository root:

```powershell
task api:check
```

The test-only Go library `kin-openapi` is pinned in `my-backend/go.mod`. The tests:

1. Load and validate the YAML, references, and examples with external references disabled.
2. Compare documented operations against the real application's registered routes.
3. Send HTTP requests through the real router, cookie middleware, handler, and service,
   substituting the existing fake repository for PostgreSQL.
4. Validate real responses against their status-specific schemas and check error codes.
   Every Go-handler response status must have a test case. Responses marked
   `x-edge-response` originate in NGINX and are checked in proxy browser tests.
5. Deliberately damage sample responses to prove the validator catches changes such
   as an integer ID becoming a string or a required timestamp disappearing.

`task backend:test` and therefore `task check` already run these tests. The existing
quality CI job picks them up automatically; no extra CI job or database is needed.
The validator does not run on production requests or generate application code.

These are HTTP contract tests, not a replacement for service unit tests, PostgreSQL
integration tests, or browser scenarios. They cover representative requests; they
do not prove that every possible input or every business rule is correct.

## Changing the API deliberately

1. Describe the new input, output, errors, and compatibility impact in the contract.
2. Add an HTTP contract example that fails until the behavior is implemented.
3. Implement the handler/service/repository changes that are actually needed.
4. Run `task api:check`, `task check`, and relevant database/browser tests.

Do not weaken a schema just to hide a failing test. First decide whether the
implementation is wrong or the intended API really changed. Keep published clients
in mind before removing fields, making optional fields required, or changing types.

The contract covers scores, leaderboard reads, filtered/grouped statistics, and
health probes. The old events client remains unused; events are not implemented.
See [statistics and rate limits](../statistics.md) for aggregation semantics and
the distinction between the NGINX edge and the direct local debugging API.

## Interactive documentation: Swagger UI

If the frontend is already running, open `/docs` on its existing address. Otherwise:

```powershell
npm ci --prefix frontend
task api:docs
```

This starts Vite and opens `/docs`; it does not start the API or PostgreSQL. You
can read the contract without them. **Try it out sends real requests**, so start
the normal development backend/database before executing endpoints. Start with
`GET /health/live`, then `/health/ready`. POSTing a score changes that API's data.
If Vite is already using its port, visit the existing frontend instead of starting
a second instance; the task deliberately does not silently choose another port.

`frontend/scripts/apiDocsPlugin.js` serves a small local HTML page and the pinned
`swagger-ui-dist` assets only in Vite development mode. It reads the canonical YAML
and serves `/docs/openapi.json` with the current `VITE_API_URL` as its server URL.
The checked-in YAML remains environment-neutral. The browser page uses that same
API origin and includes cookies. Use the matching localhost/127.0.0.1 frontend/API
configuration so CORS and SameSite cookies work as they do for the game.

The production frontend bundle does not contain the docs assets. No public CDN or
Swagger validation service receives the private contract. The browser smoke test
checks that docs and its health request use only the configured frontend/API origins.
The frontend package also opts out of Scarf install analytics, a transitive
dependency of Swagger UI.
Client type generation and a deployed documentation site remain later work.

## Compatibility note: contract 2.0.0

`info.version: 2.0.0` is our API contract version; the OpenAPI file format remains
`openapi: 3.0.3`. These are independent version numbers.

A cookieless `POST /scores` now returns `400 score_player_cookie_required` plus
`Set-Cookie`, without saving. Retain the cookie and repeat the same submission.
The app handles this once automatically; Swagger UI and direct API clients must
repeat the call themselves, or first GET the leaderboard to acquire the cookie.
Do not manually type a `Cookie` header into Swagger's browser UI; the browser
manages it. Cookies are identity hints, not authentication.

This is an intentional protocol change for direct callers, hence the major
contract-version increment. Update frontend/backend together and reload older
frontend tabs before testing. No SQL migration is needed. The reason and limits
are recorded in [ADR 0003](../decisions/0003-establish-player-cookie-before-saving.md).

References: [OpenAPI 3.0.3](https://spec.openapis.org/oas/v3.0.3.html) and
[kin-openapi](https://github.com/getkin/kin-openapi).
