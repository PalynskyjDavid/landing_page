WITH score_metrics AS (
    SELECT
        id,
        display_name,
        average_ms,
        (
            SELECT MIN(reaction_time::integer)
            FROM jsonb_array_elements_text(times) AS reaction_times(reaction_time)
        ) AS best_ms,
        total_rounds,
        missclicks,
        created_at
    FROM scores
),
sortable_scores AS (
    SELECT
        *,
        CASE @primary_sort
            WHEN 'averageMs' THEN average_ms
            WHEN 'bestMs' THEN best_ms
            WHEN 'missclicks' THEN missclicks
        END AS primary_sort_value,
        CASE @secondary_sort
            WHEN 'averageMs' THEN average_ms
            WHEN 'bestMs' THEN best_ms
            WHEN 'missclicks' THEN missclicks
        END AS secondary_sort_value
    FROM score_metrics
),
ranked_scores AS (
    SELECT *
    FROM sortable_scores
    ORDER BY
        CASE WHEN @primary_direction = 'best' THEN primary_sort_value END ASC,
        CASE WHEN @primary_direction = 'worst' THEN primary_sort_value END DESC,
        CASE WHEN @secondary_direction = 'best' THEN secondary_sort_value END ASC,
        CASE WHEN @secondary_direction = 'worst' THEN secondary_sort_value END DESC,
        created_at ASC,
        id ASC
    LIMIT @limit
)
SELECT COALESCE(
    jsonb_agg(
        jsonb_build_object(
            'scoreId', ranked_scores.id,
            'displayName', ranked_scores.display_name,
            'averageMs', ranked_scores.average_ms,
            'bestMs', ranked_scores.best_ms,
            'totalRounds', ranked_scores.total_rounds,
            'missclicks', ranked_scores.missclicks,
            'createdAt', ranked_scores.created_at
        )
        ORDER BY
            CASE WHEN @primary_direction = 'best' THEN ranked_scores.primary_sort_value END ASC,
            CASE WHEN @primary_direction = 'worst' THEN ranked_scores.primary_sort_value END DESC,
            CASE WHEN @secondary_direction = 'best' THEN ranked_scores.secondary_sort_value END ASC,
            CASE WHEN @secondary_direction = 'worst' THEN ranked_scores.secondary_sort_value END DESC,
            ranked_scores.created_at ASC,
            ranked_scores.id ASC
    ),
    '[]'::jsonb
)
FROM ranked_scores;
