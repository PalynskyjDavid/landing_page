UPDATE scores
SET submission_id = gen_random_uuid()
WHERE submission_id IS NULL;

UPDATE scores
SET player_id = gen_random_uuid()
WHERE player_id IS NULL;

ALTER TABLE scores
ALTER COLUMN submission_id SET NOT NULL,
ALTER COLUMN player_id SET NOT NULL;

CREATE INDEX scores_player_created_idx
ON scores (player_id, created_at DESC, id DESC);

---- create above / drop below ----

DROP INDEX scores_player_created_idx;

ALTER TABLE scores
ALTER COLUMN submission_id DROP NOT NULL,
ALTER COLUMN player_id DROP NOT NULL;
