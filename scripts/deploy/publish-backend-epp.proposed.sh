#!/usr/bin/env bash

# PROPOSED INTEGRATION — DO NOT INSTALL AS THE VPS PUBLISHER UNTIL THE
# ISOLATED RESTORE REHEARSAL AND THE SUPERVISED DEPLOYMENT CHECKLIST PASS.

set -Eeuo pipefail

APP_DIR="${BACKEND_PATH:-/root/backend-epp-gava}"
PM2_APP="${PM2_APP:-backend-epp-gava}"
LOCK_FILE="${LOCK_FILE:-/var/lock/sir-gava-deploy.lock}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/documentation}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/backend-epp}"
BACKUP_FREE_RESERVE_BYTES="${BACKUP_FREE_RESERVE_BYTES:-1073741824}"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-/etc/sir-gava/backend-deploy.env}"

STAGING_DIR=''
DEPLOY_COMMIT=''
PREVIOUS_COMMIT=''
PREVIOUS_DIST_DIR=''
CANDIDATE_DIST_DIR=''
HAS_PREVIOUS_DIST=0
ACTIVATED=0

die() {
  printf 'Error: %s\n' "$*" >&2
  return 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "No está disponible el comando requerido: $1"
}

require_variable() {
  local name="$1"
  [[ -n "${!name:-}" ]] || die "Falta configurar la variable protegida: $name"
}

artifact_manifest_sha256() {
  local directory="$1"
  (
    cd "$directory"
    find . -type f -print0 \
      | sort -z \
      | xargs -0 sha256sum \
      | sha256sum \
      | awk '{print $1}'
  )
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

validate_arguments_and_artifact() {
  [[ "$#" -eq 2 ]] || die "Uso: $0 <directorio-del-artefacto> <commit>"

  STAGING_DIR="$(realpath -e "$1")"
  DEPLOY_COMMIT="$2"

  case "$STAGING_DIR" in
    /tmp/backend-epp-*) ;;
    *) die "Directorio temporal no permitido: $STAGING_DIR" ;;
  esac

  [[ "$DEPLOY_COMMIT" =~ ^[0-9a-f]{40}$ ]] ||
    die 'Identificador de commit inválido.'
  [[ -s "$STAGING_DIR/main.js" ]] ||
    die 'El artefacto no contiene main.js.'
  [[ -d "$STAGING_DIR/generated/prisma" ]] ||
    die 'El artefacto no contiene Prisma Client.'
  ! find "$STAGING_DIR" -type l -print -quit | grep -q . ||
    die 'El artefacto contiene enlaces simbólicos.'
  [[ -d "$APP_DIR/.git" ]] ||
    die "No se encontró el repositorio en $APP_DIR."
}

load_node_runtime() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  fi
}

load_protected_deploy_environment() {
  [[ -f "$DEPLOY_ENV_FILE" ]] ||
    die "No existe el archivo protegido de despliegue: $DEPLOY_ENV_FILE"

  local mode owner
  mode="$(stat -c '%a' "$DEPLOY_ENV_FILE")"
  owner="$(stat -c '%u' "$DEPLOY_ENV_FILE")"
  [[ "$mode" == '600' || "$mode" == '400' ]] ||
    die 'El archivo de despliegue debe tener permisos 0600 o 0400.'
  [[ "$owner" == "$(id -u)" ]] ||
    die 'El archivo de despliegue debe pertenecer al usuario ejecutor.'
  ! grep -Eq \
    '^[[:space:]]*(export[[:space:]]+)?(EXPECTED_|BACKEND_PATH|STAGING_DIR|DEPLOY_COMMIT)=' \
    "$DEPLOY_ENV_FILE" ||
    die 'El archivo protegido intenta sobrescribir datos autorizados por GitHub.'

  set -a
  # shellcheck source=/dev/null
  . "$DEPLOY_ENV_FILE"
  set +a
}

verify_required_commands() {
  local required_command
  for required_command in \
    git npm node pm2 rsync flock curl realpath find sort xargs sha256sum \
    grep awk wc tr date mktemp mv chmod rm seq sleep id basename \
    psql pg_dump pg_restore df stat install; do
    require_command "$required_command"
  done
}

acquire_deploy_lock() {
  printf 'Esperando el bloqueo compartido de despliegue...\n'
  exec 9>"$LOCK_FILE"
  flock -w 900 9 ||
    die 'Otro despliegue ocupó el bloqueo durante más de 15 minutos.'
  printf 'Bloqueo de despliegue adquirido.\n'
}

prepare_rollback_context() {
  PREVIOUS_COMMIT="$(git -C "$APP_DIR" rev-parse HEAD)"
  PREVIOUS_DIST_DIR="$(mktemp -d "$APP_DIR/.dist-previous.XXXXXX")"
  CANDIDATE_DIST_DIR="$(mktemp -d "$APP_DIR/.dist-candidate.XXXXXX")"

  if [[ -d "$APP_DIR/dist" ]]; then
    rsync -a "$APP_DIR/dist/" "$PREVIOUS_DIST_DIR/" ||
      die 'No se pudo preservar el build anterior.'
    HAS_PREVIOUS_DIST=1
  fi
}

checkout_authorized_commit() {
  printf 'Actualizando código al commit %s...\n' "$DEPLOY_COMMIT"
  git -C "$APP_DIR" fetch origin main
  git -C "$APP_DIR" cat-file -e "${DEPLOY_COMMIT}^{commit}" ||
    die 'El commit no está disponible en el repositorio del VPS.'
  [[ "$(git -C "$APP_DIR" rev-parse origin/main)" == "$DEPLOY_COMMIT" ]] ||
    die 'El commit autorizado no coincide con el HEAD actual de origin/main.'

  git -C "$APP_DIR" reset --hard "$DEPLOY_COMMIT"
  git -C "$APP_DIR" clean -fd -- src/generated/prisma
}

verify_commit_and_manifests() {
  require_variable EXPECTED_MIGRATION_COUNT
  require_variable EXPECTED_MIGRATIONS_SHA256
  require_variable EXPECTED_SCHEMA_SHA256
  require_variable EXPECTED_ARTIFACT_SHA256

  local current_commit migration_count schema_sha256 migrations_sha256 artifact_sha256
  current_commit="$(git -C "$APP_DIR" rev-parse HEAD)"
  [[ "$current_commit" == "$DEPLOY_COMMIT" ]] ||
    die 'El checkout del VPS no coincide con DEPLOY_COMMIT.'

  [[ -z "$(
    git -C "$APP_DIR" status --porcelain -- \
      prisma/schema.prisma prisma/migrations prisma.config.ts \
      package.json package-lock.json scripts/run-idempotent-sql.cjs
  )" ]] || die 'Los archivos de despliegue difieren del commit autorizado.'

  migration_count="$(
    find "$APP_DIR/prisma/migrations" -mindepth 1 -maxdepth 1 -type d \
      | wc -l | tr -d ' '
  )"
  schema_sha256="$(sha256sum "$APP_DIR/prisma/schema.prisma" | awk '{print $1}')"
  migrations_sha256="$(migration_manifest_sha256 "$APP_DIR")"
  artifact_sha256="$(artifact_manifest_sha256 "$STAGING_DIR")"

  [[ "$migration_count" == "$EXPECTED_MIGRATION_COUNT" ]] ||
    die 'La cantidad de migraciones no coincide con GitHub Actions.'
  [[ "$schema_sha256" == "$EXPECTED_SCHEMA_SHA256" ]] ||
    die 'schema.prisma no coincide con GitHub Actions.'
  [[ "$migrations_sha256" == "$EXPECTED_MIGRATIONS_SHA256" ]] ||
    die 'El manifiesto de migraciones no coincide con GitHub Actions.'
  [[ "$artifact_sha256" == "$EXPECTED_ARTIFACT_SHA256" ]] ||
    die 'El artefacto no coincide con GitHub Actions.'

  printf 'Commit, schema, migraciones y artefacto verificados.\n'
}

install_production_dependencies() {
  printf 'Instalando únicamente dependencias de producción...\n'
  (
    cd "$APP_DIR"
    npm ci --omit=dev --no-audit --no-fund --prefer-offline
  )
}

verify_protected_credentials() {
  require_variable PGPASSFILE
  [[ -f "$PGPASSFILE" ]] || die 'PGPASSFILE no existe.'

  local mode owner
  mode="$(stat -c '%a' "$PGPASSFILE")"
  owner="$(stat -c '%u' "$PGPASSFILE")"
  [[ "$mode" == '600' || "$mode" == '400' ]] ||
    die 'PGPASSFILE debe tener permisos 0600 o 0400.'
  [[ "$owner" == "$(id -u)" ]] ||
    die 'PGPASSFILE debe pertenecer al usuario de despliegue.'
}

postgres_target_via_pg_env() {
  psql -X --no-psqlrc --no-password -v ON_ERROR_STOP=1 -At \
    --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    -c "SELECT current_database() || '|' || COALESCE(inet_server_addr()::text, 'local') || '|' || COALESCE(inet_server_port()::text, 'local')"
}

postgres_target_via_database_url() {
  (
    cd "$APP_DIR"
    node <<'NODE'
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const result = await client.query(
      "SELECT current_database() || '|' || COALESCE(inet_server_addr()::text, 'local') || '|' || COALESCE(inet_server_port()::text, 'local') AS target",
    );
    process.stdout.write(String(result.rows[0].target));
  } catch {
    console.error('No se pudo validar PostgreSQL mediante DATABASE_URL.');
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
})();
NODE
  )
}

verify_postgres_preflight() {
  require_variable PGHOST
  require_variable PGPORT
  require_variable PGDATABASE
  require_variable PGUSER
  require_variable DATABASE_URL
  verify_protected_credentials

  local server_version_num server_major dump_major restore_major pg_target url_target
  server_version_num="$(
    psql -X --no-psqlrc --no-password -v ON_ERROR_STOP=1 -At \
      --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
      --dbname="$PGDATABASE" -c 'SHOW server_version_num'
  )"
  server_major="$(server_major_from_num "$server_version_num")"
  dump_major="$(pg_major_from_version "$(pg_dump --version)")"
  restore_major="$(pg_major_from_version "$(pg_restore --version)")"

  ((server_major >= 10)) ||
    die 'PostgreSQL anterior a 10 requiere una revisión específica.'
  ((dump_major >= server_major)) ||
    die 'pg_dump es anterior al servidor PostgreSQL.'
  [[ "$restore_major" == "$dump_major" ]] ||
    die 'pg_dump y pg_restore deben tener la misma versión mayor.'

  pg_target="$(postgres_target_via_pg_env)"
  url_target="$(postgres_target_via_database_url)"
  [[ -n "$pg_target" && "$pg_target" == "$url_target" ]] ||
    die 'PG* y DATABASE_URL no apuntan al mismo servidor y base de datos.'

  printf 'PostgreSQL validado: servidor major %s; pg_dump major %s.\n' \
    "$server_major" "$dump_major"
}

verify_database_available() {
  local target
  target="$(postgres_target_via_database_url)"
  [[ -n "$target" ]] || die 'PostgreSQL no está disponible mediante DATABASE_URL.'
  printf 'Disponibilidad PostgreSQL confirmada mediante DATABASE_URL.\n'
}

verify_backup_space() {
  local database_bytes available_kb available_bytes required_bytes
  [[ "$BACKUP_FREE_RESERVE_BYTES" =~ ^[0-9]+$ ]] ||
    die 'BACKUP_FREE_RESERVE_BYTES debe ser numérico.'
  install -d -m 0700 "$BACKUP_DIR"

  database_bytes="$(
    psql -X --no-psqlrc --no-password -v ON_ERROR_STOP=1 -At \
      --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
      --dbname="$PGDATABASE" -c 'SELECT pg_database_size(current_database())'
  )"
  [[ "$database_bytes" =~ ^[0-9]+$ ]] ||
    die 'No se pudo calcular el tamaño de la base.'
  available_kb="$(df -Pk "$BACKUP_DIR" | awk 'NR == 2 {print $4}')"
  [[ "$available_kb" =~ ^[0-9]+$ ]] ||
    die 'No se pudo calcular el espacio disponible.'
  available_bytes="$((available_kb * 1024))"
  required_bytes="$((database_bytes + BACKUP_FREE_RESERVE_BYTES))"
  ((available_bytes >= required_bytes)) ||
    die 'No existe espacio suficiente para un backup previo verificable.'
}

create_verified_backup() {
  verify_backup_space

  local timestamp partial_path backup_path checksum_path
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_path="$BACKUP_DIR/predeploy-${timestamp}-${DEPLOY_COMMIT}.dump"
  partial_path="${backup_path}.partial"
  checksum_path="${backup_path}.sha256"

  rm -f -- "$partial_path"
  umask 077
  if ! pg_dump \
    --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
    --dbname="$PGDATABASE" --format=custom --compress=6 \
    --no-owner --no-privileges --file="$partial_path"; then
    rm -f -- "$partial_path"
    die 'pg_dump no pudo completar el backup.'
  fi
  [[ -s "$partial_path" ]] || {
    rm -f -- "$partial_path"
    die 'pg_dump generó un archivo vacío.'
  }
  pg_restore --list "$partial_path" >/dev/null || {
    rm -f -- "$partial_path"
    die 'pg_restore no pudo inspeccionar el backup.'
  }

  mv -- "$partial_path" "$backup_path"
  chmod 0600 "$backup_path"
  sha256sum "$backup_path" >"$checksum_path"
  chmod 0600 "$checksum_path"
  (cd "$BACKUP_DIR" && sha256sum --check "$(basename "$checksum_path")") >/dev/null
  printf 'Backup previo verificado: %s\n' "$backup_path"
}

run_prisma_migrations() {
  printf 'Ejecutando migraciones oficiales de Prisma...\n'
  (
    cd "$APP_DIR"
    npm run prisma:migrate:deploy
  )
}

install_candidate_artifact() {
  printf 'Preparando el build recibido desde GitHub...\n'
  rsync -a --delete "$STAGING_DIR/" "$CANDIDATE_DIST_DIR/" ||
    die 'rsync no pudo preparar el build candidato.'
  [[ -s "$CANDIDATE_DIST_DIR/main.js" ]] ||
    die 'El build candidato no contiene main.js.'
  [[ "$(artifact_manifest_sha256 "$CANDIDATE_DIST_DIR")" == "$EXPECTED_ARTIFACT_SHA256" ]] ||
    die 'El build candidato cambió durante la instalación.'

  rm -rf -- "$APP_DIR/dist"
  mv -- "$CANDIDATE_DIST_DIR" "$APP_DIR/dist"
  CANDIDATE_DIST_DIR=''
}

restart_backend() {
  pm2 restart "$PM2_APP" --update-env
  ACTIVATED=1
}

check_http_health() {
  local attempt
  for attempt in $(seq 1 20); do
    if curl --fail --silent --show-error --max-time 3 "$HEALTH_URL" >/dev/null; then
      printf 'Backend HTTP disponible en el intento %s.\n' "$attempt"
      return 0
    fi
    printf 'Intento %s/20: el backend aún no responde.\n' "$attempt"
    sleep 2
  done
  return 1
}

restore_previous_release() {
  local status=0
  printf 'Restaurando checkout, dependencias y build anteriores...\n' >&2

  git -C "$APP_DIR" reset --hard "$PREVIOUS_COMMIT" || status=1
  git -C "$APP_DIR" clean -fd -- src/generated/prisma || status=1
  (
    cd "$APP_DIR"
    npm ci --omit=dev --no-audit --no-fund --prefer-offline
  ) || status=1

  rm -rf -- "$APP_DIR/dist"
  if [[ "$HAS_PREVIOUS_DIST" -eq 1 ]]; then
    mkdir -p "$APP_DIR/dist"
    rsync -a --delete "$PREVIOUS_DIST_DIR/" "$APP_DIR/dist/" || status=1
  fi

  if [[ "$ACTIVATED" -eq 1 ]]; then
    pm2 restart "$PM2_APP" --update-env || status=1
    pm2 save || status=1
  fi

  return "$status"
}

fail_before_activation() {
  local message="$1"
  printf 'Error: %s\n' "$message" >&2
  restore_previous_release ||
    printf 'ALERTA: la restauración local quedó incompleta; requiere intervención.\n' >&2
  return 1
}

fail_after_activation() {
  local message="$1"
  printf 'Error: %s\n' "$message" >&2
  pm2 logs "$PM2_APP" --lines 30 --nostream || true
  restore_previous_release ||
    printf 'ALERTA: el rollback de código quedó incompleto; requiere intervención.\n' >&2
  return 1
}

run_deployment_pipeline() {
  prepare_rollback_context || return 1
  checkout_authorized_commit ||
    fail_before_activation 'No se pudo preparar el commit autorizado.' || return 1
  verify_commit_and_manifests ||
    fail_before_activation 'Falló la verificación de integridad.' || return 1

  install_production_dependencies ||
    fail_before_activation 'Falló la instalación de dependencias.' || return 1
  verify_postgres_preflight ||
    fail_before_activation 'Falló el preflight de PostgreSQL.' || return 1
  create_verified_backup ||
    fail_before_activation 'No se obtuvo un backup previo verificable.' || return 1
  run_prisma_migrations ||
    fail_before_activation 'Prisma Migrate falló; la BD requiere revisión manual.' || return 1
  install_candidate_artifact ||
    fail_before_activation 'No se pudo instalar el artefacto autorizado.' || return 1
  restart_backend ||
    fail_after_activation 'PM2 no pudo reiniciar el backend.' || return 1
  check_http_health ||
    fail_after_activation 'El backend no superó el health check HTTP.' || return 1
  verify_database_available ||
    fail_after_activation 'PostgreSQL no está disponible mediante DATABASE_URL.' || return 1

  pm2 save ||
    fail_after_activation 'PM2 no pudo persistir el estado del proceso.' || return 1
  printf 'Backend desplegado correctamente: %s\n' "$DEPLOY_COMMIT"
}

cleanup() {
  [[ -z "$STAGING_DIR" ]] || rm -rf -- "$STAGING_DIR"
  [[ -z "$PREVIOUS_DIST_DIR" ]] || rm -rf -- "$PREVIOUS_DIST_DIR"
  [[ -z "$CANDIDATE_DIST_DIR" ]] || rm -rf -- "$CANDIDATE_DIST_DIR"
}

main() {
  validate_arguments_and_artifact "$@"
  load_node_runtime
  verify_required_commands
  load_protected_deploy_environment
  acquire_deploy_lock
  trap cleanup EXIT
  run_deployment_pipeline
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
