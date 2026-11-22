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
readonly PUBLISHER_CONTRACT_VERSION='sir-gava-backend-publisher/v1'

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
  command -v "$1" >/dev/null 2>&1 || {
    die "No está disponible el comando requerido: $1"
    return 1
  }
}

require_variable() {
  local name="$1"
  [[ -n "${!name:-}" ]] || {
    die "Falta configurar la variable protegida: $name"
    return 1
  }
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
  ) || return 1
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
  ) || return 1
}

pg_major_from_version() {
  local version_text="$1"
  local version
  version="$(printf '%s\n' "$version_text" | grep -Eo '[0-9]+([.][0-9]+)+' | head -n 1)" || {
    die 'No se pudo identificar la versión del cliente PostgreSQL.'
    return 1
  }
  [[ -n "$version" ]] || {
    die 'No se pudo identificar la versión del cliente PostgreSQL.'
    return 1
  }
  printf '%s\n' "${version%%.*}"
}

server_major_from_num() {
  local version_num="$1"
  [[ "$version_num" =~ ^[0-9]+$ ]] || {
    die 'server_version_num no es numérico.'
    return 1
  }
  printf '%s\n' "$((version_num / 10000))"
}

validate_arguments_and_artifact() {
  [[ "$#" -eq 3 ]] || {
    die "Uso: $0 <directorio-del-artefacto> <commit> <contrato>"
    return 1
  }
  [[ "$3" == "$PUBLISHER_CONTRACT_VERSION" ]] || {
    die 'El contrato solicitado no es compatible con este publicador.'
    return 1
  }

  STAGING_DIR="$(realpath -e "$1")" || {
    die 'No se pudo resolver el directorio temporal del artefacto.'
    return 1
  }
  DEPLOY_COMMIT="$2"

  case "$STAGING_DIR" in
    /tmp/backend-epp-*) ;;
    *)
      die "Directorio temporal no permitido: $STAGING_DIR"
      return 1
      ;;
  esac

  [[ "$DEPLOY_COMMIT" =~ ^[0-9a-f]{40}$ ]] || {
    die 'Identificador de commit inválido.'
    return 1
  }
  [[ -s "$STAGING_DIR/main.js" ]] || {
    die 'El artefacto no contiene main.js.'
    return 1
  }
  [[ -d "$STAGING_DIR/generated/prisma" ]] || {
    die 'El artefacto no contiene Prisma Client.'
    return 1
  }
  if find "$STAGING_DIR" -type l -print -quit | grep -q .; then
    die 'El artefacto contiene enlaces simbólicos.'
    return 1
  fi
  [[ -d "$APP_DIR/.git" ]] || {
    die "No se encontró el repositorio en $APP_DIR."
    return 1
  }
}

load_node_runtime() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
  fi
}

load_protected_deploy_environment() {
  [[ -f "$DEPLOY_ENV_FILE" ]] || {
    die "No existe el archivo protegido de despliegue: $DEPLOY_ENV_FILE"
    return 1
  }

  local mode owner
  mode="$(stat -c '%a' "$DEPLOY_ENV_FILE")" || {
    die 'No se pudieron leer los permisos del archivo de despliegue.'
    return 1
  }
  owner="$(stat -c '%u' "$DEPLOY_ENV_FILE")" || {
    die 'No se pudo identificar al propietario del archivo de despliegue.'
    return 1
  }
  [[ "$mode" == '600' || "$mode" == '400' ]] || {
    die 'El archivo de despliegue debe tener permisos 0600 o 0400.'
    return 1
  }
  [[ "$owner" == "$(id -u)" ]] || {
    die 'El archivo de despliegue debe pertenecer al usuario ejecutor.'
    return 1
  }
  if grep -Eq \
    '^[[:space:]]*(export[[:space:]]+)?(EXPECTED_|BACKEND_PATH|STAGING_DIR|DEPLOY_COMMIT)=' \
    "$DEPLOY_ENV_FILE"; then
    die 'El archivo protegido intenta sobrescribir datos autorizados por GitHub.'
    return 1
  fi

  set -a
  # shellcheck source=/dev/null
  . "$DEPLOY_ENV_FILE" || {
    set +a
    die 'No se pudo cargar el archivo protegido de despliegue.'
    return 1
  }
  set +a
}

verify_required_commands() {
  local required_command
  for required_command in \
    git npm node pm2 rsync flock curl realpath find sort xargs sha256sum \
    grep awk wc tr date mktemp mv chmod rm seq sleep id basename \
    psql pg_dump pg_restore df stat install; do
    require_command "$required_command" || return 1
  done
}

acquire_deploy_lock() {
  printf 'Esperando el bloqueo compartido de despliegue...\n'
  exec 9>"$LOCK_FILE" || {
    die 'No se pudo abrir el archivo de bloqueo de despliegue.'
    return 1
  }
  flock -w 900 9 ||
    {
      die 'Otro despliegue ocupó el bloqueo durante más de 15 minutos.'
      return 1
    }
  printf 'Bloqueo de despliegue adquirido.\n'
}

prepare_rollback_context() {
  PREVIOUS_COMMIT="$(git -C "$APP_DIR" rev-parse HEAD)" || {
    die 'No se pudo identificar el commit anterior.'
    return 1
  }
  PREVIOUS_DIST_DIR="$(mktemp -d "$APP_DIR/.dist-previous.XXXXXX")" || {
    die 'No se pudo crear el directorio de rollback.'
    return 1
  }
  CANDIDATE_DIST_DIR="$(mktemp -d "$APP_DIR/.dist-candidate.XXXXXX")" || {
    die 'No se pudo crear el directorio del build candidato.'
    return 1
  }

  if [[ -d "$APP_DIR/dist" ]]; then
    rsync -a "$APP_DIR/dist/" "$PREVIOUS_DIST_DIR/" || {
      die 'No se pudo preservar el build anterior.'
      return 1
    }
    HAS_PREVIOUS_DIST=1
  fi
}

checkout_authorized_commit() {
  printf 'Actualizando código al commit %s...\n' "$DEPLOY_COMMIT"
  git -C "$APP_DIR" fetch origin main || {
    die 'No se pudo actualizar origin/main.'
    return 1
  }
  git -C "$APP_DIR" cat-file -e "${DEPLOY_COMMIT}^{commit}" ||
    {
      die 'El commit no está disponible en el repositorio del VPS.'
      return 1
    }
  local origin_main_commit
  origin_main_commit="$(git -C "$APP_DIR" rev-parse origin/main)" || {
    die 'No se pudo identificar origin/main.'
    return 1
  }
  [[ "$origin_main_commit" == "$DEPLOY_COMMIT" ]] || {
    die 'El commit autorizado no coincide con el HEAD actual de origin/main.'
    return 1
  }

  git -C "$APP_DIR" reset --hard "$DEPLOY_COMMIT" || {
    die 'No se pudo activar el commit autorizado en el checkout.'
    return 1
  }
  git -C "$APP_DIR" clean -fd -- src/generated/prisma || {
    die 'No se pudo limpiar Prisma Client generado del commit anterior.'
    return 1
  }
}

verify_commit_and_manifests() {
  require_variable EXPECTED_MIGRATION_COUNT || return 1
  require_variable EXPECTED_MIGRATIONS_SHA256 || return 1
  require_variable EXPECTED_SCHEMA_SHA256 || return 1
  require_variable EXPECTED_ARTIFACT_SHA256 || return 1

  local current_commit protected_changes migration_count
  local schema_sha256 migrations_sha256 artifact_sha256
  current_commit="$(git -C "$APP_DIR" rev-parse HEAD)" || {
    die 'No se pudo identificar el commit activo del VPS.'
    return 1
  }
  [[ "$current_commit" == "$DEPLOY_COMMIT" ]] || {
    die 'El checkout del VPS no coincide con DEPLOY_COMMIT.'
    return 1
  }

  protected_changes="$({
    git -C "$APP_DIR" status --porcelain -- \
      prisma/schema.prisma prisma/migrations prisma.config.ts \
      package.json package-lock.json scripts/run-idempotent-sql.cjs
  })" || {
    die 'No se pudo verificar el estado de los archivos de despliegue.'
    return 1
  }
  [[ -z "$protected_changes" ]] || {
    die 'Los archivos de despliegue difieren del commit autorizado.'
    return 1
  }

  migration_count="$({
    find "$APP_DIR/prisma/migrations" -mindepth 1 -maxdepth 1 -type d \
      | wc -l | tr -d ' '
  })" || {
    die 'No se pudo contar el manifiesto de migraciones.'
    return 1
  }
  schema_sha256="$(sha256sum "$APP_DIR/prisma/schema.prisma" | awk '{print $1}')" || {
    die 'No se pudo calcular el hash de schema.prisma.'
    return 1
  }
  migrations_sha256="$(migration_manifest_sha256 "$APP_DIR")" || {
    die 'No se pudo calcular el manifiesto de migraciones.'
    return 1
  }
  artifact_sha256="$(artifact_manifest_sha256 "$STAGING_DIR")" || {
    die 'No se pudo calcular el manifiesto del artefacto.'
    return 1
  }

  [[ "$migration_count" == "$EXPECTED_MIGRATION_COUNT" ]] || {
    die 'La cantidad de migraciones no coincide con GitHub Actions.'
    return 1
  }
  [[ "$schema_sha256" == "$EXPECTED_SCHEMA_SHA256" ]] || {
    die 'schema.prisma no coincide con GitHub Actions.'
    return 1
  }
  [[ "$migrations_sha256" == "$EXPECTED_MIGRATIONS_SHA256" ]] || {
    die 'El manifiesto de migraciones no coincide con GitHub Actions.'
    return 1
  }
  [[ "$artifact_sha256" == "$EXPECTED_ARTIFACT_SHA256" ]] || {
    die 'El artefacto no coincide con GitHub Actions.'
    return 1
  }

  printf 'Commit, schema, migraciones y artefacto verificados.
'
}

install_production_dependencies() {
  printf 'Instalando únicamente dependencias de producción...
'
  (
    cd "$APP_DIR" || exit 1
    npm ci --omit=dev --no-audit --no-fund --prefer-offline
  ) || return 1
}

verify_protected_credentials() {
  require_variable PGPASSFILE || return 1
  [[ -f "$PGPASSFILE" ]] || {
    die 'PGPASSFILE no existe.'
    return 1
  }

  local mode owner current_user_id
  mode="$(stat -c '%a' "$PGPASSFILE")" || {
    die 'No se pudieron leer los permisos de PGPASSFILE.'
    return 1
  }
  owner="$(stat -c '%u' "$PGPASSFILE")" || {
    die 'No se pudo identificar al propietario de PGPASSFILE.'
    return 1
  }
  current_user_id="$(id -u)" || {
    die 'No se pudo identificar al usuario de despliegue.'
    return 1
  }
  [[ "$mode" == '600' || "$mode" == '400' ]] || {
    die 'PGPASSFILE debe tener permisos 0600 o 0400.'
    return 1
  }
  [[ "$owner" == "$current_user_id" ]] || {
    die 'PGPASSFILE debe pertenecer al usuario de despliegue.'
    return 1
  }
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
  require_variable PGHOST || return 1
  require_variable PGPORT || return 1
  require_variable PGDATABASE || return 1
  require_variable PGUSER || return 1
  require_variable DATABASE_URL || return 1
  verify_protected_credentials || return 1

  local server_version_num server_major dump_version restore_version
  local dump_major restore_major pg_target url_target
  server_version_num="$({
    psql -X --no-psqlrc --no-password -v ON_ERROR_STOP=1 -At \
      --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
      --dbname="$PGDATABASE" -c 'SHOW server_version_num'
  })" || {
    die 'No se pudo consultar la versión del servidor PostgreSQL.'
    return 1
  }
  server_major="$(server_major_from_num "$server_version_num")" || return 1
  dump_version="$(pg_dump --version)" || {
    die 'No se pudo consultar la versión de pg_dump.'
    return 1
  }
  restore_version="$(pg_restore --version)" || {
    die 'No se pudo consultar la versión de pg_restore.'
    return 1
  }
  dump_major="$(pg_major_from_version "$dump_version")" || return 1
  restore_major="$(pg_major_from_version "$restore_version")" || return 1

  ((server_major >= 10)) || {
    die 'PostgreSQL anterior a 10 requiere una revisión específica.'
    return 1
  }
  ((dump_major >= server_major)) || {
    die 'pg_dump es anterior al servidor PostgreSQL.'
    return 1
  }
  [[ "$restore_major" == "$dump_major" ]] || {
    die 'pg_dump y pg_restore deben tener la misma versión mayor.'
    return 1
  }

  pg_target="$(postgres_target_via_pg_env)" || {
    die 'No se pudo validar PostgreSQL mediante las variables PG*.'
    return 1
  }
  url_target="$(postgres_target_via_database_url)" || return 1
  [[ -n "$pg_target" && "$pg_target" == "$url_target" ]] || {
    die 'PG* y DATABASE_URL no apuntan al mismo servidor y base de datos.'
    return 1
  }

  printf 'PostgreSQL validado: servidor major %s; pg_dump major %s.
' \
    "$server_major" "$dump_major"
}

verify_database_available() {
  local target
  target="$(postgres_target_via_database_url)" || {
    die 'PostgreSQL no está disponible mediante DATABASE_URL.'
    return 1
  }
  [[ -n "$target" ]] || {
    die 'PostgreSQL no está disponible mediante DATABASE_URL.'
    return 1
  }
  printf 'Disponibilidad PostgreSQL confirmada mediante DATABASE_URL.
'
}

verify_backup_space() {
  local database_bytes available_kb available_bytes required_bytes
  [[ "$BACKUP_FREE_RESERVE_BYTES" =~ ^[0-9]+$ ]] || {
    die 'BACKUP_FREE_RESERVE_BYTES debe ser numérico.'
    return 1
  }
  install -d -m 0700 "$BACKUP_DIR" || {
    die 'No se pudo preparar el directorio de backups.'
    return 1
  }

  database_bytes="$({
    psql -X --no-psqlrc --no-password -v ON_ERROR_STOP=1 -At \
      --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
      --dbname="$PGDATABASE" -c 'SELECT pg_database_size(current_database())'
  })" || {
    die 'No se pudo consultar el tamaño de la base.'
    return 1
  }
  [[ "$database_bytes" =~ ^[0-9]+$ ]] || {
    die 'No se pudo calcular el tamaño de la base.'
    return 1
  }
  available_kb="$(df -Pk "$BACKUP_DIR" | awk 'NR == 2 {print $4}')" || {
    die 'No se pudo consultar el espacio disponible.'
    return 1
  }
  [[ "$available_kb" =~ ^[0-9]+$ ]] || {
    die 'No se pudo calcular el espacio disponible.'
    return 1
  }
  available_bytes="$((available_kb * 1024))"
  required_bytes="$((database_bytes + BACKUP_FREE_RESERVE_BYTES))"
  ((available_bytes >= required_bytes)) || {
    die 'No existe espacio suficiente para un backup previo verificable.'
    return 1
  }
}

create_verified_backup() {
  verify_backup_space || return 1

  local timestamp partial_path backup_path checksum_path checksum_name
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)" || {
    die 'No se pudo generar la marca temporal del backup.'
    return 1
  }
  backup_path="$BACKUP_DIR/predeploy-${timestamp}-${DEPLOY_COMMIT}.dump"
  partial_path="${backup_path}.partial"
  checksum_path="${backup_path}.sha256"

  rm -f -- "$partial_path" || {
    die 'No se pudo limpiar el backup parcial anterior.'
    return 1
  }
  umask 077
  if ! pg_dump \
    --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
    --dbname="$PGDATABASE" --format=custom --compress=6 \
    --no-owner --no-privileges --file="$partial_path"; then
    rm -f -- "$partial_path" || true
    die 'pg_dump no pudo completar el backup.'
    return 1
  fi
  if [[ ! -s "$partial_path" ]]; then
    rm -f -- "$partial_path" || true
    die 'pg_dump generó un archivo vacío.'
    return 1
  fi
  if ! pg_restore --list "$partial_path" >/dev/null; then
    rm -f -- "$partial_path" || true
    die 'pg_restore no pudo inspeccionar el backup.'
    return 1
  fi

  mv -- "$partial_path" "$backup_path" || {
    rm -f -- "$partial_path" || true
    die 'No se pudo finalizar el archivo de backup.'
    return 1
  }
  chmod 0600 "$backup_path" || {
    die 'No se pudieron proteger los permisos del backup.'
    return 1
  }
  sha256sum "$backup_path" >"$checksum_path" || {
    rm -f -- "$checksum_path" || true
    die 'No se pudo generar el checksum del backup.'
    return 1
  }
  chmod 0600 "$checksum_path" || {
    die 'No se pudieron proteger los permisos del checksum.'
    return 1
  }
  checksum_name="$(basename "$checksum_path")" || {
    die 'No se pudo determinar el nombre del checksum.'
    return 1
  }
  (cd "$BACKUP_DIR" && sha256sum --check "$checksum_name") >/dev/null || {
    die 'La verificación SHA-256 del backup falló.'
    return 1
  }
  printf 'Backup previo verificado: %s
' "$backup_path"
}

run_prisma_migrations() {
  printf 'Ejecutando migraciones oficiales de Prisma...
'
  (
    cd "$APP_DIR" || exit 1
    npm run prisma:migrate:deploy
  ) || return 1
}

install_candidate_artifact() {
  printf 'Preparando el build recibido desde GitHub...
'
  rsync -a --delete "$STAGING_DIR/" "$CANDIDATE_DIST_DIR/" || {
    die 'rsync no pudo preparar el build candidato.'
    return 1
  }
  [[ -s "$CANDIDATE_DIST_DIR/main.js" ]] || {
    die 'El build candidato no contiene main.js.'
    return 1
  }
  local candidate_artifact_sha256
  candidate_artifact_sha256="$(artifact_manifest_sha256 "$CANDIDATE_DIST_DIR")" || {
    die 'No se pudo calcular el manifiesto del build candidato.'
    return 1
  }
  [[ "$candidate_artifact_sha256" == "$EXPECTED_ARTIFACT_SHA256" ]] || {
    die 'El build candidato cambió durante la instalación.'
    return 1
  }

  rm -rf -- "$APP_DIR/dist" || {
    die 'No se pudo retirar el build publicado anteriormente.'
    return 1
  }
  mv -- "$CANDIDATE_DIST_DIR" "$APP_DIR/dist" || {
    die 'No se pudo activar el build candidato.'
    return 1
  }
  CANDIDATE_DIST_DIR=''
}

restart_backend() {
  pm2 restart "$PM2_APP" --update-env || {
    die 'PM2 no pudo reiniciar el backend.'
    return 1
  }
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
  printf 'Restaurando checkout, dependencias y build anteriores...
' >&2

  git -C "$APP_DIR" reset --hard "$PREVIOUS_COMMIT" || {
    printf 'Error: no se pudo restaurar el commit anterior.
' >&2
    status=1
  }
  git -C "$APP_DIR" clean -fd -- src/generated/prisma || {
    printf 'Error: no se pudo limpiar Prisma Client durante el rollback.
' >&2
    status=1
  }
  (
    cd "$APP_DIR" || exit 1
    npm ci --omit=dev --no-audit --no-fund --prefer-offline
  ) || {
    printf 'Error: no se pudieron restaurar las dependencias anteriores.
' >&2
    status=1
  }

  rm -rf -- "$APP_DIR/dist" || {
    printf 'Error: no se pudo retirar el build fallido.
' >&2
    status=1
  }
  if [[ "$HAS_PREVIOUS_DIST" -eq 1 ]]; then
    mkdir -p "$APP_DIR/dist" || {
      printf 'Error: no se pudo recrear el directorio del build anterior.
' >&2
      status=1
    }
    if [[ -d "$APP_DIR/dist" ]]; then
      rsync -a --delete "$PREVIOUS_DIST_DIR/" "$APP_DIR/dist/" || {
        printf 'Error: no se pudo restaurar el build anterior.
' >&2
        status=1
      }
    fi
  fi

  if [[ "$ACTIVATED" -eq 1 ]]; then
    if pm2 restart "$PM2_APP" --update-env; then
      pm2 save || {
        printf 'Error: PM2 no pudo persistir el estado restaurado.
' >&2
        status=1
      }
    else
      printf 'Error: PM2 no pudo reiniciar el build restaurado.
' >&2
      status=1
    fi
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
  [[ -z "$STAGING_DIR" ]] || rm -rf -- "$STAGING_DIR" || \
    printf 'Advertencia: no se pudo limpiar STAGING_DIR.
' >&2
  [[ -z "$PREVIOUS_DIST_DIR" ]] || rm -rf -- "$PREVIOUS_DIST_DIR" || \
    printf 'Advertencia: no se pudo limpiar PREVIOUS_DIST_DIR.
' >&2
  [[ -z "$CANDIDATE_DIST_DIR" ]] || rm -rf -- "$CANDIDATE_DIST_DIR" || \
    printf 'Advertencia: no se pudo limpiar CANDIDATE_DIST_DIR.
' >&2
  return 0
}

main() {
  if [[ "$#" -eq 1 && "$1" == '--print-contract-version' ]]; then
    printf '%s
' "$PUBLISHER_CONTRACT_VERSION"
    return 0
  fi

  validate_arguments_and_artifact "$@" || return 1
  load_node_runtime || return 1
  verify_required_commands || return 1
  load_protected_deploy_environment || return 1
  acquire_deploy_lock || return 1
  trap cleanup EXIT
  run_deployment_pipeline
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
