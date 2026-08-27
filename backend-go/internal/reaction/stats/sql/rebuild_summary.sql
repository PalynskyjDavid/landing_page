WITH aggregated AS (
    SELECT
        1 AS id,
        COUNT(*)::BIGINT AS total_games,
        COALESCE(ROUND(AVG(average_ms)::numeric, 2)::DOUBLE PRECISION, 0) AS average_reaction_ms,
        COALESCE(MIN(average_ms), 0)::INTEGER AS best_average_ms,
        COALESCE(MAX(average_ms), 0)::INTEGER AS worst_average_ms,
        COALESCE(ROUND(AVG(missclicks)::numeric, 2)::DOUBLE PRECISION, 0) AS average_missclicks,
        MAX(created_at) AS source_updated_at,
        NOW() AS updated_at
    FROM scores
)
INSERT INTO stats_summary (
    id,
    total_games,
    average_reaction_ms,
    best_average_ms,
    worst_average_ms,
    average_missclicks,
    source_updated_at,
    updated_at
)
SELECT
    id,
    total_games,
    average_reaction_ms,
    best_average_ms,
    worst_average_ms,
    average_missclicks,
    source_updated_at,
    updated_at
FROM aggregated
ON CONFLICT (id) DO UPDATE
SET
    total_games = EXCLUDED.total_games,
    average_reaction_ms = EXCLUDED.average_reaction_ms,
    best_average_ms = EXCLUDED.best_average_ms,
    worst_average_ms = EXCLUDED.worst_average_ms,
    average_missclicks = EXCLUDED.average_missclicks,
    source_updated_at = EXCLUDED.source_updated_at,
    updated_at = EXCLUDED.updated_at
WHERE
    stats_summary.source_updated_at IS DISTINCT FROM EXCLUDED.source_updated_at
    OR stats_summary.total_games IS DISTINCT FROM EXCLUDED.total_games
    OR stats_summary.average_reaction_ms IS DISTINCT FROM EXCLUDED.average_reaction_ms
    OR stats_summary.best_average_ms IS DISTINCT FROM EXCLUDED.best_average_ms
    OR stats_summary.worst_average_ms IS DISTINCT FROM EXCLUDED.worst_average_ms
    OR stats_summary.average_missclicks IS DISTINCT FROM EXCLUDED.average_missclicks
RETURNING
    id,
    total_games,
    average_reaction_ms,
    best_average_ms,
    worst_average_ms,
    average_missclicks,
    source_updated_at,
    updated_at;
