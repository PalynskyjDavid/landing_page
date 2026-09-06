# First CI pipeline

The workflow lives in `.github/workflows/ci.yml`. This is continuous integration:
it checks changes, but does not deploy the app, publish images, or modify your
database. End-to-end browser automation is a separate next slice.

## What runs

Pushes and pull requests start two independent jobs on Ubuntu 24.04:

1. **Formatting, lint, unit tests, and builds** installs the pinned tools and
   locked frontend dependencies, then runs the same `task check` used locally.
2. **PostgreSQL migrations and integration tests** starts a fresh PostgreSQL 16
   service, applies every migration, runs migration again to check the no-op
   path, reports the schema version, and runs `task backend:test:integration`.

The jobs can run in parallel; neither needs the other's outputs. Steps inside
each job run in order and stop on failure. Each job has a 15-minute timeout.
A newer run for the same branch or pull request cancels its older unfinished run.

GitHub supplies and removes the PostgreSQL service for that job. The credentials
in the YAML are disposable test values, not production secrets. Nothing connects
to the PostgreSQL container on your computer. See GitHub's
[PostgreSQL service-container guide](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers).

## How the files connect

- `ci.yml` describes the runner, tools, service database, and order of steps.
- `Taskfile.yml` owns the actual project check commands.
- `my-backend/go.mod` selects Go; `.nvmrc` selects Node.js.
- `frontend/package-lock.json` makes `npm ci` install the recorded dependencies.
- Task 3.53.1 and golangci-lint 2.13.1 match the documented local versions.
- Go lint includes the `integration` build tag, so opt-in test code is checked
  even when a database is not running. Unit tests remain database-independent.

The external actions are pinned to full commit IDs. The comments beside them
show the corresponding release tags. Update a pin only after checking its
official release, and keep local tool versions and this document consistent.
The workflow token has only `contents: read`, checkout does not retain Git
credentials, and this pipeline requires no repository secrets.

## First run and review together

Local validation is not a GitHub-hosted run. After reviewing the commits, push
the existing branch normally. There is no need to merge it into `main` first.
Open the repository's **Actions** tab, choose **CI**, and open the latest run.

Read it from the outside in: **workflow → job → step → command output**. Expand
the first failed step if a job is red; the log should identify the same command
you can run locally. A green pipeline means these checks passed, not that every
possible game or outage scenario has been tested.

The workflow also declares `workflow_dispatch` for manual runs. GitHub normally
offers the **Run workflow** button once the workflow is on the default branch;
the initial feature-branch run is triggered by its push. See GitHub's
[manual-run documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

Branch protection and required checks are deliberately not changed here. We
will choose them after seeing a successful hosted run. Image builds, deployment,
Playwright, and other browser test frameworks are also deferred.

## Local equivalents

```powershell
task check
task backend:test:integration
```

The second command needs PostgreSQL and `DATABASE_URL`. Locally, Task can load
that URL from `.env`; GitHub provides its own URL through the job environment.
The integration tests own temporary schemas and do not modify application scores.
