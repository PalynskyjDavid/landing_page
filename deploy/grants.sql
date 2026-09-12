-- Reviewed alongside migrations; new tables are NOT automatically writable by apps.
-- The migrator owns the schema objects. Runtime accounts cannot perform DDL.
BEGIN;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_api, app_collector;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_api, app_collector;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT SELECT, INSERT ON scores TO app_api;
-- The name-sync trigger updates previous submissions for the same player.
GRANT UPDATE (display_name) ON scores TO app_api;
GRANT USAGE ON SEQUENCE scores_id_seq TO app_api;
GRANT EXECUTE ON FUNCTION prepare_score_display_name(), sync_player_score_names() TO app_api;
GRANT SELECT ON stats_summary, request_metrics_minute, telemetry_collectors TO app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON request_metrics_minute, telemetry_batches,
    telemetry_collectors TO app_collector;
COMMIT;
