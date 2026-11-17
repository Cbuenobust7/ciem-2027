import http.client
import json
import logging
import os
import re
import ssl
import threading
from urllib.parse import urlsplit
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEEPSEEK_URL = os.environ.get('DEEPSEEK_API_URL', 'https://api.deepseek.com/anthropic').rstrip('/')
DEEPSEEK_MODEL = os.environ.get('DEEPSEEK_MODEL', 'deepseek-flash')
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '').strip()
DEEPSEEK_VERSION = os.environ.get('DEEPSEEK_ANTHROPIC_VERSION', '2023-06-01')
DEEPSEEK_MAX_TOKENS = int(os.environ.get('DEEPSEEK_MAX_TOKENS', '300'))
FALLBACK_URL = os.environ.get('OLLAMA_FALLBACK_URL', 'http://127.0.0.1:11434').rstrip('/')
FALLBACK_MODEL = os.environ.get('OLLAMA_FALLBACK_MODEL', 'qwen2.5:0.5b')
# Los slots protegen a los backends, no a los visitantes: la API atiende en
# paralelo y el modelo local tiene dos hilos. El visitante espera
# CHAT_QUEUE_WAIT segundos por un hueco en vez de recibir el 429 de inmediato.
API_SLOTS = threading.BoundedSemaphore(int(os.environ.get('CHAT_API_SLOTS') or os.environ.get('CHAT_SLOTS') or '8'))
LOCAL_SLOTS = threading.BoundedSemaphore(int(os.environ.get('CHAT_LOCAL_SLOTS') or '2'))
QUEUE_WAIT = float(os.environ.get('CHAT_QUEUE_WAIT') or '2')
LOCAL_WAIT = float(os.environ.get('CHAT_LOCAL_WAIT') or '1')
LOGGER = logging.getLogger('ciem-chat')
from service_policy import CLASSIFIER, ANSWERS, approved_answer, clearly_out_of_scope


class Busy(Exception):
    """No free slot within the grace window."""


class BackendBusy(Exception):
    """The provider throttled us (HTTP 429): never pile that onto the local model."""


def conversation(messages):
    return 'Historial: ' + json.dumps(messages[:-1], ensure_ascii=False) + '\nConsulta: ' + messages[-1]['content']


def category_of(text):
    """Return the category from the model reply, tolerating fences and prose around the JSON."""
    cleaned = text.strip()
    if cleaned.startswith('```'):
        cleaned = cleaned.split('\n', 1)[-1]
        if cleaned.rstrip().endswith('```'):
            cleaned = cleaned.rstrip()[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned).get('categoria')
    except (ValueError, AttributeError, TypeError):
        for candidate in re.findall(r'\{[^{}]*\}', cleaned):
            try:
                value = json.loads(candidate).get('categoria')
            except (ValueError, AttributeError, TypeError):
                continue
            if isinstance(value, str):
                return value
        return None


def query_deepseek(messages, timeout):
    """Primary backend: DeepSeek Messages API (same endpoint and model as DeepSeek Harness)."""
    if not DEEPSEEK_API_KEY:
        raise ValueError('DEEPSEEK_API_KEY missing')
    target = urlsplit(DEEPSEEK_URL)
    if target.scheme != 'https' or not target.hostname:
        raise ValueError('Invalid backend URL')
    root = DEEPSEEK_URL if target.path.endswith('/v1') else DEEPSEEK_URL + '/v1'
    payload = json.dumps({
        'model': DEEPSEEK_MODEL,
        'max_tokens': DEEPSEEK_MAX_TOKENS,
        'temperature': 0,
        'system': CLASSIFIER,
        'messages': [{'role': 'user', 'content': conversation(messages)}],
    }).encode()
    connection = http.client.HTTPSConnection(target.hostname, target.port, timeout=4,
                                             context=ssl.create_default_context())
    try:
        connection.connect()
        connection.sock.settimeout(timeout)
        connection.request('POST', root + '/messages', body=payload, headers={
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'x-api-key': DEEPSEEK_API_KEY,
            'anthropic-version': DEEPSEEK_VERSION,
        })
        response = connection.getresponse()
        if response.status == 429:
            raise BackendBusy()
        if response.status != 200:
            raise ValueError('Backend HTTP ' + str(response.status))
        result = json.loads(response.read(200001))
        # deepseek-flash emits a thinking block first: only text blocks are the answer.
        text = ''.join(block.get('text', '') for block in result.get('content', [])
                       if block.get('type') == 'text')
        category = category_of(text)
        if not isinstance(category, str) or category not in ANSWERS:
            raise ValueError('Invalid category')
        return approved_answer(json.dumps({'categoria': category}))
    finally:
        connection.close()


def query_ollama(messages, timeout):
    """Fallback backend: local Ollama, keeps the assistant alive if the API is unreachable."""
    target = urlsplit(FALLBACK_URL)
    if target.scheme not in ('http', 'https') or not target.hostname:
        raise ValueError('Invalid backend URL')
    payload = json.dumps({
        'model': FALLBACK_MODEL,
        'stream': False,
        'format': {'type': 'object', 'properties': {'categoria': {'type': 'string', 'enum': list(ANSWERS)}}, 'required': ['categoria'], 'additionalProperties': False},
        'messages': [{'role': 'system', 'content': CLASSIFIER},
                     {'role': 'user', 'content': conversation(messages)}],
        'options': {'temperature': 0, 'num_predict': 40, 'num_ctx': 2048, 'num_thread': 2, 'num_batch': 32},
    }).encode()
    connection_type = http.client.HTTPSConnection if target.scheme == 'https' else http.client.HTTPConnection
    connection = connection_type(target.hostname, target.port, timeout=3)
    try:
        connection.connect()
        connection.sock.settimeout(timeout)
        connection.request('POST', target.path.rstrip('/') + '/api/chat', body=payload,
                           headers={'Content-Type': 'application/json'})
        response = connection.getresponse()
        if response.status != 200:
            raise ValueError('Backend HTTP ' + str(response.status))
        result = json.loads(response.read(100001))
        category = category_of(result['message']['content'])
        if not isinstance(category, str) or category not in ANSWERS:
            raise ValueError('Invalid category')
        return approved_answer(json.dumps({'categoria': category}))
    finally:
        connection.close()


def answer_with_fallback(messages):
    attempts = []
    if DEEPSEEK_API_KEY:
        attempts.append(('deepseek', API_SLOTS, QUEUE_WAIT, query_deepseek, 15))
    attempts.append(('local', LOCAL_SLOTS, LOCAL_WAIT, query_ollama, 75))
    for name, slots, wait, query, timeout in attempts:
        if not slots.acquire(timeout=wait):
            LOGGER.warning('Backend %s busy (no slot in %.1fs)', name, wait)
            raise Busy()
        try:
            return query(messages, timeout)
        except BackendBusy:
            # Provider rate limit: the visitor retries shortly, the CPU model is not disturbed.
            LOGGER.warning('Backend %s throttled by provider', name)
            raise Busy()
        except (OSError, ValueError, KeyError, TypeError, AttributeError, http.client.HTTPException) as error:
            # Log backend and error type only, never visitor messages.
            LOGGER.warning('Backend %s failed (%s)', name, type(error).__name__)
        finally:
            slots.release()
    raise RuntimeError('All chat backends failed')


class Server(ThreadingHTTPServer):
    daemon_threads = True
    # Default backlog is 5: a burst of visitors would see refused connections.
    request_queue_size = 128


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, value):
        data = json.dumps(value, ensure_ascii=False).encode()
        try:
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            # Visitor closed the tab or timed out: nothing left to answer, and no traceback.
            pass

    def do_POST(self):
        if self.path != '/api/ciem-chat':
            return self.reply(404, {'error': 'Ruta no encontrada.'})
        origin = self.headers.get('Origin')
        if origin and origin not in ('https://ciem.pe', 'https://www.ciem.pe', 'http://ciem.pe', 'http://www.ciem.pe', 'https://marketplace.ciem.pe', 'http://marketplace.ciem.pe'):
            return self.reply(403, {'error': 'Origen no permitido.'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 20000:
                raise ValueError()
            body = json.loads(self.rfile.read(size))
            messages = body['messages']
            if not isinstance(messages, list) or not 1 <= len(messages) <= 12:
                raise ValueError()
            for item in messages:
                if not isinstance(item, dict) or item.get('role') not in ('user', 'assistant') or not isinstance(item.get('content'), str) or not 1 <= len(item['content']) <= 2000:
                    raise ValueError()
            if messages[-1]['role'] != 'user':
                raise ValueError()
        except (ValueError, KeyError, TypeError):
            return self.reply(400, {'error': 'Mensaje inválido. Máximo 2000 caracteres.'})
        if clearly_out_of_scope(messages[-1]['content']):
            return self.reply(200, {'message': ANSWERS['fuera_de_tema']})
        try:
            answer = answer_with_fallback(messages)
            self.reply(200, {'message': answer})
        except Busy:
            self.reply(429, {'error': 'El asistente está ocupado. Intenta en un momento.'})
        except Exception:
            self.reply(503, {'error': 'El asistente no está disponible en este momento. Intenta más tarde.'})

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(name)s %(message)s')
    LOGGER.info('primary=%s model=%s key=%s fallback=%s model=%s api_slots=%d local_slots=%d queue=%.1fs',
                DEEPSEEK_URL, DEEPSEEK_MODEL, 'set' if DEEPSEEK_API_KEY else 'MISSING',
                FALLBACK_URL, FALLBACK_MODEL, API_SLOTS._initial_value,
                LOCAL_SLOTS._initial_value, QUEUE_WAIT)
    Server(('127.0.0.1', int(os.environ.get('CHAT_PORT', '8765'))), Handler).serve_forever()