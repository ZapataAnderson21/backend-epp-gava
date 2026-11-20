#!/usr/bin/env bash

# REFERENCE ONLY — DO NOT INSTALL OR EXECUTE AS THE VPS PUBLISHER.
#
# Compare these functions with /opt/deploy/publish-backend-epp.sh and merge only
# the reviewed preflight, manifest, backup and migration steps. The real script
# owns the existing flock, release publication, PM2, health check and code
# rollback behavior. Direct execution of this file always fails closed.

set -Eeuo pipefail

die() {
  printf 'Error: %s\n' "$*" >&2
  return 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "No se encontró el comando requerido: $1"
}

require_variable() {
  local name="$1"
  [[ -n "${!name:-}" ]] || die "Falta configurar la variable protegida: $name"
}

pg_major_from_version() {
  local version_text="$1"
  local version
  version="$(printf '%s\n' "$version_text" | grep -Eo '[0-9]+([.][0-9]+)+' | head -n 1)"
  [[ -n "$version" ]] || die 'No se pudo identificar la versión del cliente PostgreSQL.'
  printf '%s\n' "${version%%.*}"
}

server_major_from_num() {
  local version_num="$1"
  [[ "$version_num" =~ ^[0-9]+$ ]] || die 'server_version_num no es numérico.'
  printf '%s\n' "$((version_num / 10000))"
}

verify_protected_credentials() {
  require_variable PGPASSFILE
  [[ -f "$PGPASSFILE" ]] || die 'PGPASSFILE no existe.'

  local mode owner
  mode="$(stat -c '%a' "$PGPASSFILE")"
  owner="$(stat -c '%u' "$PGPASSFILE")"
  [[ "$mode" == '600' || "$mode" == '400' ]] ||
    die 'PGPASSFILE debe tener permisos 0600 o 0400.'
  [[ "$owner" == "$(id -u)" ]] || die 'PGPASSFILE debe pertenecer al usuario de despliegue.'
}

verify_postgres_connection_and_tools() {
  local psql_bin="${PSQL_BIN:-psql}"
  local pg_dump_bin="${PG_DUMP_BIN:-pg_dump}"
  local pg_restore_bin="${PG_RESTORE_BIN:-pg_restore}"

  require_variable PGHOST
  require_variable PGPORT
  require_variable PGDATABASE
  require_variable PGUSER
  require_variable DATABASE_URL
  verify_protected_credentials

  require_command "$psql_bin"
  require_command "$pg_dump_bin"
  require_command "$pg_restore_bin"

  local server_version_num server_major dump_major restore_major
  server_version_num="$(
    "$psql_bin" -X --no-psqlrc --no-password -v ON_ERROR_STOP=1 -At \
      --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
      --dbname="$PGDATABASE" -c 'SHOW server_version_num'
  )"
  server_major="$(server_major_from_num "$server_version_num")"
  dump_major="$(pg_major_from_version "$("$pg_dump_bin" --version)")"
  restore_major="$(pg_major_from_version "$("$pg_restore_bin" --version)")"

  ((server_major >= 10)) ||
    die 'La referencia requiere revisión adicional para PostgreSQL anterior a 10.'
  ((dump_major >= server_major)) ||
    die 'pg_dump es anterior al servidor PostgreSQL y no puede respaldarlo con seguridad.'
  [[ "$restore_major" == "$dump_major" ]] ||
    die 'pg_dump y pg_restore deben provenir de la misma versión mayor.'

  "$psql_bin" -X --no-psqlrc --no-password -v ON_ERROR_STOP=1 -At \
    --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
    --dbname="$PGDATABASE" -c 'SELECT 1' | grep -qx '1' ||
    die 'La validación de conexión PostgreSQL falló.'

  printf 'PostgreSQL validado: servidor major %s; pg_dump major %s.\n' \
    "$server_major" "$dump_major"
}

verify_prisma_and_backup_target_match() {
  local psql_bin="${PSQL_BIN:-psql}"
  local backup_target prisma_target

  require_command node
  backup_target="$(
    "$psql_bin" -X --no-psqlrc --no-password -v ON_ERROR_STOP=1 -At \
      --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
      --dbname="$PGDATABASE" \
      -c "SELECT current_database() || '|' || COALESCE(inet_server_addr()::text, 'local') || '|' || inet_server_port()::text"
  )"
  prisma_target="$(
    cd "$BACKEND_PATH"
    node <<'NODE'
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT current_database() || '|' || COALESCE(inet_server_addr()::text, 'local') || '|' || inet_server_port()::text AS target",
    );
    process.stdout.write(String(result.rows[0].target));
  } catch {
    console.error('No se pudo validar el destino configurado en DATABASE_URL.');
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
})();
NODE
  )"

  [[ -n "$backup_target" && "$backup_target" == "$prisma_target" ]] ||
    die 'PG* y DATABASE_URL no apuntan al mismo servidor y base de datos.'
}

verify_backup_space() {
  local backup_dir="$1"
  local psql_bin="${PSQL_BIN:-psql}"
  local reserve_bytes="${BACKUP_FREE_RESERVE_BYTES:-1073741824}"
  local database_bytes available_kb available_bytes required_bytes

  [[ "$reserve_bytes" =~ ^[0-9]+$ ]] || die 'BACKUP_FREE_RESERVE_BYTES debe ser numérico.'
  database_bytes="$(
    "$psql_bin" -X --no-psqlrc --no-password -v ON_ERROR_STOP=1 -At \
      --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
      --dbname="$PGDATABASE" -c 'SELECT pg_database_size(current_database())'
  )"
  [[ "$database_bytes" =~ ^[0-9]+$ ]] || die 'No se pudo calcular el tamaño de la base.'

  available_kb="$(df -Pk "$backup_dir" | awk 'NR == 2 {print $4}')"
  [[ "$available_kb" =~ ^[0-9]+$ ]] || die 'No se pudo calcular el espacio disponible.'
  available_bytes="$((available_kb * 1024))"
  required_bytes="$((database_bytes + reserve_bytes))"

  ((available_bytes >= required_bytes)) ||
    die 'No existe espacio suficiente para un backup previo verificable.'
}

create_verified_backup() {
  local deploy_commit="$1"
  local backup_dir="${BACKUP_DIR:-/var/backups/backend-epp}"
  local pg_dump_bin="${PG_DUMP_BIN:-pg_dump}"
  local pg_restore_bin="${PG_RESTORE_BIN:-pg_restore}"
  local timestamp partial_path backup_path checksum_path

  install -d -m 0700 "$backup_dir"
  verify_backup_space "$backup_dir"

  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_path="$backup_dir/predeploy-${timestamp}-${deploy_commit}.dump"
  partial_path="${backup_path}.partial"
  checksum_path="${backup_path}.sha256"

  rm -f -- "$partial_path"
  umask 077

  if ! "$pg_dump_bin" \
    --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
    --dbname="$PGDATABASE" --format=custom --compress=6 \
    --no-owner --no-privileges --file="$partial_path"; then
    rm -f -- "$partial_path"
    die 'pg_dump no pudo completar el backup.'
  fi

  if [[ ! -s "$partial_path" ]]; then
    rm -f -- "$partial_path"
    die 'pg_dump generó un archivo vacío.'
  fi
  if ! "$pg_restore_bin" --list "$partial_path" >/dev/null; then
    rm -f -- "$partial_path"
    die 'pg_restore no pudo inspeccionar el backup.'
  fi
  mv -- "$partial_path" "$backup_path"
  chmod 0600 "$backup_path"
  sha256sum "$backup_path" >"$checksum_path"
  chmod 0600 "$checksum_path"
  (cd "$backup_dir" && sha256sum --check "$(basename "$checksum_path")") >/dev/null

  printf 'Backup previo verificado: %s\n' "$backup_path"
}

migration_manifest_sha256() {
  local backend_path="$1"
  (
    cd "$backend_path"
    find prisma/migrations -type f -name migration.sql -print0 \
      | sort -z \
      | xargs -0 sha256sum \
      | sha256sum \
      | awk '{print $1}'
  )
}

verify_commit_and_migration_manifest() {
  local backend_path="$1"
  local deploy_commit="$2"
  local current_commit migration_count schema_sha256 migrations_sha256

  require_variable EXPECTED_MIGRATION_COUNT
  require_variable EXPECTED_MIGRATIONS_SHA256
  require_variable EXPECTED_SCHEMA_SHA256

  current_commit="$(git -C "$backend_path" rev-parse HEAD)"
  [[ "$current_commit" == "$deploy_commit" ]] ||
    die 'El checkout del VPS no coincide con DEPLOY_COMMIT.'
  [[ "$(git -C "$backend_path" rev-parse origin/main)" == "$deploy_commit" ]] ||
    die 'origin/main del VPS no coincide con DEPLOY_COMMIT.'

  [[ -z "$(
    git -C "$backend_path" status --porcelain -- \
      prisma/schema.prisma prisma/migrations prisma.config.ts package.json package-lock.json \
      scripts/run-idempotent-sql.cjs
  )" ]] ||
    die 'Los archivos de despliegue difieren del commit autorizado.'

  migration_count="$(
    find "$backend_path/prisma/migrations" -mindepth 1 -maxdepth 1 -type d \
      | wc -l | tr -d ' '
  )"
  schema_sha256="$(sha256sum "$backend_path/prisma/schema.prisma" | awk '{print $1}')"
  migrations_sha256="$(migration_manifest_sha256 "$backend_path")"

  [[ "$migration_count" == "$EXPECTED_MIGRATION_COUNT" ]] ||
    die 'La cantidad de migraciones del VPS no coincide con GitHub Actions.'
  [[ "$schema_sha256" == "$EXPECTED_SCHEMA_SHA256" ]] ||
    die 'schema.prisma del VPS no coincide con GitHub Actions.'
  [[ "$migrations_sha256" == "$EXPECTED_MIGRATIONS_SHA256" ]] ||
    die 'El manifiesto de migraciones del VPS no coincide con GitHub Actions.'

  printf 'Commit y manifiestos verificados: %s (%s migraciones).\n' \
    "$deploy_commit" "$migration_count"
}

reference_deploy_sequence() {
  local staging_dir="$1"
  local deploy_commit="$2"

  # These hooks represent logic that must be preserved from the real VPS
  # script. They are intentionally undefined in this reference.
  existing_acquire_flock
  existing_fetch_verify_and_checkout "$deploy_commit"
  existing_validate_staging_artifact "$staging_dir"

  verify_commit_and_migration_manifest "$BACKEND_PATH" "$deploy_commit"

  (
    cd "$BACKEND_PATH"
    npm ci --omit=dev --no-audit --no-fund
  )

  verify_postgres_connection_and_tools
  verify_prisma_and_backup_target_match
  create_verified_backup "$deploy_commit"

  # Any non-zero exit stops here, before the new release is activated.
  (
    cd "$BACKEND_PATH"
    npm run prisma:migrate:deploy
  )

  # No db:apply-idempotent step: the 89 official migrations own the schema.
  existing_publish_build "$staging_dir" "$deploy_commit"
  existing_restart_pm2
  existing_health_check_or_restore_previous_code
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  cat >&2 <<'EOF'
Este archivo es una referencia, no un reemplazo instalable.
Compáralo primero con /opt/deploy/publish-backend-epp.sh y conserva la lógica
real de flock, publicación, PM2, health check y rollback de código.
EOF
  exit 64
fi
