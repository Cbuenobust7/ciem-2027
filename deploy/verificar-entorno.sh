#!/usr/bin/env bash
# Verifica un entorno instalado y emite evidencia PASS/FAIL por comprobación.
#
# Uso:  bash deploy/verificar-entorno.sh <dev|prod> [APP_DIR]
# Variables: las mismas que instalar-entorno.sh (DB_NAME, DB_USER, DB_PORT, PORT…)
set -uo pipefail

ENV_KIND="${1:-}"
case "$ENV_KIND" in dev|prod) ;; *) echo "uso: $0 <dev|prod> [APP_DIR]" >&2; exit 2 ;; esac
APP_DIR="${2:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

case "$ENV_KIND" in
  dev)  DJANGO_ENV=development; EXPECT_DEBUG=True;  DB_NAME="${DB_NAME:-booking_starter_dev}"; PORT="${PORT:-8021}" ;;
  prod) DJANGO_ENV=production;  EXPECT_DEBUG=False; DB_NAME="${DB_NAME:-booking_starter}";     PORT="${PORT:-8022}" ;;
esac
DB_USER="${DB_USER:-marketplace_user}"; DB_HOST="${DB_HOST:-127.0.0.1}"; DB_PORT="${DB_PORT:-5432}"
TENANT_DB="${TENANT_DB:-marketplace_starter}"
export HOME="${HOME:-/tmp}"

PASS=0; FAIL=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$*"; PASS=$((PASS+1)); }
no()   { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; FAIL=$((FAIL+1)); }
read_env() { grep -m1 "^$1=" .env 2>/dev/null | cut -d= -f2- || true; }
CLEAN=(env -u DB_NAME -u DB_USER -u DB_PASSWORD -u DB_HOST -u DB_PORT -u DEBUG
       -u SECRET_KEY -u ALLOWED_HOSTS -u CLEANING_VERTICAL_ENABLED
       -u REDIS_HOST -u REDIS_PORT -u FRONTEND_URL -u BACKEND_URL
       -u CORS_ALLOWED_ORIGINS -u CSRF_TRUSTED_ORIGINS)

echo "Verificación del entorno '$ENV_KIND' en $APP_DIR"
echo "  esperado: base $DB_NAME · DEBUG $EXPECT_DEBUG · puerto $PORT"

if [ -d venv ] && ./venv/bin/python -c 'import django' 2>/dev/null; then
  ok "venv con Django $(./venv/bin/python -c 'import django;print(django.get_version())')"
else no "venv ausente o sin Django"; fi

[ "$(read_env DB_NAME)" = "$DB_NAME" ] && ok ".env apunta a $DB_NAME" || no ".env dice DB_NAME=$(read_env DB_NAME)"
[ "$(read_env DEBUG)" = "$EXPECT_DEBUG" ] && ok ".env DEBUG=$EXPECT_DEBUG" || no ".env DEBUG=$(read_env DEBUG)"
[ -n "$(read_env SECRET_KEY)" ] && ok "SECRET_KEY presente" || no "SECRET_KEY ausente"

RESOLVED="$("${CLEAN[@]}" DJANGO_ENV="$DJANGO_ENV" ./venv/bin/python manage.py shell -c \
  "from django.conf import settings;print(settings.DATABASES['default']['NAME'],'|',settings.DEBUG)" 2>/dev/null | tail -1)"
echo "$RESOLVED" | grep -q "^$DB_NAME | $EXPECT_DEBUG$" \
  && ok "settings resuelve $DB_NAME con DEBUG=$EXPECT_DEBUG" \
  || no "settings resuelve '$RESOLVED' (¿entorno del proceso sin limpiar?)"

[ "$DB_NAME" != "$TENANT_DB" ] && ok "no apunta a la base del tenant ($TENANT_DB)" || no "apunta a la base del tenant"

DBPASS="$(read_env DB_PASSWORD)"
MIG=$(PGPASSWORD="$DBPASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
      'select count(*) from django_migrations' 2>/dev/null || echo 0)
[ "${MIG:-0}" -gt 0 ] && ok "migraciones aplicadas en la base: $MIG" || no "la base no tiene migraciones aplicadas"

[ -d staticfiles ] && ok "staticfiles presentes ($(find staticfiles -type f 2>/dev/null | wc -l) archivos)" || no "staticfiles ausente"

if "${CLEAN[@]}" DJANGO_ENV="$DJANGO_ENV" ./venv/bin/python manage.py check >/dev/null 2>&1; then
  ok "manage.py check limpio"
else no "manage.py check con incidencias"; fi

if command -v ss >/dev/null && ss -ltn 2>/dev/null | grep -q ":$PORT"; then
  CODE="$(curl -s -o /dev/null -w '%{http_code}' -m 8 -H 'Host: localhost' "http://127.0.0.1:$PORT/api/listings/" || echo 000)"
  [ "$CODE" = "200" ] && ok "smoke HTTP en :$PORT → 200" || no "smoke HTTP en :$PORT → $CODE"
else
  echo "  ----  HTTP: el puerto $PORT no escucha (no arrancado; comprobación opcional)"
fi

echo
echo "Resultado: $PASS PASS · $FAIL FAIL"
[ "$FAIL" -eq 0 ] || exit 1
