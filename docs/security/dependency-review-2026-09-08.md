# Dependency and toolchain review — 2026-09-08

## Scope and result

This is a targeted review of the canonical `my-backend`, its Tern migration tool,
the React build/development dependencies, and the existing API/web image bases.
It does not replace application review, secret scanning or container OS scanning.
The legacy backends, application contract and SQL migrations were not changed.

Before remediation, the full npm audit reported ten affected packages (seven
high, one moderate, two low). The production-only audit reported zero. These
packages are used by development/build/lint tooling, not installed in the final
NGINX image. Development tools still process files and accept local requests, so
this is relevant exposure, not a reason to ignore the findings.

After the reviewed updates and a clean `npm ci`, the full npm audit reports zero.
The backend source scan reports no vulnerabilities. Tern has no affected code
paths or imported packages, but one module-level advisory remains as explained
below. Results are a dated snapshot of the advisory databases, not a guarantee.

## Frontend changes

These are the affected-package versions recorded by the lockfile before/after.
A package may have several advisories; ten is not the number of individual CVEs.

| Package         | Before | After  | Where it matters here                 |
| --------------- | ------ | ------ | ------------------------------------- |
| @babel/core     | 7.29.0 | 7.29.7 | React build transformation            |
| @humanfs/node   | 0.16.7 | 0.16.8 | Linter filesystem tooling             |
| brace-expansion | 1.1.12 | 1.1.18 | Tooling glob expansion                |
| browserslist    | 4.28.1 | 4.28.9 | Build target queries                  |
| esbuild         | 0.27.3 | 0.28.2 | Vite build/dev tooling                |
| flatted         | 3.3.3  | 3.4.4  | Tooling cache serialization           |
| js-yaml         | 4.1.1  | 4.3.2  | Tooling YAML parsing                  |
| nanoid          | 3.3.11 | 3.3.18 | PostCSS dependency                    |
| postcss         | 8.5.6  | 8.5.28 | CSS processing                        |
| vite            | 7.3.1  | 7.3.6  | Local dev server and production build |

The direct Vite/PostCSS ranges were advanced within their current major versions.
Related Babel/browser-data/platform packages changed as needed in the lockfile.
Vite 7.3.6 accepts esbuild 0.28; its pre-1.0 version change was reviewed rather than
forced with an override. React, React Router, TanStack Query, Tailwind, ESLint,
Playwright and Swagger UI versions were not changed by this review.

The reviewed advisory examples include Vite's Windows filesystem-deny bypass,
esbuild's Windows development-server file read, and PostCSS source-map reads.
These indicate possible exposure, not evidence of exploitation in this app.
See the upstream [Vite advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff),
[esbuild advisory](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr),
and [PostCSS advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp).

The change used an explicit package list with `npm update --package-lock-only
--ignore-scripts`, followed by diff review and `npm ci`. It did not use
`npm audit fix --force` or adopt a new frontend framework.

## Go and image versions

| Component                            | Before        | After         |
| ------------------------------------ | ------------- | ------------- |
| Node local/CI/build version          | 22.17.0       | 22.23.2       |
| Go backend/tools/build version       | 1.26.1        | 1.26.8        |
| Unprivileged NGINX runtime           | 1.28.2-alpine | 1.30.4-alpine |
| Backend chi                          | 5.2.5         | 5.3.0         |
| Backend pgx                          | 5.9.1         | 5.10.0        |
| Backend x/text                       | 0.29.0        | 0.41.0        |
| Backend x/sync (resolved dependency) | 0.17.0        | 0.22.0        |
| Tern's x/crypto                      | 0.55.0        | 0.56.0        |

The backend pgx/x/text versions now match those already selected by Tern.
Tern remains 2.4.3. The compiler update addresses standard-library findings in
the compiled executable; updating a builder tag without rebuilding would not.

The initial Windows backend scan reported 20 findings on affected code paths,
plus additional package/module-only findings. After the backend/toolchain
updates, none remain. Tern then reported two SSH dependency findings on affected
paths, resolved by x/crypto 0.56.0. Reachability is useful triage, not proof of a
working exploit. Sources: [Go release history](https://go.dev/doc/devel/release),
[pgx advisory](https://pkg.go.dev/vuln/GO-2026-5004),
[x/text advisory](https://pkg.go.dev/vuln/GO-2026-5970),
and [x/crypto SSH advisory](https://pkg.go.dev/vuln/GO-2026-6355).

The Node 22 maintenance release and NGINX stable security release were verified
upstream; all three downloaded Docker bases were pinned to newly verified
manifest digests. See the actual Dockerfiles for the complete pins and
[Node's release](https://nodejs.org/en/blog/release/v22.23.2) /
[NGINX stable changes](https://nginx.org/en/CHANGES-1.30).
NGINX's newer upstream keepalive defaults make real proxy/restart tests important.

### Code correction: forwarded IP headers

Updating chi alone does not fix an application that continues to use its retained,
deprecated `middleware.RealIP`. It trusts caller-controlled `True-Client-IP`,
`X-Real-IP` and `X-Forwarded-For`; our deployment has no trusted-proxy policy.
The router no longer installs that middleware. It preserves `RemoteAddr` from
the connection. When proxied, that identifies NGINX, not the end user's IP.

Three regression cases failed with the old middleware and pass after its removal.
No public route was added; the peer-inspection route exists only in the test.
Before adding IP-based rate limiting or security decisions, define trusted proxy
ranges and header sanitation explicitly. See
[chi's retained middleware](https://github.com/go-chi/chi/blob/v5.3.0/middleware/realip.go).

### Remaining module-only advisory

[GO-2026-5932](https://pkg.go.dev/vuln/GO-2026-5932) concerns the unmaintained
`golang.org/x/crypto/openpgp` packages, with no fixed version. Tern needs other
packages in the x/crypto module, but its scanned dependency graph does not import
OpenPGP. The scanner reports zero affected imported packages and code paths.

Disposition: retain the patched x/crypto module and document this unused-package
finding. No suppression was added. Reassess if code/dependency changes introduce
OpenPGP; do not start using the obsolete package.

## How to repeat the checks

From the repository root:

```powershell
task check
task security:check
```

The second task runs, in sequence:

1. `frontend:audit`: full `npm audit`, including dev/build tools.
2. `backend:vuln`: pinned govulncheck v1.7.0 against the backend.
3. `backend:tools:vuln`: the same scanner against Tern's actual command package.

CI's quality job runs the same security task after the deterministic quality gate.
npm audit findings and Go findings on affected code paths fail the step. Network
failure also fails rather than silently skipping the checks. A new advisory can
change the result for an unchanged commit. The scanner is pinned in Taskfile.yml;
the vulnerability databases are intentionally current. No packages are upgraded
by these commands. See [Go vulnerability management](https://go.dev/doc/security/vuln/).

The local source scans use Windows build constraints; hosted CI uses Linux.
Neither scans all possible platforms/tags, every test-only dependency path, or
unknown vulnerabilities. Container OS packages, PostgreSQL image freshness,
secret scanning, SBOM/signing, TLS, rate limits and deployment remain separate work.

## Local toolchain note

Validation used an official Node 22.23.2 portable distribution under ignored
`frontend/.e2e/toolchains/`, verified against Node's published SHA-256.
The machine-wide Node selection was not changed. Use the nvm-windows commands in
[development.md](../development.md) to update normal terminals. Go selected
1.26.8 through its normal module toolchain mechanism.

## Verification

- Clean frontend install, formatting/lint, backend tests, all 67 Vitest tests,
  and both host builds passed.
- `task security:check` passed with the unused OpenPGP disposition above.
- The real PostgreSQL integration suite passed against the isolated E2E database,
  including name synchronization, concurrent inserts and migration down/up.
- Both updated container images built successfully.
- All ten Playwright scenarios passed in about 3.5 minutes against the updated
  containers: Swagger, routes/assets/cookies, real API/DB outages, replacement
  behind the still-running proxy, and lost-response/idempotency recovery.
- The actual Linux/amd64 API executable was copied from the owned test container.
  Its build metadata reports Go 1.26.8 and the patched modules; govulncheck
  `-mode=binary` reported no vulnerabilities. Binary scanning is less precise
  than source analysis and does not scan NGINX or image OS packages.
- NGINX configuration validation passed. API and web run as non-root with
  read-only root filesystems, and all three services are healthy.
- YAML parsing, full-SHA/read-only workflow assertions, actionlint v1.7.12
  (without optional ShellCheck/Pyflakes), and `git diff --check` passed.
- Before resets, the running manual E2E database was saved to ignored
  `frontend/.e2e/manual-before-security-20260908.dump`. After normal test cleanup,
  it was restored and its data-only dump SHA-256 matched exactly, including sequence
  values and excluding pg_dump's randomized restrict token:
  `3384f9675183de8a59318cadc0003b30c8602341af7bbcfe34ea8dfc2ea09ab9`.
  This is one-off preservation, not a new automatic backup feature.
- The manual stack is running again at `http://127.0.0.1:5188`. The development
  database was untouched. Nothing was committed, pushed, published or deployed;
  the changed CI workflow still needs a GitHub-hosted run.
