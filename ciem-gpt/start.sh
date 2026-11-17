#!/usr/bin/env bash
# Servidor de desarrollo de CIEM GPT: estáticos + DeepSeek + Ollama, sin nginx.
#
#   ./start.sh
#   DEEPSEEK_API_KEY=sk-... ./start.sh
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

PORT="${PORT:-8080}"
BIND="${BIND:-127.0.0.1}"

export PORT BIND
export STATIC_DIR="$PWD/public"
export DB_FILE="${DB_FILE:-${TMPDIR:-/tmp}/ciem-gpt-dev.sqlite3}"
export DEEPSEEK_API_URL="${DEEPSEEK_API_URL:-https://api.deepseek.com/anthropic}"
export OLLAMA_PRIMARY_URL="${OLLAMA_PRIMARY_URL:-http://192.168.1.39:11434}"
export OLLAMA_FALLBACK_URL="${OLLAMA_FALLBACK_URL:-http://127.0.0.1:11434}"

if [[ -z "${DEEPSEEK_API_KEY:-}" && -r /etc/default/ciem-gpt ]]; then
  DEEPSEEK_API_KEY="$(sed -n 's/^DEEPSEEK_API_KEY=//p' /etc/default/ciem-gpt | head -1)"
  export DEEPSEEK_API_KEY
fi
if [[ -z "${DEEPSEEK_API_KEY:-}" && -r .deepseek.key ]]; then
  DEEPSEEK_API_KEY="$(tr -d '[:space:]' < .deepseek.key)"
  export DEEPSEEK_API_KEY
fi

if [[ -z "${DEEPSEEK_API_KEY:-}" ]]; then
  printf '\033[33m! Sin clave de DeepSeek: solo funcionará Ollama.\033[0m\n\n'
fi
if command -v curl >/dev/null && ! curl -s -m 2 "${OLLAMA_PRIMARY_URL}/api/version" >/dev/null 2>&1; then
  printf '\033[33m! Ollama primario (%s) no responde; se usará el local.\033[0m\n\n' "${OLLAMA_PRIMARY_URL}"
fi

printf '\033[1m▶ CIEM GPT (desarrollo) en http://%s:%s\033[0m\n' "${BIND}" "${PORT}"
printf '  estáticos: %s\n' "${STATIC_DIR}"
printf '  Ctrl+C para detener.\n\n'

exec python3 server/server.py
