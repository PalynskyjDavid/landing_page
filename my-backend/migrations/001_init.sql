CREATE TABLE IF NOT EXISTS scores (
    id BIGSERIAL PRIMARY KEY,
    total_rounds INTEGER NOT NULL CHECK (total_rounds > 0),
    times JSONB NOT NULL,
    missclicks INTEGER NOT NULL DEFAULT 0 CHECK (missclicks >= 0),
    average_ms INTEGER NOT NULL CHECK (average_ms > 0),
    session_id TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stats_summary (
    id INTEGER PRIMARY KEY,
    total_games BIGINT NOT NULL DEFAULT 0,
    average_reaction_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
    best_average_ms INTEGER NOT NULL DEFAULT 0,
    worst_average_ms INTEGER NOT NULL DEFAULT 0,
    average_missclicks DOUBLE PRECISION NOT NULL DEFAULT 0,
    source_updated_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO stats_summary (
    id,
    total_games,
    average_reaction_ms,
    best_average_ms,
    worst_average_ms,
    average_missclicks,
    source_updated_at,
    updated_at
) VALUES (
    1,
    0,
    0,
    0,
    0,
    0,
    NULL,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

---- create above / drop below ----

DROP TABLE IF EXISTS stats_summary;
DROP TABLE IF EXISTS scores;
