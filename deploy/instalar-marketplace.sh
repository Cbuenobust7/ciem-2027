#!/usr/bin/env bash
# =============================================================================
# Instalador — Marketplace Starter + vertical de limpieza
# =============================================================================
# Partido en tres modos para repartir el trabajo entre quien tiene sudo y quien
# no:
#
#   infra     (root)  paquetes del sistema, usuario y directorio de la app
#   app     (sin root) código, venv, pip, .env.production, frontend, estáticos
#   servicio  (root)  base de datos, migraciones, superusuario, systemd, nginx
#   todo      (root)  los tres seguidos, para instalación de una sola vez
#
# Secuencia recomendada cuando el trabajo se reparte:
#   sudo bash deploy/instalar-marketplace.sh infra     # lo ejecuta el dueño
#   bash deploy/instalar-marketplace.sh app            # sin sudo, como APP_USER
#   sudo bash deploy/instalar-marketplace.sh servicio  # lo ejecuta el dueño
#
# Parámetros (variables de entorno, opcionales):
#   APP_DIR=/srv/marketplace-starter     destino
#   APP_USER=agenteai                    dueño del código y del proceso
#   PORT=8017                            gunicorn (¡8078 está ocupado!)
#   SERVER_NAMES="192.168.1.50 localhost 127.0.0.1"
#   SERVICE_NAME=marketplace
#   DB_NAME=marketplace_starter  DB_USER=marketplace_user
#   ADMIN_USER=admin  ADMIN_PASSWORD=...  ADMIN_EMAIL=admin@example.com
#   SKIP_APT=1  SKIP_NODE=1  SKIP_FRONTEND=1  SKIP_NGINX=1
#
# Es idempotente: no pisa .env.production, no recrea rol ni base, no duplica el
# superusuario y no borra nada que no haya creado él.
#
# NOTA DE SEGURIDAD: por defecto el servicio corre como APP_USER (agenteai), un
# usuario con shell y contraseña. Es cómodo pero no ideal; al final del modo
# `servicio` se imprime el comando exacto para migrar a un usuario de sistema
# dedicado cuando quieras.
# =============================================================================
set -Eeuo pipefail

MODE="${1:-${MODE:-todo}}"

# Por defecto se instala en /srv/marketplace-starter. Ajusta APP_DIR a tu
# destino; si instalas sobre un árbol ya existente, apúntalo ahí para no
# copiar nada.
APP_DIR="${APP_DIR:-/srv/marketplace-starter}"
APP_USER="${APP_USER:-agenteai}"
APP_GROUP="${APP_GROUP:-www-data}"
PORT="${PORT:-8017}"
SERVICE_NAME="${SERVICE_NAME:-marketplace}"
SERVER_NAMES="${SERVER_NAMES:-192.168.1.50 localhost 127.0.0.1}"
WORKERS="${WORKERS:-3}"

DB_NAME="${DB_NAME:-marketplace_starter}"
DB_USER="${DB_USER:-marketplace_user}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

SKIP_APT="${SKIP_APT:-0}"
SKIP_NODE="${SKIP_NODE:-0}"
SKIP_FRONTEND="${SKIP_FRONTEND:-0}"
SKIP_NGINX="${SKIP_NGINX:-0}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="${SOURCE_DIR:-$(cd -- "${SCRIPT_DIR}/.." && pwd)}"
ENV_FILE="${ENV_FILE:-${APP_DIR}/.env.production}"

log()  { printf '\n\033[1;34m==> [%s] %s\033[0m\n' "$MODE" "$*"; }
ok()   { printf '\033[1;32m  OK\033[0m  %s\n' "$*"; }
warn() { printf '\033[1;33m  AVISO\033[0m  %s\n' "$*"; }
die()  { printf '\033[1;31m  ERROR\033[0m  %s\n' "$*" >&2; exit 1; }
paso() { printf '\n\033[1;36m  -> siguiente paso: %s\033[0m\n' "$*"; }

trap 'printf "\n\033[1;31m[FALLO] línea %s: %s\033[0m\n" "$LINENO" "$BASH_COMMAND" >&2' ERR

case "$MODE" in
    infra|servicio|todo)
        if [ "${EUID}" -ne 0 ]; then
            command -v sudo >/dev/null || die "el modo ${MODE} necesita root"
            exec sudo -E bash "${BASH_SOURCE[0]}" "$@"
        fi
        ;;
    app)
        [ "${EUID}" -ne 0 ] || warn "el modo app se pensó para ejecutarse SIN root (como ${APP_USER})"
        ;;
    -h|--help) sed -n '2,45p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "modo desconocido: ${MODE} (usa infra | app | servicio | todo)" ;;
esac

run_as_app() {
    if [ "$(id -un)" = "$APP_USER" ]; then
        "$@"
    else
        sudo -u "$APP_USER" "$@"
    fi
}
manage() { run_as_app env DJANGO_ENV=production "$APP_DIR/venv/bin/python" "$APP_DIR/manage.py" "$@"; }

# =============================================================================
# MODO INFRA (root)
# =============================================================================
modo_infra() {
    log "1/3 Paquetes, usuario y directorio"

    if [ "$SKIP_APT" != "1" ]; then
        export DEBIAN_FRONTEND=noninteractive
        apt-get update -qq
        apt-get install -y -qq python3.12 python3.12-venv python3-pip \
            postgresql postgresql-contrib redis-server nginx rsync curl ca-certificates
        ok "paquetes base instalados"
        if [ "$SKIP_NODE" != "1" ] && ! command -v node >/dev/null; then
            warn "Node no está instalado; instalando Node 22 desde NodeSource"
            curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
            apt-get install -y -qq nodejs
        fi
    else
        warn "paquetes omitidos (SKIP_APT=1)"
    fi

    command -v python3.12 >/dev/null || die "falta python3.12"
    ok "Python: $(python3.12 -V 2>&1)"
    if command -v node >/dev/null; then ok "Node: $(node -v)"; else warn "Node no disponible (¿SKIP_NODE=1?)"; fi

    id "$APP_USER" >/dev/null 2>&1 || die "el usuario ${APP_USER} no existe; créalo o usa APP_USER=..."
    getent group "$APP_GROUP" >/dev/null || groupadd --system "$APP_GROUP"
    ok "usuario ${APP_USER}, grupo ${APP_GROUP}"

    install -d -m 0755 "$APP_DIR"
    install -d -m 0755 "$APP_DIR/media" "$APP_DIR/staticfiles"
    chown -R "${APP_USER}:${APP_GROUP}" "$APP_DIR"
    ok "${APP_DIR} listo y propiedad de ${APP_USER}:${APP_GROUP}"

    systemctl enable --now postgresql >/dev/null 2>&1 || warn "no pude habilitar postgresql"
    systemctl enable --now redis-server >/dev/null 2>&1 || warn "Redis no arrancó (es opcional hoy)"
    ok "PostgreSQL y Redis habilitados"

    # Comprobación de puerto libre
    if ss -ltnH 2>/dev/null | awk '{print $4}' | grep -qE "[:.]${PORT}$"; then
        warn "el puerto ${PORT} ya está ocupado: revisa quién lo usa antes de continuar"
    else
        ok "puerto ${PORT} libre"
    fi

    paso "modo app, como ${APP_USER} y sin sudo:
       bash ${SCRIPT_DIR}/$(basename "${BASH_SOURCE[0]}") app"
}

# =============================================================================
# MODO APP (sin root)
# =============================================================================
modo_app() {
    log "2/3 Código, entorno virtual, configuración y frontend"

    [ -d "$APP_DIR" ] || die "${APP_DIR} no existe: ejecuta primero el modo infra"
    [ -w "$APP_DIR" ] || die "${APP_DIR} no es escribible por $(id -un): revisa el chown del modo infra"
    [ -f "${SOURCE_DIR}/manage.py" ] || die "no encuentro manage.py en SOURCE_DIR=${SOURCE_DIR}"
    [ -f "${SOURCE_DIR}/requirements.txt" ] || die "falta requirements.txt en ${SOURCE_DIR}"

    # --- Código -------------------------------------------------------------
    if [ "${SOURCE_DIR}" != "${APP_DIR}" ]; then
        command -v rsync >/dev/null || die "falta rsync (modo infra)"
        rsync -a \
            --exclude 'venv/' --exclude '.venv/' --exclude 'node_modules/' \
            --exclude 'dist/' --exclude 'staticfiles/' --exclude 'media/' \
            --exclude '.env' --exclude '.env.production' \
            --exclude '__pycache__/' --exclude '*.pyc' --exclude '.pytest_cache/' \
            --exclude '.git/' --exclude '*.log' --exclude 'db.sqlite3' \
            --exclude '.marketplace-local/' \
            "${SOURCE_DIR}/" "${APP_DIR}/"
        ok "código sincronizado ${SOURCE_DIR} -> ${APP_DIR}"
    else
        ok "instalación en el sitio, sin copia"
    fi
    install -d -m 0755 "$APP_DIR/media" "$APP_DIR/staticfiles"

    # --- venv y dependencias ------------------------------------------------
    if [ ! -x "$APP_DIR/venv/bin/python" ]; then
        python3.12 -m venv "$APP_DIR/venv"
        ok "venv creado"
    else
        ok "venv ya existía"
    fi
    "$APP_DIR/venv/bin/pip" install --upgrade pip -q
    "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt" -q
    ok "dependencias instaladas ($("$APP_DIR/venv/bin/python" -V 2>&1))"

    # --- .env.production ----------------------------------------------------
    if [ -f "$ENV_FILE" ]; then
        ok "${ENV_FILE} ya existe; no regenero secretos"
    else
        SECRET_KEY="$(openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-64)"
        DB_PASSWORD="$(openssl rand -hex 24)"
        cat > "$ENV_FILE" <<EOF
# Generado por deploy/instalar-marketplace.sh el $(date -Is)
SECRET_KEY=${SECRET_KEY}
DEBUG=False
ALLOWED_HOSTS=192.168.1.50,localhost,127.0.0.1

DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

CORS_ALLOWED_ORIGINS=http://192.168.1.50,http://localhost
FRONTEND_URL=http://192.168.1.50
BACKEND_URL=http://192.168.1.50

PLATFORM_NAME=MARKETPLACE_STARTER
PLATFORM_FEE_PERCENT=10.00

MERCADOPAGO_PRO_ACCESS_TOKEN=
MERCADOPAGO_PRO_WEBHOOK_SECRET=
MERCADOPAGO_CHECKOUT_PRO_TEST_ACCESS_TOKEN=
MERCADOPAGO_BRICKS_ACCESS_TOKEN=
MERCADOPAGO_BRICKS_WEBHOOK_SECRET=

CLEANING_VERTICAL_ENABLED=True
BOOKING_HOLD_TTL_MINUTES=15
BOOKING_SLOT_STEP_MINUTES=30
EOF
        chmod 600 "$ENV_FILE"
        ok "${ENV_FILE} creado (SECRET_KEY y DB_PASSWORD nuevos, chmod 600)"
    fi

    # --- Frontend -----------------------------------------------------------
    if [ "$SKIP_FRONTEND" = "1" ]; then
        warn "frontend omitido (SKIP_FRONTEND=1)"
    else
        command -v node >/dev/null || die "falta node (¿SKIP_NODE=1?)"
        node -e 'const [a,b]=process.versions.node.split(".").map(Number);
                 process.exit((a>22||(a===22&&b>=12)||(a===20&&b>=19))?0:1)' \
            || die "Node $(node -v) no cumple ^20.19.0 || >=22.12.0, que es lo que exige Vite 8"
        # VITE_API_URL VA VACÍO A PROPÓSITO: frontend/.env.example trae
        # http://localhost:8078 y copiarlo literal incrustaría esa URL en el
        # bundle. src/api/client.ts usa window.location.origin si está vacío.
        printf '# Generado por deploy/instalar-marketplace.sh\n# VITE_API_URL vacío => window.location.origin\nVITE_API_URL=\n' \
            > "$APP_DIR/frontend/.env"
        ( cd "$APP_DIR/frontend" && npm ci --no-audit --no-fund )
        ( cd "$APP_DIR/frontend" && npm run build )
        ok "frontend construido en frontend/dist (VITE_API_URL vacío)"
    fi

    # --- Estáticos (no necesita base de datos) ------------------------------
    manage collectstatic --noinput >/dev/null
    ok "estáticos recogidos en ${APP_DIR}/staticfiles"

    paso "modo servicio, con sudo:
       sudo bash ${SCRIPT_DIR}/$(basename "${BASH_SOURCE[0]}") servicio"
}

# =============================================================================
# MODO SERVICIO (root)
# =============================================================================
modo_servicio() {
    log "3/3 Base de datos, migraciones, systemd y nginx"

    [ -f "$ENV_FILE" ] || die "falta ${ENV_FILE}: ejecuta antes el modo app"
    DB_PASSWORD="$(sed -n 's/^DB_PASSWORD=//p' "$ENV_FILE" | head -1)"
    [ -n "$DB_PASSWORD" ] || die "DB_PASSWORD vacío en ${ENV_FILE}"
    case "$DB_PASSWORD" in *"'"*) die "DB_PASSWORD lleva comillas simples; cámbialo" ;; esac
    DB_NAME="$(sed -n 's/^DB_NAME=//p' "$ENV_FILE" | head -1)"
    DB_USER="$(sed -n 's/^DB_USER=//p' "$ENV_FILE" | head -1)"

    # --- PostgreSQL ---------------------------------------------------------
    command -v psql >/dev/null || die "psql no disponible"
    systemctl enable --now postgresql >/dev/null 2>&1 || true
    for i in $(seq 1 30); do
        sudo -u postgres psql -tAc 'SELECT 1' >/dev/null 2>&1 && break
        [ "$i" = 30 ] && die "PostgreSQL no responde"
        sleep 1
    done
    if [ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'")" = "1" ]; then
        sudo -u postgres psql -qc "ALTER ROLE ${DB_USER} WITH LOGIN CREATEDB PASSWORD '${DB_PASSWORD}'"
        ok "rol ${DB_USER} ya existía: contraseña sincronizada, CREATEDB asegurado"
    else
        sudo -u postgres psql -qc "CREATE ROLE ${DB_USER} LOGIN CREATEDB PASSWORD '${DB_PASSWORD}'"
        ok "rol ${DB_USER} creado"
    fi
    sudo -u postgres psql -qc "ALTER ROLE ${DB_USER} SET client_encoding TO 'utf8'"
    sudo -u postgres psql -qc "ALTER ROLE ${DB_USER} SET timezone TO 'America/Lima'"
    if [ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" = "1" ]; then
        ok "base ${DB_NAME} ya existía"
    else
        sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
        ok "base ${DB_NAME} creada (propietaria: ${DB_USER})"
    fi

    # --- Migraciones y superusuario -----------------------------------------
    manage migrate --noinput
    manage check
    ok "migrate + check correctos"

    ADMIN_GENERATED=0
    if [ -z "$ADMIN_PASSWORD" ]; then
        ADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
        ADMIN_GENERATED=1
    fi
    SU_EXISTS="$(manage shell -c "from django.contrib.auth import get_user_model as g; print(g().objects.filter(is_superuser=True).exists())" 2>/dev/null | tail -1)"
    if [ "$SU_EXISTS" = "True" ]; then
        ok "ya hay superusuario; no toco nada"
        ADMIN_GENERATED=0
    else
        DJANGO_SUPERUSER_PASSWORD="$ADMIN_PASSWORD" manage createsuperuser --noinput \
            --username "$ADMIN_USER" --email "$ADMIN_EMAIL" >/dev/null
        ok "superusuario ${ADMIN_USER} creado"
    fi

    # --- systemd ------------------------------------------------------------
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Marketplace Starter (Django + Gunicorn)
Documentation=file:${APP_DIR}/MIGRACION-SERVIDOR.md
After=network.target postgresql.service redis-server.service
Wants=postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}

WorkingDirectory=${APP_DIR}

# IMPRESCINDIBLE: sin esto settings.py lee ".env" y no ".env.production".
Environment=DJANGO_ENV=production
Environment=PYTHONUNBUFFERED=1

ExecStart=${APP_DIR}/venv/bin/gunicorn core.wsgi:application \\
    --bind 127.0.0.1:${PORT} \\
    --workers ${WORKERS} \\
    --timeout 60 \\
    --access-logfile - \\
    --error-logfile -

Restart=always
RestartSec=5
KillSignal=SIGTERM

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
    systemctl restart "$SERVICE_NAME"
    sleep 3
    systemctl is-active --quiet "$SERVICE_NAME" || {
        journalctl -u "$SERVICE_NAME" -n 40 --no-pager >&2
        die "${SERVICE_NAME} no arrancó"
    }
    ok "${SERVICE_NAME} activo en 127.0.0.1:${PORT}"

    # --- nginx --------------------------------------------------------------
    if [ "$SKIP_NGINX" = "1" ]; then
        warn "nginx omitido (SKIP_NGINX=1)"
    else
        cat > "/etc/nginx/sites-available/${SERVICE_NAME}" <<EOF
# Generado por deploy/instalar-marketplace.sh
# server_name con la IP evita que el sitio por defecto (:80, hoy 502) intercepte
# las peticiones a esta IP.
server {
    listen 80;
    server_name ${SERVER_NAMES};

    client_max_body_size 10M;

    root ${APP_DIR}/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /static/ {
        alias ${APP_DIR}/staticfiles/;
        access_log off;
        expires 30d;
    }

    location /media/ {
        alias ${APP_DIR}/media/;
        access_log off;
        expires 7d;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
        ln -sfn "/etc/nginx/sites-available/${SERVICE_NAME}" "/etc/nginx/sites-enabled/${SERVICE_NAME}"
        if nginx -t >/dev/null 2>&1; then
            systemctl reload nginx
            ok "nginx recargado"
        else
            nginx -t || true
            warn "nginx -t falló; revisa /etc/nginx/sites-available/${SERVICE_NAME}"
        fi
    fi

    # --- Verificación -------------------------------------------------------
    log "Verificación"
    verificar() {
        local url="$1" esperado="$2" code
        code="$(curl -s -o /dev/null -w '%{http_code}' -m 15 -H 'Host: 192.168.1.50' "$url" || echo 000)"
        if [ "$code" = "$esperado" ]; then
            printf '\033[1;32m  OK\033[0m   %-52s %s\n' "$url" "$code"
        else
            printf '\033[1;31m  MAL\033[0m  %-52s %s (esperaba %s)\n' "$url" "$code" "$esperado"
        fi
    }
    verificar "http://127.0.0.1:${PORT}/api/listings/" 200
    verificar "http://127.0.0.1:${PORT}/admin/login/" 200
    verificar "http://127.0.0.1:${PORT}/api/cleaning/providers/" 200
    verificar "http://192.168.1.50/" 200
    verificar "http://192.168.1.50/api/listings/" 200
    verificar "http://192.168.1.50/admin/login/" 200
    verificar "http://192.168.1.50/api/cleaning/providers/" 200

    # --- Resumen ------------------------------------------------------------
    log "Listo"
    cat <<EOF
  Directorio:    ${APP_DIR}
  Servicio:      systemctl status ${SERVICE_NAME}   (logs: journalctl -u ${SERVICE_NAME} -f)
  Gunicorn:      127.0.0.1:${PORT}   (${WORKERS} workers)
  Público:       http://192.168.1.50/   ·   admin: http://192.168.1.50/admin/
  Entorno:       ${ENV_FILE}  (chmod 600; DB_PASSWORD dentro)
  Base de datos: ${DB_NAME} como ${DB_USER} en ${DB_HOST}:${DB_PORT}

  Suite de pruebas (el rol ya tiene CREATEDB):
    sudo -u ${APP_USER} env DJANGO_ENV=production ${APP_DIR}/venv/bin/pytest -q

  Endurecer más adelante (servicio con usuario de sistema sin shell):
    sudo useradd --system --home ${APP_DIR} --shell /usr/sbin/nologin marketplace
    sudo chown -R marketplace:${APP_GROUP} ${APP_DIR}
    sudo sed -i 's/^User=.*/User=marketplace/' /etc/systemd/system/${SERVICE_NAME}.service
    sudo systemctl daemon-reload && sudo systemctl restart ${SERVICE_NAME}
EOF
    if [ "$ADMIN_GENERATED" = "1" ]; then
        printf '\n\033[1;33m  Superusuario generado — guárdalo ahora, no se vuelve a mostrar:\033[0m\n'
        printf '    usuario:    %s\n    contraseña: %s\n' "$ADMIN_USER" "$ADMIN_PASSWORD"
    fi
}

# =============================================================================
case "$MODE" in
    infra)    modo_infra ;;
    app)      modo_app ;;
    servicio) modo_servicio ;;
    todo)     modo_infra; modo_app; modo_servicio ;;
esac
