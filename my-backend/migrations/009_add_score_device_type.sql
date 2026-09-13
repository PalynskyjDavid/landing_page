-- Existing rows and older clients default to computer, by product decision.
-- PostgreSQL's constant default also supplies computer for pre-migration rows.
ALTER TABLE scores ADD COLUMN device_type text NOT NULL DEFAULT 'computer'
    CONSTRAINT scores_device_type_check CHECK (device_type IN ('computer', 'mobile'));
-- Support device + time-range filtering; do not rely on a low-cardinality-only index.
CREATE INDEX scores_device_created_at_idx ON scores (device_type, created_at);

---- create above / drop below ----

-- Score rows survive rollback, but their device classification is discarded.
DROP INDEX scores_device_created_at_idx;
ALTER TABLE scores DROP COLUMN device_type;
