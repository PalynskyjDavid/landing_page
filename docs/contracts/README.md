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
   Every documented response status must have a test case.
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

The contract currently covers only scores, leaderboard reads, and health probes.
Frontend statistics/event clients still point at unfinished backend features; their
endpoints must be designed and implemented before being added here.

Possible later uses include an interactive documentation page and generated client
types. Neither is required for this slice. You can inspect the YAML locally without
uploading this private project's contract to a public online editor.

References: [OpenAPI 3.0.3](https://spec.openapis.org/oas/v3.0.3.html) and
[kin-openapi](https://github.com/getkin/kin-openapi).
