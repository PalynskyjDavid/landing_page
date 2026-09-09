-- Keep the original request value: changing the leaderboard name must not
-- make a retry of an older submission fail its idempotency comparison.
ALTER TABLE scores ADD COLUMN submitted_display_name VARCHAR(24);

UPDATE scores SET submitted_display_name = display_name;

-- Repair existing rows using each player's most recent non-empty name.
WITH latest_names AS (
    SELECT DISTINCT ON (player_id) player_id, display_name
    FROM scores
    WHERE display_name IS NOT NULL
    ORDER BY player_id, created_at DESC, id DESC
)
UPDATE scores AS score
SET display_name = latest.display_name
FROM latest_names AS latest
WHERE score.player_id = latest.player_id
  AND score.display_name IS DISTINCT FROM latest.display_name;

CREATE FUNCTION prepare_score_display_name() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    -- Serialize score inserts for the same player, including their first score.
    -- The transaction releases this advisory lock automatically.
    PERFORM pg_advisory_xact_lock(
        hashtextextended('scores.player_name:' || NEW.player_id::text, 0)
    );
    NEW.display_name := NULLIF(btrim(NEW.display_name), '');
    NEW.submitted_display_name := NEW.display_name;
    RETURN NEW;
END;
$$;

CREATE FUNCTION sync_player_score_names() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    effective_name VARCHAR(24);
BEGIN
    effective_name := NEW.display_name;
    IF effective_name IS NULL THEN
        SELECT display_name INTO effective_name
        FROM scores
        WHERE player_id = NEW.player_id AND display_name IS NOT NULL
        ORDER BY created_at DESC, id DESC
        LIMIT 1;
    END IF;

    IF effective_name IS NOT NULL THEN
        UPDATE scores
        SET display_name = effective_name
        WHERE player_id = NEW.player_id
          AND display_name IS DISTINCT FROM effective_name;
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER scores_prepare_display_name
BEFORE INSERT ON scores
FOR EACH ROW EXECUTE FUNCTION prepare_score_display_name();

-- AFTER INSERT runs only for a newly inserted row, not an idempotent replay
-- skipped by ON CONFLICT DO NOTHING. Internal UPDATEs cannot recurse here.
CREATE TRIGGER scores_sync_player_names
AFTER INSERT ON scores
FOR EACH ROW EXECUTE FUNCTION sync_player_score_names();

---- create above / drop below ----

DROP TRIGGER scores_sync_player_names ON scores;
DROP TRIGGER scores_prepare_display_name ON scores;
DROP FUNCTION sync_player_score_names();
DROP FUNCTION prepare_score_display_name();

-- Restore per-submission names before removing their preserved originals.
UPDATE scores SET display_name = submitted_display_name;
ALTER TABLE scores DROP COLUMN submitted_display_name;
