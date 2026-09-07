-- Data reset, not a down migration: keep tables, constraints, triggers and version.
-- This file is run once at setup and again BEFORE each independent browser test.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10s';

DO $$
BEGIN
    IF current_database() <> 'reaction_e2e' OR current_user <> 'e2e_user' THEN
        RAISE EXCEPTION 'Refusing to reset anything except the E2E database';
    END IF;
END;
$$;

TRUNCATE TABLE public.scores, public.stats_summary RESTART IDENTITY;

-- Each scenario starts with an empty leaderboard and zeroed summary counters.
INSERT INTO public.stats_summary (id, updated_at)
VALUES (1, TIMESTAMPTZ '2000-01-01 00:00:00+00');
COMMIT;
