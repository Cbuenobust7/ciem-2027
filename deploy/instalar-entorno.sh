#!/usr/bin/env bash
# Monta un entorno de Booking Starter sobre un checkout de Git.
#
# Uso:  bash deploy/instalar-entorno.sh <dev|prod> [APP_DIR]
#
# Variables opcionales (todas con valor por defecto):
#   DB_NAME      booking_starter_dev | booking_starter
#   DB_USER      marketplace_user        DB_PASSWORD  (se conserva del .env si existe)
#   DB_HOST      127.0.0.1              DB_PORT      5432
#   PORT         8021 (dev) | 8022 (prod)
#   ALLOWED_HOSTS / FRONTEND_URL / BACKEND_URL
#   CREATE_DB=1  crea la base si no existe (requiere CREATEDB y DB_PASSWORD)
#   ROTATE_SECRET_KEY=1  genera SECRET_KEY nuevo aunque ya haya .env
#   PYTHON       /usr/bin/python3
#
# Es idempotente: si el venv existe lo reutiliza, y conserva el SECRET_KEY y la
# contraseña de base del .env salvo que se pida rotarlos.
set -Eeuo pipefail

ENV_KIND="${1:-}"
case "$ENV_KIND" in dev|prod) ;; *) echo "uso: $0 <dev|prod> [APP_DIR]" >&2; exit 2 ;; esac

APP_DIR="${2:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"
[ -f manage.py ] || { echo "ERROR: $APP_DIR no parece el proyecto (falta manage.py)" >&2; exit 1; }

case "$ENV_KIND" in
  dev)  DJANGO_ENV=development; DEBUG=True;  DB_NAME="${DB_NAME:-booking_starter_dev}"; PORT="${PORT:-8021}" ;;
  prod) DJANGO_ENV=production;  DEBUG=False; DB_NAME="${DB_NAME:-booking_starter}";     PORT="${PORT:-8022}" ;;
esac
DB_USER="${DB_USER:-marketplace_user}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
ALLOWED_HOSTS="${ALLOWED_HOSTS:-localhost,127.0.0.1}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:$PORT}"
BACKEND_URL="${BACKEND_URL:-$FRONTEND_URL}"
CREATE_DB="${CREATE_DB:-0}"
ROTATE_SECRET_KEY="${ROTATE_SECRET_KEY:-0}"
PYTHON="${PYTHON:-/usr/bin/python3}"
export HOME="${HOME:-/tmp}"

log() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
read_env() { grep -m1 "^$1=" .env 2>/dev/null | cut -d= -f2- || true; }
# El entorno del proceso GANA al .env (python-decouple): hay que limpiarlo.
CLEAN=(env -u DB_NAME -u DB_USER -u DB_PASSWORD -u DB_HOST -u DB_PORT -u DEBUG
       -u SECRET_KEY -u ALLOWED_HOSTS -u CLEANING_VERTICAL_ENABLED
       -u REDIS_HOST -u REDIS_PORT -u FRONTEND_URL -u BACKEND_URL
       -u CORS_ALLOWED_ORIGINS -u CSRF_TRUSTED_ORIGINS)

log "Entorno '$ENV_KIND' en $APP_DIR"
if git rev-parse --short HEAD >/dev/null 2>&1; then
  echo "· commit: $(git rev-parse --short HEAD)"
  [ -z "$(git status --porcelain | grep -v '^??' || true)" ] || echo "· AVISO: hay cambios sin commitear"
fi
echo "· base: $DB_NAME  · puerto: $PORT  · DEBUG: $DEBUG"

log "1/5 entorno virtual"
[ -d venv ] || "$PYTHON" -m venv venv
./venv/bin/python -m pip install --quiet --upgrade pip
./venv/bin/python -m pip install --quiet -r requirements.txt
./venv/bin/python -c 'import django' || { echo "ERROR: Django no quedó instalado" >&2; exit 1; }
echo "· $(./venv/bin/python -m pip --version | cut -d' ' -f1-2) · Django $(./venv/bin/python -c 'import django;print(django.get_version())')"

log "2/5 secretos y configuración"
SECRET_KEY="$(read_env SECRET_KEY)"
if [ -z "$SECRET_KEY" ] || [ "$ROTATE_SECRET_KEY" = "1" ]; then
  SECRET_KEY="$(./venv/bin/python -c 'import secrets;print(secrets.token_urlsafe(50))')"
  echo "· SECRET_KEY nuevo"
else
  echo "· SECRET_KEY conservado del .env existente"
fi
DB_PASSWORD="${DB_PASSWORD:-$(read_env DB_PASSWORD)}"
[ -n "$DB_PASSWORD" ] || { echo "ERROR: falta DB_PASSWORD (pásala por entorno o crea .env)" >&2; exit 1; }

write_env() { # $1 = DEBUG
  cat > "$2" <<EOF
# Generado por deploy/instalar-entorno.sh ($ENV_KIND) — $(date -Iseconds)
SECRET_KEY=$SECRET_KEY
DEBUG=$1
ALLOWED_HOSTS=$ALLOWED_HOSTS
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
REDIS_HOST=${REDIS_HOST:-127.0.0.1}
REDIS_PORT=${REDIS_PORT:-6379}
FRONTEND_URL=$FRONTEND_URL
BACKEND_URL=$BACKEND_URL
CORS_ALLOWED_ORIGINS=$FRONTEND_URL
CSRF_TRUSTED_ORIGINS=$FRONTEND_URL
CLEANING_VERTICAL_ENABLED=${CLEANING_VERTICAL_ENABLED:-True}
MERCADOPAGO_PRO_ACCESS_TOKEN=
MERCADOPAGO_PRO_WEBHOOK_SECRET=
MERCADOPAGO_CHECKOUT_PRO_TEST_ACCESS_TOKEN=
MERCADOPAGO_BRICKS_ACCESS_TOKEN=
MERCADOPAGO_BRICKS_WEBHOOK_SECRET=
EOF
}
write_env "$DEBUG" .env
write_env "False" .env.production   # misma base y mismo SECRET_KEY, sin DEBUG
chmod 640 .env .env.production
echo "· .env (DEBUG=$DEBUG) y .env.production (DEBUG=False) escritos"

log "3/5 base de datos"
if [ "$CREATE_DB" = "1" ]; then
  EXISTS="$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc \
            "select 1 from pg_database where datname='$DB_NAME'" 2>/dev/null || true)"
  if [ "$EXISTS" = "1" ]; then echo "· $DB_NAME ya existe"; else
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -q \
      -c "CREATE DATABASE $DB_NAME OWNER $DB_USER ENCODING 'UTF8' TEMPLATE template0;"
    echo "· $DB_NAME creada"
  fi
fi
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc 'select 1' >/dev/null \
  || { echo "ERROR: no puedo conectar a $DB_NAME con $DB_USER" >&2; exit 1; }

log "4/5 migraciones y estáticos"
"${CLEAN[@]}" DJANGO_ENV="$DJANGO_ENV" ./venv/bin/python manage.py migrate --noinput | tail -2
"${CLEAN[@]}" DJANGO_ENV="$DJANGO_ENV" ./venv/bin/python manage.py collectstatic --noinput | tail -1

log "5/5 comprobación"
"${CLEAN[@]}" DJANGO_ENV="$DJANGO_ENV" ./venv/bin/python manage.py check
echo "· resuelve: $("${CLEAN[@]}" DJANGO_ENV="$DJANGO_ENV" ./venv/bin/python manage.py shell -c \
  "from django.conf import settings;print(settings.DATABASES['default']['NAME'],'| DEBUG',settings.DEBUG)" | tail -1)"

CLEAN_HINT="env -u DB_NAME -u DB_USER -u DB_PASSWORD -u DB_HOST -u DB_PORT -u DEBUG -u SECRET_KEY -u ALLOWED_HOSTS -u CLEANING_VERTICAL_ENABLED -u REDIS_HOST -u REDIS_PORT -u FRONTEND_URL -u BACKEND_URL -u CORS_ALLOWED_ORIGINS -u CSRF_TRUSTED_ORIGINS"
cat <<EOF

Entorno instalado. Para arrancarlo y verificarlo:

  $CLEAN_HINT DJANGO_ENV=$DJANGO_ENV ./venv/bin/gunicorn core.wsgi:application \\
      --bind 127.0.0.1:$PORT --workers 2 --chdir $APP_DIR

  bash deploy/verificar-entorno.sh $ENV_KIND $APP_DIR
EOF
