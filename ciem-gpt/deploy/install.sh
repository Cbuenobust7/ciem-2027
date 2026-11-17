#!/usr/bin/env bash
# CIEM GPT — instalador/actualizador (misma estructura que ciem-chat)
#
#   sudo ./deploy/install.sh
#
# Variables opcionales:
#   DEST=/var/www/ciem-2027/ciem-gpt   OWNER=carlos   DEEPSEEK_API_KEY=sk-...
set -euo pipefail
umask 022

DEST="${DEST:-/var/www/ciem-2027/ciem-gpt}"
OWNER="${OWNER:-carlos}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ciem-gpt}"
SITE_NAME="gpt.ciem.pe"
NGINX_AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"
ENV_FILE="/etc/default/ciem-gpt"
UNIT="/etc/systemd/system/ciem-gpt-2027.service"
STAMP="$(date +%Y%m%d-%H%M%S)"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bold() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ───────────────────────── 0. Comprobaciones ─────────────────────────
[[ "${EUID}" -eq 0 ]] || die "Ejecuta con sudo: sudo ./deploy/install.sh"
[[ -f "${SRC}/server/server.py" ]] || die "No encuentro server/server.py en ${SRC}"
command -v nginx  >/dev/null || die "nginx no está instalado"
command -v python3 >/dev/null || die "python3 no está instalado"
id "${OWNER}" >/dev/null 2>&1 || die "No existe el usuario ${OWNER}"
[[ -d /var/www/ciem-2027 ]] || die "No existe /var/www/ciem-2027"

bold "0/7 · Comprobaciones"
ok "origen: ${SRC}"
ok "destino: ${DEST}"

# ───────────────────────── 1. Respaldo ─────────────────────────
bold "1/7 · Respaldo"
mkdir -p "${BACKUP_DIR}"
BACKUP="${BACKUP_DIR}/ciem-gpt-${STAMP}.tar.gz"
if [[ -d "${DEST}" ]]; then
  tar -czf "${BACKUP}" -C "$(dirname "${DEST}")" "$(basename "${DEST}")"
  ok "${BACKUP}"
else
  warn "primera instalación: no hay nada que respaldar"
fi

# ───────────────────────── 2. Aplicación ─────────────────────────
bold "2/7 · Copiando aplicación"
mkdir -p "${DEST}/public/assets" "${DEST}/server" "${DEST}/deploy"
if command -v rsync >/dev/null; then
  rsync -a --delete "${SRC}/public/" "${DEST}/public/"
  rsync -a --delete "${SRC}/server/" "${DEST}/server/"
  rsync -a --delete "${SRC}/deploy/" "${DEST}/deploy/"
else
  rm -rf "${DEST}/public" "${DEST}/server" "${DEST}/deploy"
  cp -a "${SRC}/public" "${SRC}/server" "${SRC}/deploy" "${DEST}/"
fi
install -m 755 "${SRC}/start.sh" "${DEST}/start.sh"
for doc in README.md LICENSE .gitignore; do
  if [[ -f "${SRC}/${doc}" ]]; then
    install -m 644 "${SRC}/${doc}" "${DEST}/${doc}"
  fi
done
chown -R "${OWNER}:${OWNER}" "${DEST}"
find "${DEST}" -type d -exec chmod 755 {} +
find "${DEST}" -type f -exec chmod 644 {} +
chmod 755 "${DEST}/start.sh" "${DEST}/deploy/install.sh"
runuser -u "${OWNER}" -- test -r "${DEST}/server/server.py" \
  || die "${OWNER} no puede leer ${DEST}/server/server.py"
runuser -u "${OWNER}" -- test -r "${DEST}/public/index.html" \
  || die "${OWNER} no puede leer ${DEST}/public/index.html"
ok "archivos copiados y legibles por ${OWNER}"

# ───────────────────────── 3. Clave ─────────────────────────
bold "3/7 · Clave de DeepSeek"
key_from_file() {
  [[ -r "$1" ]] || return 0
  sed -n 's/^[[:space:]]*DEEPSEEK_API_KEY[[:space:]]*=[[:space:]]*//p' "$1" \
    | head -1 | tr -d '"'"'"'[:space:]'
}
KEY="${DEEPSEEK_API_KEY:-}"
[[ -n "${KEY}" ]] || KEY="$(key_from_file "${ENV_FILE}")"
[[ -n "${KEY}" ]] || KEY="$(key_from_file /etc/default/ciem-chat)"
if [[ -z "${KEY}" && -s "${SRC}/.deepseek.key" ]]; then
  KEY="$(tr -d '[:space:]' < "${SRC}/.deepseek.key")"
fi
if [[ -z "${KEY}" ]]; then
  [[ -t 0 ]] || die "Sin clave: exporta DEEPSEEK_API_KEY o crea ${SRC}/.deepseek.key"
  printf '  API key de DeepSeek (sk-...): '
  read -rs KEY
  printf '\n'
fi
[[ -n "${KEY}" ]] || die "La clave está vacía"
[[ "${KEY}" == sk-* ]] || warn "la clave no empieza por 'sk-'; se guarda igualmente"
if [[ -f "${ENV_FILE}" ]]; then
  # Actualizar sin perder la configuración existente del usuario.
  if grep -q '^DEEPSEEK_API_KEY=' "${ENV_FILE}"; then
    sed -i "s|^DEEPSEEK_API_KEY=.*|DEEPSEEK_API_KEY=${KEY}|" "${ENV_FILE}"
  else
    printf 'DEEPSEEK_API_KEY=%s\n' "${KEY}" >> "${ENV_FILE}"
  fi
  grep -q '^GREETING=' "${ENV_FILE}" \
    || printf 'GREETING=Habla causita!\n' >> "${ENV_FILE}"
  # Migrar los valores por defecto antiguos (3 consultas / tope 500) sin tocar
  # los que el usuario haya personalizado.
  sed -i 's/^QUOTA_LIMIT=3$/QUOTA_LIMIT=500/; s/^GLOBAL_DAILY_LIMIT=500$/GLOBAL_DAILY_LIMIT=5000/' "${ENV_FILE}"
else
  cat > "${ENV_FILE}" <<ENVEOF
# CIEM GPT — entorno del servicio (640 root:${OWNER})
DEEPSEEK_API_KEY=${KEY}
# Límites de la cuota gratuita
QUOTA_LIMIT=500
QUOTA_WINDOW_HOURS=24
QUOTA_TZ_OFFSET=-5
GLOBAL_DAILY_LIMIT=5000
MAX_TOKENS=1024
# Saludo del asistente en el primer mensaje (cámbialo y reinicia el servicio).
GREETING=Habla causita!
ENVEOF
fi
chown root:"${OWNER}" "${ENV_FILE}"
chmod 640 "${ENV_FILE}"
unset KEY
ok "clave y límites en ${ENV_FILE} (640 root:${OWNER})"

install -d -m 750 -o "${OWNER}" -g "${OWNER}" /var/lib/ciem-gpt
# La BD pudo quedar de la versión anterior (www-data): el servicio corre como ${OWNER}.
chown -R "${OWNER}:${OWNER}" /var/lib/ciem-gpt
find /var/lib/ciem-gpt -type f -exec chmod 640 {} + 2>/dev/null || true
ok "/var/lib/ciem-gpt listo"

# ───────────────────────── 4. Servicio ─────────────────────────
bold "4/7 · Servicio ciem-gpt-2027"
# Detener el servicio anterior antes de arrancar el nuevo (comparten la BD).
if [[ -f /etc/systemd/system/ciem-gpt-quota.service ]] \
   || systemctl is-enabled ciem-gpt-quota >/dev/null 2>&1; then
  systemctl disable --now ciem-gpt-quota 2>/dev/null || true
  ok "servicio anterior ciem-gpt-quota detenido"
fi
install -m 644 "${SRC}/deploy/ciem-gpt-2027.service" "${UNIT}"
systemctl daemon-reload
systemctl enable ciem-gpt-2027.service >/dev/null 2>&1 || true
if ! systemctl restart ciem-gpt-2027.service; then
  journalctl -u ciem-gpt-2027.service -n 30 --no-pager || true
  die "el servicio no arrancó"
fi
sleep 1
if ! systemctl is-active --quiet ciem-gpt-2027.service; then
  journalctl -u ciem-gpt-2027.service -n 30 --no-pager || true
  die "ciem-gpt-2027 no está activo"
fi
if ! curl -fsS -m 4 http://127.0.0.1:8766/health >/dev/null; then
  journalctl -u ciem-gpt-2027.service -n 30 --no-pager || true
  die "el servicio no responde en 127.0.0.1:8766"
fi
ok "ciem-gpt-2027 activo en 127.0.0.1:8766"

# ───────────────────────── 5. nginx ─────────────────────────
bold "5/7 · Configuración de nginx"
NGINX_BACKUP="${BACKUP_DIR}/nginx-${STAMP}"
mkdir -p "${NGINX_BACKUP}"
if [[ -f "${NGINX_AVAILABLE}" ]]; then
  cp -a "${NGINX_AVAILABLE}" "${NGINX_BACKUP}/site.conf"
fi

install -m 644 "${SRC}/deploy/gpt.ciem.pe.conf" "${NGINX_AVAILABLE}"
ln -sfn "${NGINX_AVAILABLE}" "${NGINX_ENABLED}"

if ! nginx -t 2>/tmp/ciem-gpt-nginx.err; then
  cat /tmp/ciem-gpt-nginx.err >&2
  if [[ -f "${NGINX_BACKUP}/site.conf" ]]; then
    cp -a "${NGINX_BACKUP}/site.conf" "${NGINX_AVAILABLE}"
  fi
  die "nginx -t falló; se restauró la configuración anterior"
fi
systemctl reload nginx
# Restos de la versión anterior (zonas del proxy de cuota propio), ya sin uso.
rm -f /etc/nginx/conf.d/ciem-gpt-limits.conf
ok "nginx recargado"

# ───────────────────────── 6. Verificación ─────────────────────────
bold "6/7 · Verificación"
probe() { curl -s -o /dev/null -m 5 -w '%{http_code}' -H "Host: ${SITE_NAME}" "http://127.0.0.1$1"; }
CODE_INDEX="$(probe /)"
CODE_QUOTA="$(probe /api/ciem-gpt/quota)"
CODE_GIT="$(probe /.git/config)"
CODE_OLD="$(probe /api/deepseek/quota)"

[[ "${CODE_INDEX}" == "200" ]] && ok "index.html → 200" || warn "index.html → ${CODE_INDEX}"
[[ "${CODE_QUOTA}" == "200" ]] && ok "cuota → 200" || warn "cuota → ${CODE_QUOTA}"
if [[ "${CODE_GIT}" == "403" || "${CODE_GIT}" == "404" ]]; then
  ok ".git bloqueado → ${CODE_GIT}"
else
  warn ".git responde ${CODE_GIT} (revisar docroot)"
fi
[[ "${CODE_OLD}" == "404" ]] && ok "endpoint antiguo retirado → 404" || warn "/api/deepseek responde ${CODE_OLD}"

# ───────────────────────── 7. Limpieza ─────────────────────────
bold "7/7 · Limpieza"
if [[ -f /etc/systemd/system/ciem-gpt-quota.service ]] \
   || systemctl is-enabled ciem-gpt-quota >/dev/null 2>&1; then
  systemctl disable --now ciem-gpt-quota 2>/dev/null || true
  rm -f /etc/systemd/system/ciem-gpt-quota.service
  systemctl daemon-reload
  ok "servicio antiguo ciem-gpt-quota retirado"
else
  ok "nada que limpiar"
fi

printf '\n\033[1mListo.\033[0m\n'
printf '  URL:      https://%s\n' "${SITE_NAME}"
printf '  Servicio: systemctl status ciem-gpt-2027\n'
printf '  Logs:     journalctl -u ciem-gpt-2027 -f\n'
printf '  Clave:    %s (rotar y reiniciar)\n' "${ENV_FILE}"
printf '  Respaldo: %s\n' "${BACKUP}"
printf '\n  El asistente de ciem.pe (ciem-chat-2027) no se ha tocado.\n\n'
