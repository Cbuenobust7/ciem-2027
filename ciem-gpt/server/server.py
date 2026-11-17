#!/usr/bin/env python3
"""CIEM GPT — asistente general.

Misma estructura que ciem-chat/server.py:
  * DeepSeek como proveedor primario (API compatible con Anthropic).
  * Ollama como respaldo: 192.168.1.39 y, si falla, 127.0.0.1.
  * Slots para no tumbar los backends y fallback decidido en el servidor.
  * Un único endpoint de chat con streaming SSE normalizado + cuota por IP.

El navegador solo habla con /api/ciem-gpt y nunca ve la API key.
"""
import http.client
import json
import logging
import os
import signal
import sqlite3
import ssl
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8766"))
BIND = os.environ.get("BIND", "127.0.0.1")

DEEPSEEK_URL = os.environ.get("DEEPSEEK_API_URL", "https://api.deepseek.com/anthropic").rstrip("/")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-flash")
# Nombre que ve el visitante (white-label): el proveedor real solo queda en logs.
MODEL_LABEL = os.environ.get("MODEL_LABEL", "ciem-flash")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "").strip()
DEEPSEEK_VERSION = os.environ.get("DEEPSEEK_ANTHROPIC_VERSION", "2023-06-01")
# Los modelos flash razonan en inglés y consumen max_tokens; para un chat público
# conviene desactivarlo: respuestas más rápidas, baratas y sin filtrar el pensamiento.
DEEPSEEK_THINKING = os.environ.get("DEEPSEEK_THINKING", "disabled").lower()

OLLAMA_PRIMARY_URL = os.environ.get("OLLAMA_PRIMARY_URL", "http://192.168.1.39:11434").rstrip("/")
OLLAMA_PRIMARY_MODEL = os.environ.get("OLLAMA_PRIMARY_MODEL", "qwen2.5:0.5b")
OLLAMA_FALLBACK_URL = os.environ.get("OLLAMA_FALLBACK_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_FALLBACK_MODEL = os.environ.get("OLLAMA_FALLBACK_MODEL", "qwen2.5:0.5b")

GREETING = os.environ.get("GREETING", "Habla causita!").strip()

DEFAULT_SYSTEM = os.environ.get(
    "SYSTEM_PROMPT",
    "Eres el asistente de CIEM. Responde en español, con claridad y concisión. "
    "Puedes ayudar con cualquier tema que plantee el usuario, sin limitarlo a un "
    "catálogo de servicios. No enumeres servicios ni áreas salvo que te lo pidan. "
    "Si no sabes algo, dilo con honestidad. "
    "Usa un tono cercano y peruano, tutea y no exageres el slang. "
    "No saludes con «Hola» ni «Saludos».",
)
MAX_TOKENS = int(os.environ.get("MAX_TOKENS", "1024"))
MAX_TOKENS_CAP = int(os.environ.get("MAX_TOKENS_CAP", "2048"))
MAX_BODY = int(os.environ.get("MAX_BODY_BYTES", str(32 * 1024)))
MAX_MESSAGES = int(os.environ.get("MAX_MESSAGES", "20"))
MAX_CHARS = int(os.environ.get("MAX_CHARS", "8000"))

QUOTA_LIMIT = int(os.environ.get("QUOTA_LIMIT", "500"))
QUOTA_WINDOW_HOURS = float(os.environ.get("QUOTA_WINDOW_HOURS", "24"))
QUOTA_TZ_OFFSET = float(os.environ.get("QUOTA_TZ_OFFSET", "-5"))
GLOBAL_DAILY_LIMIT = int(os.environ.get("GLOBAL_DAILY_LIMIT", "5000"))
QUOTA_DB = os.environ.get("DB_FILE", "/var/lib/ciem-gpt/quota.sqlite3")
QUOTA_MESSAGE = os.environ.get(
    "QUOTA_MESSAGE", "Se quedó sin tokens, consulte a CIEM para comprar más."
)

ORIGINS = {
    o.strip() for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "https://gpt.ciem.pe,http://gpt.ciem.pe,"
        "http://127.0.0.1:8080,http://localhost:8080,"
        "http://127.0.0.1:8766,http://localhost:8766",
    ).split(",") if o.strip()
}

STATIC_DIR = os.environ.get("STATIC_DIR", "")
API_SLOTS = threading.BoundedSemaphore(int(os.environ.get("API_SLOTS", "8")))
LOCAL_SLOTS = threading.BoundedSemaphore(int(os.environ.get("LOCAL_SLOTS", "2")))
QUEUE_WAIT = float(os.environ.get("QUEUE_WAIT", "2"))
LOCAL_WAIT = float(os.environ.get("LOCAL_WAIT", "1"))
TIMEOUT = float(os.environ.get("UPSTREAM_TIMEOUT", "120"))

WINDOW = int(QUOTA_WINDOW_HOURS * 3600)
LOGGER = logging.getLogger("ciem-gpt")
_db_lock = threading.Lock()

_text_types = ("text_delta", "text")
_think_types = ("thinking_delta", "thinking")


class Busy(Exception):
    """Sin hueco libre en el tiempo de gracia."""


class BackendBusy(Exception):
    """El proveedor limitó (429)."""


class Unavailable(Exception):
    """Todos los backends fallaron."""


# ────────────────────────────  Cuota  ────────────────────────────
def _db():
    con = sqlite3.connect(QUOTA_DB, timeout=10)
    con.execute("PRAGMA busy_timeout=5000")
    con.execute(
        "CREATE TABLE IF NOT EXISTS usage ("
        " scope TEXT NOT NULL, bucket INTEGER NOT NULL, n INTEGER NOT NULL,"
        " PRIMARY KEY (scope, bucket))"
    )
    return con


def _bucket():
    return int((time.time() + QUOTA_TZ_OFFSET * 3600) // WINDOW)


def _reset_at(bucket):
    return int((bucket + 1) * WINDOW - QUOTA_TZ_OFFSET * 3600)


def quota_peek(ip):
    bucket = _bucket()
    with _db_lock:
        con = _db()
        try:
            row = con.execute(
                "SELECT n FROM usage WHERE scope=? AND bucket=?", (ip, bucket)
            ).fetchone()
        finally:
            con.close()
    used = row[0] if row else 0
    return {
        "limit": QUOTA_LIMIT,
        "used": used,
        "remaining": max(0, QUOTA_LIMIT - used),
        "reset_at": _reset_at(bucket),
        "window_hours": QUOTA_WINDOW_HOURS,
        "greeting": GREETING,
    }


def quota_reserve(ip):
    bucket = _bucket()
    scopes = [(ip, QUOTA_LIMIT)]
    if GLOBAL_DAILY_LIMIT > 0:
        scopes.append(("__global__", GLOBAL_DAILY_LIMIT))
    with _db_lock:
        con = _db()
        try:
            used = {}
            for scope, limit in scopes:
                row = con.execute(
                    "SELECT n FROM usage WHERE scope=? AND bucket=?", (scope, bucket)
                ).fetchone()
                used[scope] = row[0] if row else 0
                if used[scope] >= limit:
                    return {
                        "allowed": False,
                        "limit": limit,
                        "remaining": 0,
                        "reset_at": _reset_at(bucket),
                    }
            for scope, _limit in scopes:
                con.execute(
                    "INSERT INTO usage (scope, bucket, n) VALUES (?, ?, 1) "
                    "ON CONFLICT(scope, bucket) DO UPDATE SET n = n + 1",
                    (scope, bucket),
                )
            con.commit()
        finally:
            con.close()
    return {
        "allowed": True,
        "limit": QUOTA_LIMIT,
        "remaining": max(0, QUOTA_LIMIT - used[ip] - 1),
        "reset_at": _reset_at(bucket),
    }


def quota_refund(ip):
    bucket = _bucket()
    with _db_lock:
        con = _db()
        try:
            con.execute(
                "UPDATE usage SET n = n - 1 WHERE scope=? AND bucket=? AND n > 0",
                (ip, bucket),
            )
            con.commit()
        finally:
            con.close()


def _quota_headers(q):
    return {
        "X-Quota-Limit": str(q.get("limit", QUOTA_LIMIT)),
        "X-Quota-Remaining": str(q.get("remaining", 0)),
        "X-Quota-Reset": str(q.get("reset_at", 0)),
    }


# ────────────────────────────  Backends  ────────────────────────────
def build_system(extra, first):
    """Prompt final: base del servidor + saludo obligatorio en el primer mensaje."""
    base = (str(extra).strip()[:2000] or DEFAULT_SYSTEM).strip()
    if first:
        base += (
            "\n\nEs el primer mensaje de la conversación: empieza tu respuesta "
            f"exactamente con «{GREETING}». "
            f"Si el mensaje es solo un saludo, responde únicamente «{GREETING} ¿En qué te ayudo?» "
            "y no añadas nada más. Si es una consulta, respóndela después del saludo. "
            "No repitas ese saludo en los mensajes siguientes."
        )
    return base


def _http_open(url, headers, payload, timeout):
    parts = urllib.parse.urlsplit(url)
    if parts.scheme == "https":
        conn = http.client.HTTPSConnection(parts.hostname, parts.port, timeout=timeout,
                                           context=ssl.create_default_context())
    else:
        conn = http.client.HTTPConnection(parts.hostname, parts.port, timeout=timeout)
    conn.connect()
    conn.sock.settimeout(timeout)
    conn.request("POST", parts.path, body=payload, headers=headers)
    return conn, conn.getresponse()


def open_deepseek(messages, system, temperature, max_tokens):
    if not DEEPSEEK_API_KEY:
        raise ValueError("DEEPSEEK_API_KEY missing")
    root = DEEPSEEK_URL if DEEPSEEK_URL.endswith("/v1") else DEEPSEEK_URL + "/v1"
    body = {
        "model": DEEPSEEK_MODEL,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system,
        "messages": messages,
        "stream": True,
    }
    if DEEPSEEK_THINKING == "disabled":
        body["thinking"] = {"type": "disabled"}
    payload = json.dumps(body).encode()
    conn, response = _http_open(root + "/messages", {
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "x-api-key": DEEPSEEK_API_KEY,
        "anthropic-version": DEEPSEEK_VERSION,
    }, payload, TIMEOUT)
    if response.status == 429:
        conn.close()
        raise BackendBusy()
    if response.status != 200:
        conn.close()
        raise ValueError("DeepSeek HTTP %s" % response.status)
    return conn, response


def stream_deepseek(response, emit):
    """Traduce el SSE de Anthropic a eventos normalizados. Devuelve usage."""
    usage = {"input": 0, "output": 0}
    while True:
        line = response.readline()
        if not line:
            break
        line = line.decode("utf-8", "replace").strip()
        if not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if not data or data == "[DONE]":
            continue
        try:
            event = json.loads(data)
        except ValueError:
            continue
        kind = event.get("type")
        if kind == "message_start":
            usage["input"] = (event.get("message") or {}).get("usage", {}).get("input_tokens", 0)
        elif kind == "content_block_delta":
            delta = event.get("delta") or {}
            dtype = delta.get("type")
            # El razonamiento interno no se envía al navegador.
            if dtype in _text_types and delta.get("text"):
                emit("delta", {"text": delta["text"]})
        elif kind == "message_delta":
            usage["output"] = (event.get("usage") or {}).get("output_tokens", usage["output"])
        elif kind == "message_stop":
            break
        elif kind == "error":
            raise ValueError((event.get("error") or {}).get("message") or "DeepSeek error")
    return usage


def open_ollama(base_url, model, messages, system, temperature, max_tokens):
    parts = urllib.parse.urlsplit(base_url)
    if parts.scheme == "https":
        conn = http.client.HTTPSConnection(parts.hostname, parts.port, timeout=10,
                                           context=ssl.create_default_context())
    else:
        conn = http.client.HTTPConnection(parts.hostname, parts.port, timeout=10)
    conn.connect()
    conn.sock.settimeout(TIMEOUT)
    payload = json.dumps({
        "model": model,
        "stream": True,
        "messages": [{"role": "system", "content": system}] + messages,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
            "num_ctx": 8192,
        },
    }).encode()
    conn.request("POST", parts.path.rstrip("/") + "/api/chat", body=payload,
                 headers={"Content-Type": "application/json"})
    response = conn.getresponse()
    if response.status != 200:
        conn.close()
        raise ValueError("Ollama HTTP %s" % response.status)
    return conn, response, model


def stream_ollama(response, emit):
    usage = {"input": 0, "output": 0}
    while True:
        line = response.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            chunk = json.loads(line)
        except ValueError:
            continue
        if chunk.get("error"):
            raise ValueError(chunk["error"])
        message = chunk.get("message") or {}
        if message.get("content"):
            emit("delta", {"text": message["content"]})
        if chunk.get("done"):
            usage["output"] = chunk.get("eval_count", 0)
            usage["input"] = chunk.get("prompt_eval_count", 0)
            break
    return usage


def answer_stream(messages, system, temperature, max_tokens, emit):
    """DeepSeek primero; si no responde, Ollama .39 y luego el local."""
    attempts = []
    if DEEPSEEK_API_KEY:
        attempts.append(("deepseek", DEEPSEEK_MODEL, API_SLOTS, QUEUE_WAIT, "api"))
    attempts.append(("ollama", OLLAMA_PRIMARY_MODEL, LOCAL_SLOTS, LOCAL_WAIT, OLLAMA_PRIMARY_URL))
    attempts.append(("ollama-local", OLLAMA_FALLBACK_MODEL, LOCAL_SLOTS, LOCAL_WAIT, OLLAMA_FALLBACK_URL))

    for name, model, slots, wait, target in attempts:
        if not slots.acquire(timeout=wait):
            LOGGER.warning("Backend %s ocupado (sin slot en %.1fs)", name, wait)
            continue
        started = time.time()
        try:
            if target == "api":
                conn, response = open_deepseek(messages, system, temperature, max_tokens)
            else:
                conn, response, model = open_ollama(target, model, messages, system,
                                                    temperature, max_tokens)
            try:
                label = MODEL_LABEL if name == "deepseek" else model
                emit("meta", {"provider": name, "model": label})
                usage = stream_deepseek(response, emit) if target == "api" else stream_ollama(response, emit)
                emit("done", {
                    "provider": name,
                    "model": label,
                    "tokens": usage.get("output", 0),
                    "prompt": usage.get("input", 0),
                    "elapsed": round(time.time() - started, 2),
                })
                return name
            finally:
                conn.close()
        except BackendBusy:
            LOGGER.warning("Backend %s limitado por el proveedor", name)
            raise Busy()
        except (OSError, ValueError, KeyError, TypeError, AttributeError,
                http.client.HTTPException) as error:
            LOGGER.warning("Backend %s falló (%s)", name, type(error).__name__)
        finally:
            slots.release()
    raise Unavailable()


# ────────────────────────────  HTTP  ────────────────────────────
def client_ip(handler):
    peer = handler.client_address[0]
    if peer in ("127.0.0.1", "::1", "::ffff:127.0.0.1"):
        real = (handler.headers.get("X-Real-IP") or "").strip()
        if real and len(real) <= 64 and all(c in "0123456789abcdefABCDEF:." for c in real):
            return real
    return peer


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "ciem-gpt"
    sys_version = ""

    def log_message(self, fmt, *args):  # noqa: A003
        LOGGER.info("%s %s", self.address_string(), fmt % args)

    # ---------- respuestas ----------
    def send_json(self, status, payload, extra=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        for key, value in (extra or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.close_connection = True
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def stream_start(self, quota):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        for key, value in _quota_headers(quota).items():
            self.send_header(key, value)
        self.end_headers()
        self.close_connection = True

    def emit(self, kind, payload):
        self.sent = getattr(self, "sent", 0) + 1
        data = json.dumps({"type": kind, **payload}, ensure_ascii=False)
        self.wfile.write(("data: " + data + "\n\n").encode("utf-8"))
        self.wfile.flush()

    # ---------- validación ----------
    def origin_ok(self):
        origin = self.headers.get("Origin")
        if not origin:
            return True
        if origin in ORIGINS:
            return True
        # Mismo host (dev en cualquier puerto, o producción tras el túnel).
        host = (self.headers.get("Host") or "").split(":")[0].strip().lower()
        try:
            return bool(host) and urllib.parse.urlsplit(origin).hostname == host
        except ValueError:
            return False

    def read_messages(self):
        size = int(self.headers.get("Content-Length") or 0)
        if not 0 < size <= MAX_BODY:
            raise ValueError("Cuerpo inválido.")
        body = json.loads(self.rfile.read(size))
        messages = body.get("messages")
        if not isinstance(messages, list) or not 1 <= len(messages) <= MAX_MESSAGES:
            raise ValueError("Historial inválido.")
        clean = []
        for item in messages:
            if not isinstance(item, dict):
                raise ValueError("Mensaje inválido.")
            role = item.get("role")
            content = item.get("content")
            if role not in ("user", "assistant") or not isinstance(content, str):
                raise ValueError("Mensaje inválido.")
            content = content.strip()
            if not content or len(content) > MAX_CHARS:
                raise ValueError("Mensaje inválido.")
            clean.append({"role": role, "content": content})
        if clean[-1]["role"] != "user":
            raise ValueError("El último mensaje debe ser del usuario.")
        system = build_system(body.get("system"), len(clean) == 1)
        try:
            temperature = max(0.0, min(1.5, float(body.get("temperature", 0.7))))
        except (TypeError, ValueError):
            temperature = 0.7
        try:
            max_tokens = int(body.get("max_tokens") or MAX_TOKENS)
        except (TypeError, ValueError):
            max_tokens = MAX_TOKENS
        max_tokens = max(32, min(MAX_TOKENS_CAP, max_tokens))
        return clean, system, temperature, max_tokens

    # ---------- rutas ----------
    def do_GET(self):  # noqa: N802
        path = urllib.parse.urlsplit(self.path).path
        if path == "/health":
            self.send_json(200, {"ok": True, "service": "ciem-gpt"})
            return
        if path in ("/api/ciem-gpt/quota", "/quota"):
            self.send_json(200, quota_peek(client_ip(self)))
            return
        if STATIC_DIR:
            self.serve_static(path)
            return
        self.send_json(404, {"error": "Ruta no encontrada."})

    def do_POST(self):  # noqa: N802
        path = urllib.parse.urlsplit(self.path).path
        if path not in ("/api/ciem-gpt", "/chat"):
            self.send_json(404, {"error": "Ruta no encontrada."})
            return
        if not self.origin_ok():
            self.send_json(403, {"error": "Origen no permitido."})
            return
        try:
            messages, system, temperature, max_tokens = self.read_messages()
        except (ValueError, TypeError):
            self.send_json(400, {"error": "Mensaje inválido. Máximo 8000 caracteres."})
            return

        ip = client_ip(self)
        reserved = quota_reserve(ip)
        if not reserved["allowed"]:
            self.send_json(429, {
                "error": "quota_exceeded",
                "message": QUOTA_MESSAGE,
                "limit": reserved["limit"],
                "remaining": 0,
                "reset_at": reserved["reset_at"],
            }, _quota_headers(reserved))
            return

        self.sent = 0
        try:
            self.stream_start(reserved)
            answer_stream(messages, system, temperature, max_tokens, self.emit)
        except Busy:
            if self.sent == 0:
                quota_refund(ip)
            self.safe_emit("error", {"message": "El asistente está ocupado. Intenta en un momento."})
        except Unavailable:
            if self.sent == 0:
                quota_refund(ip)
            self.safe_emit("error", {"message": "El asistente no está disponible en este momento."})
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
        except Exception:  # noqa: BLE001
            if self.sent == 0:
                quota_refund(ip)
            LOGGER.exception("Error inesperado")
            self.safe_emit("error", {"message": "Error interno del asistente."})

    def safe_emit(self, kind, payload):
        try:
            self.emit(kind, payload)
        except (BrokenPipeError, ConnectionResetError, OSError):
            self.close_connection = True

    # ---------- estáticos (desarrollo) ----------
    def serve_static(self, path):
        import mimetypes
        path = urllib.parse.unquote(path)
        if path in ("", "/"):
            path = "/index.html"
        root = os.path.realpath(STATIC_DIR)
        full = os.path.realpath(os.path.join(root, path.lstrip("/")))
        if not full.startswith(root + os.sep) or not os.path.isfile(full):
            self.send_json(404, {"error": "Ruta no encontrada."})
            return
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        try:
            with open(full, "rb") as fh:
                body = fh.read()
        except OSError:
            self.send_json(500, {"error": "No se pudo leer el archivo."})
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype + ("; charset=utf-8" if ctype.startswith("text/") else ""))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    os.makedirs(os.path.dirname(QUOTA_DB) or ".", exist_ok=True)
    LOGGER.info(
        "listening=%s:%s primary=%s model=%s key=%s thinking=%s fallback=%s→%s quota=%s/%sh greeting=%r",
        BIND, PORT, DEEPSEEK_URL, DEEPSEEK_MODEL,
        "set" if DEEPSEEK_API_KEY else "MISSING", DEEPSEEK_THINKING,
        OLLAMA_PRIMARY_URL, OLLAMA_FALLBACK_URL, QUOTA_LIMIT, QUOTA_WINDOW_HOURS,
        GREETING,
    )
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    server.daemon_threads = True
    server.request_queue_size = 128

    def stop(_sig, _frame):
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
