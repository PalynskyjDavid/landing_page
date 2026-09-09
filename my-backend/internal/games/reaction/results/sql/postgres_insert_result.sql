INSERT INTO scores (
    total_rounds,
    times,
    missclicks,
    average_ms,
    submission_id,
    player_id,
    display_name
) VALUES (
    @total_rounds,
    @times::jsonb,
    @missclicks,
    @average_ms,
    @submission_id,
    @player_id,
    @display_name
)
ON CONFLICT (submission_id) DO NOTHING
RETURNING id, created_at;
