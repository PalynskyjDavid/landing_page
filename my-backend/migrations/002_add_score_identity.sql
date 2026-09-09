-- Write your migrate up statements here
ALTER TABLE scores
ADD COLUMN submission_id UUID,
ADD COLUMN player_id UUID,
ADD COLUMN display_name VARCHAR(24);

ALTER TABLE scores
ADD CONSTRAINT scores_submission_id_unique
UNIQUE (submission_id);

ALTER TABLE scores
ADD CONSTRAINT scores_display_name_length
CHECK (
    display_name IS NULL
    OR length(trim(display_name)) BETWEEN 1 AND 24
);

---- create above / drop below ----

ALTER TABLE scores
DROP CONSTRAINT scores_display_name_length;

ALTER TABLE scores
DROP CONSTRAINT scores_submission_id_unique;

ALTER TABLE scores
DROP COLUMN display_name,
DROP COLUMN player_id,
DROP COLUMN submission_id;

-- Write your migrate down statements here. If this migration is irreversible
-- Then delete the separator line above.
