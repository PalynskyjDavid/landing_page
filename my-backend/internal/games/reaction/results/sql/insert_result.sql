INSERT INTO scores (
    total_rounds,
    times,
    missclicks,
    average_ms,
    session_id
) values (
    @total_rounds,
    @times::jsonb,
    @missclicks,
    @average_ms,
    @session_id
)
RETURNING id, created_at;

-- Defines which values should be provided.