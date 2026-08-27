# Product Brief

## Purpose

This project is a portfolio application and a practical engineering laboratory. Its purpose is to apply theoretical software-development knowledge in a real system and demonstrate useful full-stack, architecture, testing, reliability, and delivery skills to potential employers.

The project should remain understandable enough that its author can explain every major component and tradeoff during an interview.

## Intended users

- Potential employers reviewing projects and engineering ability.
- Other visitors who want to try the included minigames.
- The developer, as a controlled environment for learning new engineering practices.

## Primary user journeys

### Portfolio journey

1. A visitor opens the home page.
2. They learn who the developer is and what the application demonstrates.
3. They browse completed projects and links to supporting material.
4. They can continue into interactive demonstrations.

### Reaction-game journey

1. A visitor starts the reaction-speed minigame.
2. The browser measures several reaction attempts.
3. The visitor sees a result summary and personal best.
4. The visitor can submit the result to the Go backend.
5. The backend validates and stores the result in PostgreSQL.
6. The visitor can view the leaderboard.

### Reliability-lab journey

1. A visitor opens an explicitly isolated reliability demonstration.
2. The demo makes the backend or database temporarily unavailable through a safe, controlled mechanism.
3. A score submission fails while the dependency is unavailable.
4. The frontend visibly records the submission as pending rather than losing it.
5. The application detects recovery and retries the submission.
6. The backend handles the retry idempotently, so the score is stored no more than once.
7. The visitor can observe what happened and why.

## First release

- Responsive portfolio home page.
- Project showcase content.
- Working reaction-speed minigame.
- Result validation and submission.
- PostgreSQL score persistence.
- Leaderboard.
- Anonymous local player identity or nickname; no account system.
- Documented local development and automated quality checks.

## Second release: reliability laboratory

- Durable pending-submission storage in the browser, likely IndexedDB.
- Explicit submission states such as pending, retrying, stored, and failed.
- Backend liveness and readiness endpoints.
- Retry with bounded exponential backoff and jitter.
- Client-generated idempotency key for each score submission.
- Backend uniqueness enforcement for idempotency keys.
- A safe outage simulation that cannot affect unrelated or production infrastructure.
- A visible event timeline explaining failure, recovery, retry, and persistence.

The first implementation may simulate an unavailable dependency at the application level. Restarting real containers or infrastructure belongs in a later isolated staging environment.

## Architecture direction

- React and Vite frontend.
- Go modular-monolith backend.
- PostgreSQL database.
- HTTP/JSON API.
- Docker Compose for local infrastructure.
- One repository and one primary backend implementation.
- Feature-oriented backend modules with clear transport, application/service, and persistence responsibilities.

The exact Go directory structure should be justified by real dependencies rather than copied mechanically from a larger application.

## Deferred capabilities

These are intentionally postponed until the application has enough business behavior to justify them:

- User authentication and accounts.
- Kubernetes.
- Microservices.
- A production-accessible infrastructure control plane.
- Distributed messaging or a dedicated queue.
- Advanced authorization and administration.
- Strong anti-cheat guarantees.

## Data for the first release

A submitted score will likely need:

- Server-generated score ID.
- Client-generated submission/idempotency ID.
- Anonymous player ID and optional display name.
- Individual reaction times.
- Number of rounds.
- Misclick count.
- Calculated average or best time.
- Creation timestamp.

The exact schema remains an API and database design task. The server must validate values and must not trust client-calculated summary fields without verification.

## Safety boundaries

- A public frontend must never receive direct Docker, database, cloud, or Kubernetes credentials.
- Real outage controls must exist only in an isolated demo or staging environment.
- Production availability must not depend on visitors behaving responsibly.
- Retry behavior must be bounded and observable; it must not create request storms.
- Duplicate retries must be safe through idempotency.

## Learning objectives

- Translate product requirements into domain and API design.
- Practice Go package boundaries, HTTP transport, validation, services, and repositories.
- Learn PostgreSQL schema design and migrations.
- Learn React through a small number of purposeful tools.
- Add useful formatting, linting, tests, and code review practices.
- Build a CI/CD pipeline from local checks through staging and production.
- Practice failure handling, idempotency, retries, health checks, observability, and recovery.
- Explain architectural decisions and tradeoffs clearly.

## First-release success criteria

- A new developer can run the system from documented instructions.
- The portfolio and reaction game work on desktop and mobile layouts.
- A valid score can be stored and appears on the leaderboard.
- Invalid scores receive a consistent API error.
- Automated checks cover formatting, linting, tests, and production builds.
- The main architecture decisions are documented and explainable.

## Reliability-release success criteria

- A submission made during a controlled outage is not silently lost.
- Recovery causes a bounded retry without requiring a page refresh.
- Retrying the same submission cannot create duplicate leaderboard entries.
- The UI clearly communicates pending and recovered states.
- The demonstration is isolated and cannot restart or damage production infrastructure.
