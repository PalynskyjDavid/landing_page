# First public deployment: a small Linux VPS

This is the **manual first-release path**, not an automatic CD pipeline.
CI currently checks the code; it does not publish images. The scripts build the
checked-out commit's images on the server and keep them under full Git SHA tags.
No GitHub deployment token or paid container registry is required for this path.
Moving those builds into CI/GHCR is a later, separate step.

From Windows, run `task deploy:check` for the safety tests and
`task deploy:config:check` to parse Compose without launching anything. The first
also runs inside `task check` / CI. Both checks require the Docker CLI and Compose
plugin, but no running Docker daemon. Startup flags are validated against the real
Compose parser in help mode, not only mocked commands. Server operations below
use Bash over SSH, not the local E2E tasks. Windows safety tests use Git for
Windows' bundled Bash.

## Buy / create first

- A small **x86-64 Linux VPS**, initially around 2 vCPU / 4 GB RAM, in the EU.
  A Hetzner Cloud CX23 is one suitable starting point; check current stock and
  checkout pricing. Choose Ubuntu 24.04 LTS and public IPv4, not shared web hosting.
- A domain you own: Cloudflare Registrar for a supported suffix such as .com,
  or VEDOS for .cz. Check **renewal**, not just first-year pricing. Enable account
  2FA and domain auto-renew. Domain and server can come from different providers.
- An encrypted, **off-server database backup** destination. A local dump on the
  VPS is useful before an update, but does not survive loss of the server.
  Provider snapshots are useful in addition to a tested PostgreSQL backup.

Do not buy paid SSL, Kubernetes, cPanel, a load balancer or email hosting for this app.

Provide the deployment operator with the domain, server IP, OS, SSH username or
local SSH alias, and backup destination. Keep accounts under your ownership.
Use an SSH public key at the provider; **do not share private keys, passwords or
tokens in chat or commit them to Git**. Verify the host fingerprint before login.

## Architecture

Browser -> Caddy (HTTPS :443) -> NGINX/React -> Go API -> PostgreSQL.
NGINX also sends anonymous aggregate events to the private collector.

Only Caddy publishes host ports (80 and 443). API, PostgreSQL and the collector
have no public ports. The database network is internal. Caddy has fixed private
IP 172.30.46.2, and only that address is trusted to supply visitor forwarding
headers to NGINX. Keep Cloudflare DNS records **DNS-only** initially: enabling a
CDN proxy changes this trust boundary and must be configured separately.

The edge subnet is 172.30.46.0/24. Check it does not overlap existing Docker/VPN
networks. If changing it, update BOTH compose.prod.yml and
deploy/nginx-proxy-trust.conf, then recheck client-IP/rate-limit behavior.

The database uses four accounts: admin for provisioning/backups, migrator for
schema changes, API for scores/reads, collector for anonymous metrics.
Only the migrator owns the application tables. grants.sql deliberately enumerates
runtime permissions: review it when adding tables/functions.

## Server preparation (one-time, performed together)

1. Install security updates and Docker Engine with the Compose plugin using
   [Docker's Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/).
   The server also needs Git, Bash, curl, openssl and util-linux (flock).
   Node, Go and Task are not required on the server; builds run inside Docker.
2. Configure SSH key login and verify a second login works before restricting
   password/root login. Docker access is effectively root access: do not give it
   to untrusted users. Server hardening is intentionally not an unattended script.
3. At the provider firewall, permit TCP 80/443 publicly and restrict TCP 22 to
   your management IP where practical. Do not open 3001, 5432, 5514 or 8080.
   Verify from outside; Docker-published ports need deliberate firewall handling.
4. Point a DNS A record for your chosen hostname to the server IPv4.
   Do not add AAAA unless IPv6 is configured. Use one canonical hostname initially;
   www aliases/redirects need a deliberate Caddy/DNS change.
5. Clone the repository into a persistent directory, e.g. /opt/landing-page,
   owned by the trusted deployment operator. Check out the exact reviewed commit
   whose CI passed. Deployment changes on the deployment branch must first be
   committed and pushed; the script refuses dirty checkouts.
6. Run from the repository root:

```bash
bash deploy/production.sh init your-real-domain.com
bash deploy/production.sh check
bash deploy/production.sh build
```

init creates deploy/.env with four independent random passwords (mode 600) and
refuses to overwrite it. Keep an encrypted recovery copy away from the VPS.
The file is parsed as data, never executed as a shell script. Do not replace
production credentials with development/E2E values. Changing this file later
does **not** rotate passwords inside an already initialized database.

## Launch / subsequent update

Before the first launch, decide whether to start with an empty production DB.
That is the default: no demonstration scores or E2E fixtures are imported.

```bash
bash deploy/production.sh up
bash deploy/production.sh status
bash deploy/production.sh smoke
```

up requires the four already-built images for HEAD. It pulls the pinned Caddy/DB
images, starts the persistent DB, makes a backup, applies pending Tern migrations,
updates runtime grants, starts the apps, recreates the collector against web's
current network namespace, and checks public HTTPS routes. The initial backup is
pre-migration/empty; take another after launch for a useful restore exercise.
Caddy obtains and renews certificates automatically once DNS and ports work.

For updates: review CI for the target commit, fetch/check out that commit, then
run build and up again. Keep deploy/.env, .deploy and .backups in this persistent
checkout. Images and these files stay local; **no script pushes to Git or GHCR**.

A lock prevents two script operations from changing the stack simultaneously.
Failures stop the script; they do not trigger destructive down migrations or
automatic data restoration. Existing apps remain running while images build and
migrations run. Therefore migrations must be backward-compatible with the old
version. Container replacement may cause a short interruption; this is not
zero-downtime deployment. The frontend outbox handles transient score failures.

## Backups and recovery

```bash
bash deploy/production.sh backup
bash deploy/production.sh restore-check /absolute/path/to/completed-backup.dump
```

Backups use pg_dump's consistent custom format while the app runs. An incomplete
file retains its .partial suffix and must not be treated as a successful backup.
restore-check imports into a separate, networkless, tmpfs PostgreSQL service,
queries schema version and score count, then removes ONLY that scratch service.
It does not alter the production database. Scratch storage is capped at 1 GiB;
increase it deliberately if a future backup outgrows the smoke-test database.

Before public launch, configure and verify a daily backup schedule, encrypted
off-server copy, retention (for example 7 daily + 4 weekly) and failure alerts
with the chosen destination. These provider-specific pieces are not automated
yet. Avoid blind disk cleanup: backups and old images are retained intentionally.

Backups omit cluster roles/passwords. To recover after server loss, provision a
fresh isolated DB with init-db.sh, restore using --no-owner --no-privileges as
app_migrator, then run grants.sql as admin. Restore into a NEW volume, verify it,
and plan cutover; never overwrite the live volume casually. Keep the matching
code/migration version and encrypted secrets recovery copy.

## App rollback

Only when the previous app is compatible with the **current database schema**:

```bash
bash deploy/production.sh rollback FULL_PREVIOUS_40_CHARACTER_SHA --schema-compatible
```

The previous images must still exist locally. This backs up the DB and replaces
app images without rolling back migrations. Proxy/grant configuration remains
from the current checkout, so this is an app-image rollback, not arbitrary
infrastructure rollback. Review config changes separately. Never use an automatic
image updater that silently selects latest or deletes the previous release.

## Before putting the link in your CV

### Local verification on 2026-09-11

`task check` passed (Go checks, 102 frontend unit tests, builds and nine deployment
safety tests), as did `task deploy:config:check`. All four images built locally.
A separate Docker Desktop rehearsal used a fresh database and loopback-only HTTPS
with Caddy's **local test CA**, not a public certificate. It verified migration
version 8 and a no-op rerun, restricted runtime DB privileges, score/name writes,
idempotent replays, Secure cookies, forged forwarding-header rejection, API outage
and recovery, collector writes, backup/restore and persistence after DB restart.

The rehearsal exposed and fixed two startup issues: Tern's missing OS-user
metadata in scratch, and automatic Docker IP allocation colliding with Caddy's
reserved address. Static regression checks cover both configuration requirements.
This was not a public deployment, a full browser E2E rerun, an external firewall
test, or a complete Ubuntu/real-domain/rollback rehearsal.

### Public launch checklist

- [ ] Production deployment commit passes CI and deployment checks.
- [ ] Clean-server rehearsal: init, migrations, repeated deploy and DB persistence.
- [ ] Valid HTTPS; game submission/reload, statistics and retry after API restart.
- [ ] Anonymous cookie is Secure; no public DB/API/collector ports.
- [ ] NGINX sees real visitor IPs; spoofed forwarded headers cannot bypass limits.
- [ ] Off-server backup, scratch restore and schema-compatible rollback tested.
- [ ] External uptime alert and a basic disk-space/update routine configured.
- [ ] Review privacy text: visitor IPs appear in bounded private logs, not public stats.

Local preparation does not prove public DNS/TLS/firewall correctness. Complete
those checks on the actual server before declaring the site launched.
