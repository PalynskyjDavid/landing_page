# Frontend

React/Vite game and statistics UI. Start with the [repository README](../README.md)
for setup, architecture and supported versions.

From the repository root, use `task frontend:dev`. From this folder, the equivalent
is `npm run dev -- --host localhost --port 5173 --strictPort`. Vite hot reloads
React changes; the Go API must be running separately.

`VITE_API_URL` defaults to `http://localhost:3001` in local development. For an
override, copy `.env.example` to `.env.local` and restart Vite. These variables
are public; never put secrets in them. The container build uses `/api` so NGINX
can forward requests to the Go API on the same origin.

Local scripts: `npm run test`, `npm run lint`, `npm run format:check`, and
`npm run build`. Browser tests use the root `task test:e2e` wrapper, which owns
and resets the disposable test stack; see [the E2E guide](../docs/testing/e2e.md).

The old `Dockerfile.dev` was retired with the legacy Compose app. Use host Vite
for hot reload or the tested `Dockerfile` for the containerized app.
