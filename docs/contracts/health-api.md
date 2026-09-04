# Health API Contract

The health API separates process liveness from dependency readiness. Health
routes do not create an anonymous-player cookie and do not expose internal
database errors.

## Liveness

`GET /health/live` reports whether the Go process can serve HTTP.
`GET /health` is retained as a backward-compatible alias.

Successful response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "status": "alive",
  "service": "my-backend"
}
```

Liveness deliberately does not contact PostgreSQL. Container orchestrators may
use it to decide whether the application process needs restarting.

## Readiness

`GET /health/ready` reports whether the application can currently perform its
database-backed operations. PostgreSQL is checked with a one-second timeout.

Ready response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "status": "ready",
  "dependencies": {
    "database": "available"
  }
}
```

Unavailable response:

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json
```

```json
{
  "status": "not_ready",
  "dependencies": {
    "database": "unavailable"
  }
}
```

If the API process itself is unavailable, the request fails at the network
level instead. Clients treat both an unreachable endpoint and a `503` response
as not ready.

Readiness is an observation, not a guarantee. A dependency can fail after a
successful readiness response, so normal API calls must still handle errors.
