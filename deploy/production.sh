#!/usr/bin/env bash
# Linux server helper. Never source an .env file as executable shell code.
set -euo pipefail
umask 077
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
fail() { echo "$*" >&2; exit 1; }
usage() {
  echo "Usage: bash deploy/production.sh init DOMAIN | check | build | up | backup | restore-check FILE | smoke | status | rollback COMMIT --schema-compatible"
}
command="${1:-}"
case "$command" in
  init|restore-check) [[ $# == 2 ]] || { usage; exit 1; } ;;
  rollback) [[ $# == 3 && $3 == --schema-compatible ]] || { usage; exit 1; } ;;
  check|build|up|backup|smoke|status) [[ $# == 1 ]] || { usage; exit 1; } ;;
  *) usage; exit 1 ;;
esac

valid_domain() {
  [[ $1 =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ &&
     $1 != example.com && $1 != *.example && $1 != *.invalid && ${#1} -le 253 ]]
}
config="$root/deploy/.env"
if [[ $command == init ]]; then
  valid_domain "$2" || fail "Supply your real lowercase domain, without https:// or a path."
  [[ ! -e $config && ! -L $config ]] || fail "deploy/.env already exists; refusing to overwrite secrets."
  command -v openssl >/dev/null || fail "Install openssl first."
  # Generate everything before writing, then create exclusively with mode 600.
  passwords=()
  for index in 1 2 3 4; do passwords+=("$(openssl rand -hex 32)"); done
  (set -o noclobber
   printf 'DOMAIN=%s\nADMIN_PASSWORD=%s\nMIGRATOR_PASSWORD=%s\nAPI_PASSWORD=%s\nCOLLECTOR_PASSWORD=%s\n' \
     "$2" "${passwords[@]}" > "$config")
  echo "Created deploy/.env. Keep an encrypted off-server copy; never commit or paste its contents."
  exit 0
fi

[[ -f $config && ! -L $config ]] || fail "Run init first; deploy/.env must be a regular file."
case "$(stat -c %a "$config")" in 600|400) ;; *) fail "Run chmod 600 deploy/.env before continuing." ;; esac
declare -A values=()
while IFS= read -r line || [[ -n $line ]]; do
  line="${line%$'\r'}"
  [[ -z $line || $line == \#* ]] && continue
  [[ $line == *=* ]] || fail "Invalid deploy/.env line."
  key="${line%%=*}"
  value="${line#*=}"
  case "$key" in DOMAIN|ADMIN_PASSWORD|MIGRATOR_PASSWORD|API_PASSWORD|COLLECTOR_PASSWORD) ;; *) fail "Unknown deploy/.env key." ;; esac
  [[ ! -v values[$key] ]] || fail "Duplicate deploy/.env key: $key."
  values[$key]="$value"
done < "$config"
valid_domain "${values[DOMAIN]:-}" || fail "Invalid DOMAIN."
for key in ADMIN_PASSWORD MIGRATOR_PASSWORD API_PASSWORD COLLECTOR_PASSWORD; do
  [[ ${values[$key]:-} =~ ^[a-f0-9]{64}$ ]] || fail "$key must contain exactly 64 lowercase hex characters."
done
# Deliberately override inherited shell values with this deployment's validated file.
for key in "${!values[@]}"; do export "$key=${values[$key]}"; done
export RELEASE
RELEASE="$(git rev-parse --verify HEAD)"
if [[ $command == rollback ]]; then
  [[ $2 =~ ^[a-f0-9]{40}$ ]] || fail "Rollback requires a full 40-character commit SHA."
  RELEASE="$2"
fi
unset COMPOSE_FILE COMPOSE_PROFILES COMPOSE_PROJECT_NAME
dc() { docker compose --project-name landing-page-prod --env-file "$config" -f "$root/compose.prod.yml" "$@"; }
dc config --quiet

clean_checkout() {
  git diff --quiet && git diff --cached --quiet || fail "Commit or save tracked changes before releasing."
  [[ -z "$(git ls-files --others --exclude-standard)" ]] || fail "Release from a clean checkout without untracked source files."
}
lock() {
  mkdir -p "$root/.deploy"
  exec 9>"$root/.deploy/production.lock"
  flock -n 9 || fail "Another deployment/backup operation is running."
}
backup() {
  mkdir -p "$root/.backups/production"
  local partial final
  partial="$(mktemp "$root/.backups/production/db-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.dump.partial")"
  dc exec -T db pg_dump --username postgres --dbname reaction --format custom > "$partial"
  [[ -s $partial ]] || fail "Empty backup; deployment stopped."
  dc exec -T db pg_restore --list < "$partial" >/dev/null
  final="${partial%.partial}"
  mv -- "$partial" "$final"
  echo "Backup: $final (copy encrypted off this server; .partial files are incomplete)."
}
images_exist() {
  local service
  for service in api web collector migrate; do
    docker image inspect "landing-page-$service:$RELEASE" >/dev/null 2>&1 ||
      fail "Missing local $service image for $RELEASE. Run build first; rollback requires retained images."
  done
}
smoke() {
  local route
  for route in /healthz /api/health/ready /game /statistics /api/scores/leaderboard /api/system/statistics; do
    curl --fail --silent --show-error --output /dev/null --max-time 15 --retry 3 \
      --retry-delay 2 --retry-connrefused "https://$DOMAIN$route"
    echo "OK $route"
  done
}
start_apps() {
  dc up -d --wait --wait-timeout 120 --no-build --pull never api web
  # Collector shares web's namespace, so always rebind after web replacement.
  dc up -d --wait --wait-timeout 60 --no-deps --force-recreate --no-build --pull never collector
  dc up -d --wait --wait-timeout 60 --no-deps --no-build --pull never edge
  smoke
  printf '%s\n' "$RELEASE" > "$root/.deploy/last-successful-release"
  echo "Healthy release: $RELEASE. No database down migration was performed."
}
case "$command" in
  check) echo "Configuration is valid. This does not test DNS, TLS or database connectivity." ;;
  status) dc ps ;;
  smoke) smoke ;;
  build)
    clean_checkout
    lock
    # These images stay on this server; no registry push or public deployment.
    dc build api web collector migrate
    ;;
  up)
    clean_checkout
    lock
    images_exist
    dc pull db edge
    dc up -d --wait --wait-timeout 120 --no-build --pull never db
    backup
    # A failure here leaves existing app containers alone. Inspect before retrying.
    dc run --rm --no-deps --no-build --pull never migrate
    dc exec -T db psql --username postgres --dbname reaction --set ON_ERROR_STOP=1 < "$root/deploy/grants.sql"
    start_apps
    ;;
  backup) lock; backup ;;
  restore-check)
    [[ -f $2 && $2 == *.dump ]] || fail "Supply an existing completed .dump backup."
    lock
    # Only this scratch service is removed; it has no volume, network or host port.
    trap 'dc rm --stop --force restore-check >/dev/null' EXIT
    dc up -d --wait --wait-timeout 120 --no-deps --force-recreate restore-check
    dc exec -T restore-check pg_restore --username postgres --dbname reaction \
      --no-owner --no-privileges --exit-on-error < "$2"
    dc exec -T restore-check psql --username postgres --dbname reaction --set ON_ERROR_STOP=1 \
      --command 'SELECT * FROM public.schema_version; SELECT count(*) AS restored_scores FROM public.scores;'
    echo "Scratch restore passed. Production data was not modified."
    ;;
  rollback)
    lock
    images_exist
    backup
    echo "Rolling back app images only. You confirmed compatibility with the CURRENT schema."
    start_apps
    ;;
esac
