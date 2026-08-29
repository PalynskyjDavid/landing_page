# Development Workflow

## Supported local versions

- Go 1.26.1, as declared by `my-backend/go.mod`.
- Node.js 22.17.0, as declared by `.nvmrc`.
- Task 3.53.1.
- golangci-lint 2.13.1.
- Prettier is installed through `frontend/package.json`.

Task and golangci-lint are developer-machine tools. Their executables are normally installed in the Go binary directory:

```powershell
go env GOPATH
```

On the current Windows machine that directory is `C:\Users\David\go\bin`. It must be present in `PATH` before `task` and `golangci-lint` can be invoked by name in a new terminal.

## Main commands

Run these from the repository root.

```powershell
task check
```

Runs the complete read-only quality gate in this order:

1. Backend and frontend formatting checks.
2. Go and JavaScript static analysis.
3. Go tests.
4. Go and frontend production builds.

The command reports problems but is not intended to rewrite source files.

```powershell
task format
```

Rewrites Go and frontend files with the configured formatters. Review the resulting Git diff before committing.

Individual groups can be run with:

```powershell
task format:check
task lint
task test
task build
```

More specific tasks are available through:

```powershell
task --list
```

## Tool responsibilities

- `.editorconfig` supplies basic encoding, newline, and indentation conventions to compatible editors.
- `gofmt` and `goimports`, run through golangci-lint, define Go formatting and import ordering.
- golangci-lint's `standard` set checks suspicious constructs, unchecked errors, ineffective assignments, static-analysis findings, and unused code.
- ESLint checks JavaScript and React code for correctness-oriented problems.
- Prettier owns frontend formatting. It does not replace ESLint.
- Task gives local development and future CI one shared command vocabulary.

## Manual-fix workflow

1. Run `task check`.
2. Read one category of findings.
3. Fix that category manually.
4. Run the narrow task for that category.
5. Review the Git diff.
6. Run `task check` before committing.

Do not run automatic dependency upgrades or broad `--fix` commands merely to make the check green. Findings should be understood before they are changed.

## Current scope

- The Go test suite is included.
- A frontend unit-test framework has not been added yet.
- CI has not been added yet.
- Vulnerability remediation is a separate reviewed task; dependency audit results are not automatically modified.

## Baseline results (2026-08-27)

Passing checks:

- Go tests (`task backend:test`).
- Go compilation (`task backend:build`).
- Vite production build (`task frontend:build`).

Known findings intentionally left for manual work:

- Go formatting is inconsistent in 14 files, mostly because of line endings; `cmd/api/main.go` also needs import ordering and `repository.go` contains extra whitespace.
- Go lint reports one unnecessary struct literal conversion and two unused `statusRecorder` declarations.
- Prettier reports 17 frontend files that do not match the configured format.
- ESLint reports unused variables/imports in `ReactionGame.jsx` and `Shell.jsx`, plus React hook memoization/export findings in `ReactionProvider.jsx`.
- The frontend dependency install reports 11 audit findings (2 low and 9 high). These require a separate dependency review before any upgrades are applied.
