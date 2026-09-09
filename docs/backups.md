# Local backups and restore rehearsal

A stopped container is not a backup. These commands make a PostgreSQL custom-format
archive and prove it can be restored, without resetting either existing database.
Docker and the supported Node version must be available. No host PostgreSQL client
installation or production credentials are required.

## 1. Back up an already-running local database

From the repository root:

```powershell
task db:backup
# Or explicitly select the disposable E2E database:
task db:backup SOURCE=e2e
```

The default checks that `events_db` belongs to this checkout's root Compose file.
The E2E option checks its project/service labels and fixed database identity.
Neither option starts, migrates, stops or resets a database. Do not run a test
reset concurrently with a backup. Arbitrary hosts/connection URLs are not accepted.

The command runs the container's own PostgreSQL 16 `pg_dump` using its configured
database role. Binary stdout goes directly to a file descriptor, avoiding text
conversion by PowerShell. A unique `.partial` file becomes a `.dump` only after
success. A sidecar `.dump.json` records the format, version, size and SHA-256.
Keep both files together under the ignored `.backups/` directory.

Example output name (use the actual name printed by your backup):

```text
development-2026-09-09T13-08-49.325Z-96d1aa54-fff4-4772-a029-3ea5108d581d.dump
```

PostgreSQL takes a consistent database snapshot for the dump while normal traffic
can continue. It is not a transaction log or point-in-time recovery setup.
[PostgreSQL pg_dump documentation](https://www.postgresql.org/docs/16/app-pgdump.html)

## 2. Prove restoration works

```powershell
task db:restore:check FILE=development-2026-09-09T13-08-49.325Z-96d1aa54-fff4-4772-a029-3ea5108d581d.dump
```

`FILE` must be a basename inside `.backups`, with a matching manifest. The command:

1. Verifies the archive SHA-256 and PostgreSQL custom-format signature.
2. Creates a uniquely named/labeled PostgreSQL 16 container with **no network or
   published ports**. Its data lives in a 512 MiB temporary memory filesystem.
3. Mounts only the selected archive, read-only. Restores into the new empty
   `restore_check` database with `--single-transaction --exit-on-error`.
4. Checks the app's migration version, hashes every public table's rows, and records
   sequence values/`is_called`. It never prints player names or raw rows.
5. Dumps that restored database, restores the new dump into another isolated
   container, and compares every table and sequence. This compares two fixed
   copies, not a live source that may have received new scores during the check.
6. Removes only this run's labeled temporary containers/data, even after a restore
   or comparison failure. If ownership cannot be established, it refuses removal.

Original databases are never restore targets. There is deliberately no convenient
`--clean`/overwrite-production switch. The source dump, round-trip dump and JSON
verification report remain in `.backups` for inspection. The 512 MiB limit is
appropriate for this small local rehearsal; a larger database needs a reviewed
storage/resource configuration. See [pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html).

## What this does and does not protect

- Dumps include database schema/data, but the restore intentionally omits original
  ownership and grants. Cluster roles, platform secrets and server configuration
  require separate provisioning/backups. A database dump is not a backup of the
  whole PostgreSQL server or of browser outboxes.
- Archives are compressed, **not encrypted**. They can contain player identities,
  display names and private application data. Git ignores them; do not upload them
  as CI artifacts or include them when sharing the repository.
- A local checksum detects accidental damage; it does not authenticate an untrusted
  archive. Restore only backups you trust. SQL in a dump can execute code; isolation
  here limits access but is not a promise that hostile archives are safe.
- A copy on the same disk is not disaster recovery. With the hosting owner, choose
  encrypted off-site storage, scheduled backups, retention, access controls and a
  restore rehearsal on the actual platform. Agree how much data loss and downtime
  are acceptable before going public.
- Stopping this command forcefully can interrupt cleanup. Any orphan will be named
  `landing-page-restore-<UUID>` with its restore-token label. Inspect the exact ID
  and label before removing it; never use a blanket Docker prune as cleanup.

## Verified on 2026-09-09

Read-only backups succeeded for both `events_db` and the E2E DB. The E2E archive
restored at migration version 8 with all three existing scores. A second dump and
restore matched every public table and sequence. Existing API/web/collector/DB
containers were not restarted and source data was not modified. Unit tests cover
path/ownership rejection, binary streaming, corrupt archives, restore failures and
cleanup ordering. This is not a production restore rehearsal.

## Release/recovery sequence with the hosting owner

Before release, take a backup and verify it in an isolated target. Run the pending
migrations once, start the compatible image version, then smoke-test health, pages,
a disposable score submission and statistics. Keep the previous image identified.

If the app fails, rolling back an image is only safe if the migrated schema remains
compatible. Prefer a forward fix for schema issues; do not automatically run down
migrations or restore over a live database. Restoring an older backup discards
newer writes and requires an explicit target, downtime/data-loss decision and
approval. Those production commands belong to the paired CD setup.
