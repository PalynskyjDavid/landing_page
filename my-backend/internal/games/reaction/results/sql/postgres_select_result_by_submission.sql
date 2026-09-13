SELECT
    id,
    total_rounds,
    times,
    missclicks,
    average_ms,
    submission_id::text,
    player_id::text,
    -- A replay returns the original submitted name, not the mutable leaderboard name.
    submitted_display_name AS display_name,
    created_at,
    device_type
FROM scores
WHERE submission_id = @submission_id;
