-- Store the best time once per write instead of expanding JSON for every sort.
-- bigint intermediates also accommodate existing valid outlier samples.
ALTER TABLE scores ADD COLUMN best_ms integer GENERATED ALWAYS AS (
    LEAST((times->>0)::bigint, (times->>1)::bigint, (times->>2)::bigint,
          (times->>3)::bigint, (times->>4)::bigint)
) STORED;
CREATE INDEX scores_best_order_idx ON scores (best_ms, missclicks, created_at, id);
-- Existing (player_id, created_at) supports "mine"; this supports global dates.
CREATE INDEX scores_created_at_idx ON scores (created_at);

---- create above / drop below ----

DROP INDEX scores_created_at_idx;
DROP INDEX scores_best_order_idx;
ALTER TABLE scores DROP COLUMN best_ms;
