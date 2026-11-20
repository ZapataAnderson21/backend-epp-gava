#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${BACKEND_PATH:-/root/backend-epp-gava}"
PM2_APP="backend-epp-gava"
LOCK_FILE="/var/lock/sir-gava-deploy.lock"

if [ "$#" -ne 2 ]; then
  echo "Uso: $0 <directorio-del-artefacto> <commit>"
  exit 1
fi

STAGING_DIR="$(realpath -e "$1")"
DEPLOY_COMMIT="$2"

case "$STAGING_DIR" in
  /tmp/backend-epp-*)
    ;;
  *)
    echo "Error: directorio temporal no permitido: $STAGING_DIR"
    exit 1
    ;;
esac

if [[ ! "$DEPLOY_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Error: identificador de commit inválido."
  exit 1
fi

test -s "$STAGING_DIR/main.js" || {
  echo "Error: el artefacto no contiene main.js."
  exit 1
}

if find "$STAGING_DIR" -type l -print -quit | grep -q .; then
  echo "Error: el artefacto contiene enlaces simbólicos."
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Error: no se encontró el repositorio en $APP_DIR."
  exit 1
fi

export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
fi

for required_command in git npm pm2 rsync flock curl; do
  command -v "$required_command" >/dev/null 2>&1 || {
    echo "Error: no está disponible $required_command."
    exit 1
  }
done

echo "Esperando el bloqueo compartido de despliegue..."
exec 9>"$LOCK_FILE"

if ! flock -w 900 9; then
  echo "Error: otro despliegue ocupó el bloqueo durante más de 15 minutos."
  exit 75
fi

echo "Bloqueo de despliegue adquirido."

cd "$APP_DIR"

echo "Actualizando código al commit $DEPLOY_COMMIT..."
git fetch origin main

git cat-file -e "${DEPLOY_COMMIT}^{commit}" || {
  echo "Error: el commit no está disponible en el repositorio del VPS."
  exit 1
}

git merge-base --is-ancestor "$DEPLOY_COMMIT" origin/main || {
  echo "Error: el commit no pertenece a origin/main."
  exit 1
}

git reset --hard "$DEPLOY_COMMIT"
git clean -fd -- src/generated/prisma

echo "Instalando únicamente dependencias de producción..."
npm ci \
  --omit=dev \
  --no-audit \
  --no-fund \
  --prefer-offline

echo "Ejecutando migraciones de Prisma..."
npm run prisma:migrate:deploy

echo "Ejecutando scripts SQL idempotentes..."
npm run db:apply-idempotent

ROLLBACK_DIR="$(mktemp -d /tmp/backend-epp-rollback.XXXXXX)"
HAS_PREVIOUS_DIST=0

cleanup() {
  rm -rf -- "$STAGING_DIR" "$ROLLBACK_DIR"
}

trap cleanup EXIT

if [ -d "$APP_DIR/dist" ]; then
  rsync -a "$APP_DIR/dist/" "$ROLLBACK_DIR/"
  HAS_PREVIOUS_DIST=1
fi

echo "Instalando el build recibido desde GitHub..."
mkdir -p "$APP_DIR/dist"
rsync -a --delete "$STAGING_DIR/" "$APP_DIR/dist/"

test -s "$APP_DIR/dist/main.js" || {
  echo "Error: dist/main.js no quedó instalado."
  exit 1
}

echo "Reiniciando backend..."

restore_previous_build() {
  if [ "$HAS_PREVIOUS_DIST" -ne 1 ]; then
    echo "No existe un build anterior para restaurar."
    return 1
  fi

  echo "Restaurando el build anterior..."
  rsync -a --delete "$ROLLBACK_DIR/" "$APP_DIR/dist/"
  pm2 restart "$PM2_APP" --update-env
}

echo "Reiniciando backend..."

if ! pm2 restart "$PM2_APP" --update-env; then
  echo "Error: PM2 no pudo ejecutar el reinicio."
  restore_previous_build || true
  exit 1
fi

HEALTH_URL="http://127.0.0.1:3001/documentation"
HEALTHY=0

echo "Verificando la salud del backend..."

for attempt in $(seq 1 20); do
  if curl \
    --fail \
    --silent \
    --show-error \
    --max-time 3 \
    "$HEALTH_URL" \
    >/dev/null; then
    HEALTHY=1
    echo "Backend saludable en el intento $attempt."
    break
  fi

  echo "Intento $attempt/20: el backend aún no responde."
  sleep 2
done

if [ "$HEALTHY" -ne 1 ]; then
  echo "Error: el backend no respondió correctamente después del reinicio."
  pm2 logs "$PM2_APP" --lines 30 --nostream || true
  restore_previous_build || true
  exit 1
fi

pm2 save

echo "Backend desplegado correctamente: $DEPLOY_COMMIT"
