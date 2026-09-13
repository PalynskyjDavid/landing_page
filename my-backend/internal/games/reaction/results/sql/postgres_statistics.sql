-- Summary and visible rows share one PostgreSQL statement/snapshot.
WITH filtered AS NOT MATERIALIZED (
    SELECT id, player_id, display_name, device_type, average_ms, best_ms, total_rounds, missclicks, created_at
    FROM scores
    WHERE (@player_id::text = '' OR player_id = NULLIF(@player_id::text, '')::uuid)
      AND (@device_type::text = '' OR device_type = @device_type::text)
      AND (@since::timestamptz IS NULL OR created_at >= @since::timestamptz)
      AND (@until::timestamptz IS NULL OR created_at < @until::timestamptz)
      AND (@player::text = '' OR strpos(lower(COALESCE(display_name, 'Anonymous')), lower(@player::text)) > 0)
      AND (@min_average::integer IS NULL OR average_ms >= @min_average::integer)
      AND (@max_average::integer IS NULL OR average_ms <= @max_average::integer)
      AND (@min_best::integer IS NULL OR best_ms >= @min_best::integer)
      AND (@max_best::integer IS NULL OR best_ms <= @max_best::integer)
      AND (@min_missclicks::integer IS NULL OR missclicks >= @min_missclicks::integer)
      AND (@max_missclicks::integer IS NULL OR missclicks <= @max_missclicks::integer)
), grouped AS NOT MATERIALIZED (
    /*GROUP*/
), eligible AS NOT MATERIALIZED (
    SELECT * FROM grouped WHERE games >= @min_games
), ranked AS (
    SELECT *, row_number() OVER (ORDER BY /*ORDER*/) AS position
    FROM eligible
    ORDER BY /*ORDER*/
    LIMIT @limit
)
SELECT jsonb_build_object(
    'summary', (
        SELECT jsonb_build_object(
            'games', COALESCE(SUM(games), 0),
            'players', COUNT(DISTINCT player_id),
            'averageMs', FLOOR(SUM(average_total) / NULLIF(SUM(games), 0))::integer,
            'bestAverageMs', MIN(best_average_ms)
        )
        FROM eligible
    ),
    'entries', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'scoreId', id, 'displayName', display_name, 'deviceType', device_type,
            'averageMs', average_ms, 'bestMs', best_ms,
            'games', games, 'totalRounds', total_rounds,
            'missclicks', missclicks, 'createdAt', created_at
        ) ORDER BY position), '[]'::jsonb)
        FROM ranked
    )
);
