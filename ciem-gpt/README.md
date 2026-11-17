# CIEM GPT

Asistente web de CIEM en **https://gpt.ciem.pe**. Usa **DeepSeek** como proveedor
principal y **Ollama** como respaldo, con la misma estructura que el asistente
que ya funciona en `/var/www/ciem-2027/ciem-chat`:

- Un `server.py` propio (Python stdlib) con el **fallback decidido en el servidor**.
- systemd como `carlos`, con `EnvironmentFile` para la clave.
- nginx con `location` exacta, `limit_req` y respuesta JSON cuando está ocupado.
- Frontend estático sin dependencias, con streaming token a token.

Cada visitante tiene **500 consultas gratis por día**; al agotarlas se muestra el
aviso de compra a CIEM.

![Interfaz de CIEM GPT](docs/screenshot.png)

![Conversación](docs/screenshot-chat.png)

## Arquitectura

```
navegador
   │  HTTPS
   ▼
Cloudflare (TLS, túnel)
   │
   ▼
nginx :80
   ├── /                → /var/www/ciem-2027/ciem-gpt/public
   └── /api/ciem-gpt    → 127.0.0.1:8766  (server.py)
                              ├── DeepSeek  (api.deepseek.com/anthropic, deepseek-flash)
                              ├── Ollama    192.168.1.39:11434
                              └── Ollama    127.0.0.1:11434
```

El servidor intenta **DeepSeek primero**. Si falla por error o timeout, pasa a
**Ollama de `.39`** y, si tampoco, al **Ollama local**. Si el proveedor limita
(429), responde «asistente ocupado» sin gastar cuota. El navegador no elige
proveedor ni conoce la API key: solo habla con `/api/ciem-gpt`.

Si todos fallan, la cuota **no se consume**.

## Estructura

```
ciem-gpt/
├── public/                     # docroot
│   ├── index.html
│   ├── style.css
│   ├── app.js                  # SSE normalizado, cuota y Markdown
│   ├── config.js
│   └── assets/ciem-logo.png
├── server/
│   └── server.py               # DeepSeek + Ollama, cuota y streaming
├── deploy/
│   ├── ciem-gpt-2027.service   # systemd (User=carlos)
│   ├── gpt.ciem.pe.conf        # server block de nginx
│   └── install.sh
├── docs/                       # capturas
├── start.sh                    # desarrollo
└── README.md
```

## Instalación

Requisitos: nginx, python3, usuario `carlos`, el túnel de Cloudflare apuntando
`gpt.ciem.pe` a `http://localhost:80` y `/var/www/ciem-2027` existente.

```bash
cd /home/agenteai/ciem-gpt
sudo ./deploy/install.sh
```

El instalador:

1. Respalda el destino y la config de nginx en `/var/backups/ciem-gpt/`.
2. Copia a `/var/www/ciem-2027/ciem-gpt` con permisos `644/755` y dueño `carlos`.
3. Escribe `/etc/default/ciem-gpt` (640 root:carlos) con la clave y los límites.
   La toma de `DEEPSEEK_API_KEY`, de `/etc/default/ciem-chat` o de `.deepseek.key`.
4. Instala y arranca `ciem-gpt-2027.service`; comprueba `/health`.
5. Instala la config de nginx, valida con `nginx -t` y recarga (revierte si falla).
6. Verifica `index.html`, la cuota, que `.git` esté bloqueado y que el endpoint
   antiguo `/api/deepseek` ya no exista.
7. Retira el servicio anterior `ciem-gpt-quota` si estaba instalado.

No toca `ciem-chat-2027` (el asistente de `ciem.pe` / marketplace).

## Configuración

`/etc/default/ciem-gpt`:

| Variable | Por defecto | Descripción |
|---|---|---|
| `DEEPSEEK_API_KEY` | — | Clave de DeepSeek (obligatoria para el primario) |
| `QUOTA_LIMIT` | `500` | Consultas gratis por IP y ventana |
| `QUOTA_WINDOW_HOURS` | `24` | Ventana de la cuota |
| `QUOTA_TZ_OFFSET` | `-5` | Reinicio a medianoche de Perú |
| `GLOBAL_DAILY_LIMIT` | `5000` | Tope global diario (`0` = sin tope) |
| `MAX_TOKENS` | `1024` | Tope de tokens por respuesta |
| `GREETING` | `Habla causita!` | Saludo del primer mensaje |
| `DEEPSEEK_THINKING` | `disabled` | `auto` deja el razonamiento del modelo (más lento y caro) |
| `MODEL_LABEL` | `ciem-flash` | Nombre visible del modelo (white-label) |
| `SYSTEM_PROMPT` | (interno) | Reemplaza la personalidad base del asistente |

El resto se define en la unidad systemd: `DEEPSEEK_API_URL`, `DEEPSEEK_MODEL`,
`OLLAMA_PRIMARY_URL/MODEL`, `OLLAMA_FALLBACK_URL/MODEL` y `PORT` (8766).

Tras editar: `sudo systemctl restart ciem-gpt-2027`.

### Cambiar el saludo o la personalidad

El saludo del **primer mensaje** y el de la bienvenida se definen con `GREETING`
en `/etc/default/ciem-gpt` (la página lo lee del servidor). Para cambiar el tono
completo, define `SYSTEM_PROMPT` (una sola línea) en el mismo archivo.

```bash
sudo sed -i 's|^GREETING=.*|GREETING=Habla causita!|' /etc/default/ciem-gpt
sudo systemctl restart ciem-gpt-2027
```

### Rotar la clave

```bash
sudo sed -i 's|^DEEPSEEK_API_KEY=.*|DEEPSEEK_API_KEY=sk-nueva|' /etc/default/ciem-gpt
sudo systemctl restart ciem-gpt-2027
```

### Ollama de respaldo

`192.168.1.39` debe escuchar en la LAN:

```bash
sudo systemctl edit ollama
# [Service]
# Environment="OLLAMA_HOST=0.0.0.0:11434"
sudo systemctl restart ollama
sudo ufw allow from 192.168.1.40 to any port 11434 proto tcp
```

Mientras no esté, el servidor cae al Ollama local (`127.0.0.1:11434`) y, si
tampoco hay, responde con un error claro sin gastar cuota.

## API

`POST /api/ciem-gpt` con `{messages, system?, temperature?, max_tokens?}`.
Responde `text/event-stream` con eventos normalizados:

```
data: {"type":"meta","provider":"deepseek","model":"deepseek-flash"}
data: {"type":"delta","text":"..."}
data: {"type":"reasoning","text":"..."}      # bloques de pensamiento
data: {"type":"done","provider":"deepseek","tokens":18,"prompt":12,"elapsed":3.1}
data: {"type":"error","message":"..."}
```

`GET /api/ciem-gpt/quota` devuelve `{limit, used, remaining, reset_at}`.
`GET /health` para monitorización.

Errores: `429` con el mensaje de cuota (o «asistente ocupado» desde nginx),
`400` mensaje inválido, `403` origen no permitido.

## Cuota

- Por IP real (`X-Real-IP` que pone nginx; Cloudflare restaura la IP del visitante).
- SQLite en `/var/lib/ciem-gpt/quota.sqlite3`.
- Ventana de 24 h que reinicia a medianoche de Perú.
- Al agotarse: **«Se quedó sin tokens, consulte a CIEM para comprar más.»**

Reiniciar contadores:

```bash
sudo python3 - <<'PY'
import sqlite3
c = sqlite3.connect('/var/lib/ciem-gpt/quota.sqlite3')
c.execute('DELETE FROM usage'); c.commit()
PY
```

## Desarrollo

```bash
./start.sh                                # http://127.0.0.1:8080
DEEPSEEK_API_KEY=sk-... ./start.sh
OLLAMA_PRIMARY_URL=http://192.168.1.39:11434 ./start.sh
```

`start.sh` sirve `public/` y levanta el mismo `server.py` (cuota en `/tmp`), sin
nginx.

## Seguridad

- La API key solo existe en `/etc/default/ciem-gpt` (640) y en el entorno del servicio.
- Docroot acotado a `public/`; `.git` y `deploy/` no se sirven.
- CSP sin scripts inline, `X-Frame-Options`, `nosniff`, `Referrer-Policy`.
- Origen permitido: el mismo host o la lista `ALLOWED_ORIGINS`.
- Límites de tamaño, número de mensajes y tokens por petición.

## Problemas frecuentes

| Síntoma | Causa / solución |
|---|---|
| «Servicio no disponible» | `systemctl status ciem-gpt-2027` y `journalctl -u ciem-gpt-2027 -n 50`. |
| Responde siempre Ollama | DeepSeek sin clave/saldo o inalcanzable; revisa el log (`Backend deepseek falló`). |
| 429 nada más entrar | Límite de nginx (`ciem_chat`, 10 r/min) o cuota diaria agotada. |
| 403 | `Origin` no permitido; en producción llega como `https://gpt.ciem.pe`. |
| La página no ejecuta JS | Rocket Loader de Cloudflare: desactívalo para `gpt.ciem.pe`. |
| Ollama «no disponible» | `.39` sin `OLLAMA_HOST=0.0.0.0` y el local sin modelos. |

## Licencia

[MIT](LICENSE) © 2026 Carlos Bueno
