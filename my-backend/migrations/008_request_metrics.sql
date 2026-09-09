-- Only bounded, anonymous aggregates live here. Raw requests/logs stay outside DB.
CREATE TABLE request_metrics_minute (
    minute timestamptz NOT NULL,
    route text NOT NULL CHECK (route IN ('/scores', '/scores/leaderboard', '/scores/statistics', '<unmatched>')),
    method text NOT NULL CHECK (method IN ('GET', 'POST', 'OTHER')),
    requests bigint NOT NULL CHECK (requests >= 0),
    client_errors bigint NOT NULL CHECK (client_errors >= 0),
    server_errors bigint NOT NULL CHECK (server_errors >= 0),
    not_found bigint NOT NULL CHECK (not_found >= 0),
    rate_limited bigint NOT NULL CHECK (rate_limited >= 0),
    duration_ms bigint NOT NULL CHECK (duration_ms >= 0),
    PRIMARY KEY (minute, route, method)
);
-- A retry after an uncertain commit must not count the same batch twice.
CREATE TABLE telemetry_batches (
    id uuid PRIMARY KEY,
    received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX telemetry_batches_received_idx ON telemetry_batches(received_at);
CREATE TABLE telemetry_collectors (
    id uuid PRIMARY KEY,
    started_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    dropped_events bigint NOT NULL DEFAULT 0 CHECK (dropped_events >= 0)
);

---- create above / drop below ----

DROP TABLE telemetry_collectors;
DROP TABLE telemetry_batches;
DROP TABLE request_metrics_minute;
