INSERT INTO scores (
    total_rounds,
    times,
    missclicks,
    average_ms,
    session_id,
    display_name
) VALUES (
    @total_rounds,
    @times::jsonb,
    @missclicks,
    @average_ms,
    @session_id,
    @display_name
)
RETURNING id, created_at;
