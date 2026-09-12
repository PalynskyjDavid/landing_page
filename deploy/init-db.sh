#!/usr/bin/env bash
# Runs only on the FIRST initialization of the production volume. Never resets it.
(
set -euo pipefail
for name in MIGRATOR_PASSWORD API_PASSWORD COLLECTOR_PASSWORD; do
  [[ ${!name} =~ ^[a-f0-9]{64}$ ]] || { echo "Invalid $name format" >&2; exit 1; }
done
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 <<'SQL'
\getenv migrator_password MIGRATOR_PASSWORD
\getenv api_password API_PASSWORD
\getenv collector_password COLLECTOR_PASSWORD
CREATE ROLE app_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE app_api LOGIN PASSWORD :'api_password';
CREATE ROLE app_collector LOGIN PASSWORD :'collector_password';
REVOKE ALL ON DATABASE reaction FROM PUBLIC;
GRANT CONNECT ON DATABASE reaction TO app_migrator, app_api, app_collector;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO app_migrator;
GRANT USAGE ON SCHEMA public TO app_api, app_collector;
SQL
)
