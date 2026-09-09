# ADR 0007: Retire the reference backends

- Status: Accepted
- Date: 2026-09-09
- Decision owners: David and Codex
- Extends: [ADR 0001](0001-use-my-backend-as-canonical-backend.md)

## Context

The canonical Go API now implements the release's scores, idempotency, statistics,
health, structured logging and shutdown behavior. Its migrations, runtime images
and browser recovery scenarios passed all three hosted CI jobs at `f300a4a`.
David authorized removing the unused `backend` and `backend-go` trees while
preparing the repository for handoff.

The remaining references from active tooling were the old services in root
`docker-compose.yml`. Neither the canonical app nor CI imports those backends.
Keeping the old default startup would let a new contributor run the wrong app.

## Decision

- Remove the tracked NestJS `backend/` and old Go `backend-go/` source trees.
- Keep `my-backend/` as the only backend module; do not rename it in this slice.
- Retire the unused `frontend/Dockerfile.dev` with the legacy Compose frontend.
- Make root Compose development **database-only**, retaining `events_db`, the
  `pgdata` volume key and the existing project naming. Never run volume deletion
  or remove existing containers as part of source cleanup.
- Use host Go/Vite tasks for editing and the existing isolated four-service stack
  for full-container demonstrations and tests. No deployment Compose is introduced.
- Preserve local ignored legacy build/dependency leftovers outside the repository.
  They are not application source and must not be committed.

Statistics were redesigned as on-demand filtered queries plus a separate telemetry
collector, not copied from the old periodic stats worker. NestJS and its example
routes are deliberately rejected. Full feature-for-feature legacy parity is not
a goal. Historical ADRs remain as dated records rather than being rewritten.

## Recovery and consequences

All retired source remains at commit
`f300a4a4c8e412afe5bdab2f7d09a6b146dfd2b1`. For example, this read-only command
shows a retired file without restoring it over the working tree:

```powershell
git show f300a4a:backend-go/README.md
```

A separate checkout of that commit can reproduce the reference tree when needed.
This removal does not purge Git history or remediate historical secrets. The
full-history secret scan, image scan, reusable backup/restore rehearsal and public
deployment remain separate release tasks.
