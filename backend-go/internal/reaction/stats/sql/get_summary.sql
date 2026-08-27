SELECT
    id,
    total_games,
    average_reaction_ms,
    best_average_ms,
    worst_average_ms,
    average_missclicks,
    source_updated_at,
    updated_at
FROM stats_summary
WHERE id = 1;
