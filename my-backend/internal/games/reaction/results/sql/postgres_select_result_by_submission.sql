SELECT
    id,
    total_rounds,
    times,
    missclicks,
    average_ms,
    submission_id::text,
    player_id::text,
    display_name,
    created_at
FROM scores
WHERE submission_id = @submission_id;
