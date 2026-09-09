ALTER TABLE scores
DROP CONSTRAINT scores_total_rounds_check;

ALTER TABLE scores
ADD CONSTRAINT scores_total_rounds_five
CHECK (total_rounds = 5);

ALTER TABLE scores
ADD CONSTRAINT scores_times_five_elements
CHECK (
    CASE
        WHEN jsonb_typeof(times) = 'array'
            THEN jsonb_array_length(times) = 5
        ELSE FALSE
    END
);

---- create above / drop below ----

ALTER TABLE scores
DROP CONSTRAINT scores_times_five_elements;

ALTER TABLE scores
DROP CONSTRAINT scores_total_rounds_five;

ALTER TABLE scores
ADD CONSTRAINT scores_total_rounds_check
CHECK (total_rounds > 0);
