# Pre-deployment source and image review — 2026-09-09

Scope: the current local cleanup/recovery tree on `codex/backend-foundation`,
based on `f300a4a`. No commit, push, publication or deployment is part of this scan.
Results describe this scan/date, not a permanent security guarantee.

## Repeat the checks

```powershell
task security:check    # Existing npm/Go dependency checks
task security:secrets  # All local Git refs plus shareable working-tree files
task security:images   # Rebuild API/collector/web locally, export and scan images
```

These additional release checks are explicit local commands; they have not yet
been added to GitHub Actions. `security:images` uses separate `:release-check`
tags and does not replace running containers, publish images or change registries.
Archives/reports stay ignored under `frontend/.e2e/security/run-*`.

Install the reviewed [Gitleaks 8.30.1](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1)
and [Grype 0.118.0](https://github.com/anchore/grype/releases/tag/v0.118.0) binaries
from their official release assets for your OS/architecture. Verify the downloaded
archive with the release checksums **before running it**. Put tools on PATH or
set `GITLEAKS_BIN` / `GRYPE_BIN` to their absolute executable paths. No global
installation is performed by the tasks, and mismatched versions are rejected.

On this Windows machine the tools were downloaded into ignored project storage
and verified against both official checksum files and GitHub release digests:

| Archive | SHA-256 |
| --- | --- |
| `gitleaks_8.30.1_windows_x64.zip` | `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e` |
| `grype_0.118.0_windows_amd64.zip` | `82fb07f246e61526e8f2bf187fc6bb29ed23c7450cda6e9d1868a60fb942fc98` |

The wrapper recognizes those local tool directories on Windows. Other machines
need their own verified installation; do not copy binaries or backups into Git.

## Git history and current source

Gitleaks scanned **25 commits** using `--all --full-history` across locally
available refs. The checkout was not shallow. A second scan copied Git-tracked
and new nonignored files, excluding pending deletions, into a temporary input
snapshot. Ignored `.env`, backups, installed dependencies and reports are not part
of the shareable tree. No automatic fetch or credential-validation requests occur.

The first raw history scan reported two candidates, both reviewed false positives:

| Exact historical location | Disposition |
| --- | --- |
| `f300a4a`, `docs/security/dependency-review-2026-09-08.md:171` | A documented database-backup SHA-256 checksum next to the phrase “restrict token,” not a credential. Current wording clarifies this. |
| `30ee9dc`, retired `backend/README.md:5` | The `abc123def456` CircleCI badge placeholder, exactly matching the [official Nest starter README](https://raw.githubusercontent.com/nestjs/typescript-starter/master/README.md). No project account credential. |

`.gitleaksignore` lists only these exact commit/path/rule/line fingerprints.
There are no directory-wide or rule-wide suppressions. After these dispositions,
history and shareable-tree scans had no unreviewed candidates. Reports redact
matched values. A new candidate fails the task and must be investigated, not
automatically added to the ignore file. No Git history was rewritten.

On Windows, antivirus/indexers can retain handles on copied input folders after
the scan. Cleanup retries briefly; locked copies may remain under the ignored
run directory with a warning. This does not suppress findings or scanner errors.
Unreachable Git objects, unfetched refs, hosting secrets, CI logs/artifacts and
ignored personal files are outside this scan's coverage.

## Runtime images

Grype analyzed `docker image save` archives of freshly built final images locally.
The scanner receives no Docker socket. It downloads vulnerability data, not
uploads of the app images. The report records image IDs and the advisory database;
the verified database was built on 2026-09-09. See [Grype's supported sources](https://github.com/anchore/grype#supported-sources).

The original web image had eight findings: two high and six medium. Its unused
`nginx-module-image-filter` pulled in libgd/TIFF. The active config loads no optional
modules. We removed image-filter, XSLT, GeoIP, njs and curl using the installed
package metadata, without a network package upgrade. Unused transitive image/XML
libraries and curl's nghttp2 dependency disappear from the final filesystem.
NGINX still runs as UID 101 with the same config and health check.

| Rebuilt image | High/critical | Other findings |
| --- | --- | --- |
| API | 0 | 0 |
| Collector | 0 | 0 |
| Web | 0 | 3 medium package matches for one BusyBox advisory |

The release task fails on high/critical findings and records **all severities**;
there are no Grype suppressions. Passing that threshold does not mean zero findings.
Exact image IDs remain in the ignored run summary so future builds are not
mistaken for the scanned artifacts.

### Remaining advisory: CVE-2025-60876

The matches are `busybox`, `busybox-binsh` and `ssl_client` at `1.37.0-r31`.
The [Alpine tracker](https://security.alpinelinux.org/vuln/CVE-2025-60876) describes
HTTP request-target/header injection through a crafted URL passed to BusyBox wget
and marks the installed version possibly vulnerable. No fix version was reported
in this scan. This is **not suppressed or claimed fixed**.

Our only configured wget use is the Docker health check with the literal URL
`http://127.0.0.1:8080/healthz`; it does not interpolate visitor input. NGINX handles
public requests and does not launch wget for them. From that code inspection,
the reported attacker-controlled-URL path is not exposed by the app's health check.
Reassess this if runtime commands change, and review/update the base image with the
hosting owner before public release. The residual finding remains visible.

A read-only headless Chromium smoke test against a temporary rebuilt web container
loaded the game, game-statistics table and System statistics without page errors.
NGINX syntax and health checks passed. No scores were submitted and the original
running app was not replaced. The full reset-heavy E2E suite still needs to run
against the final committed release candidate in CI.

## Remaining boundaries

This is not a penetration test, malicious-code audit, cloud-config review or full
supply-chain attestation. Static frontend dependency checks remain the npm gate;
bundled/minified browser dependencies are not comprehensively covered by an image
package scan. The selected managed PostgreSQL service or production DB image,
TLS, permissions, proxy trust, off-site backups and deployment/rollback must be
reviewed with the platform owner. Scanners and their advisory databases need
reviewed updates too. Keep secret reports and database archives private.
