# Migración a un servidor — Marketplace Starter + vertical de limpieza

Guía para desplegar este ZIP en un servidor Linux (Ubuntu/Debian de referencia).
Sustituye `tudominio.com`, `/srv/marketplace-starter` y las credenciales por tus
valores.

---

## 1. Qué trae y qué no trae este ZIP

Trae: el proyecto completo (núcleo, dominio base y la vertical `verticals/cleaning/`
con sus migraciones y tests), `frontend/` en código fuente, `docs/`, las
plantillas `.env.example` y `.env.production.example`, y `deploy/` con los
ejemplos de systemd y nginx.

**No trae a propósito** (y por eso hay que generarlo en el servidor):

| No incluido | Cómo se resuelve |
|---|---|
| `.env` / `.env.production` con secretos | Se crea en el servidor desde `.env.production.example` (§3) |
| `venv/` | `python3 -m venv venv` en el servidor (§4) |
| `frontend/node_modules/` y `frontend/dist/` | `npm ci && npm run build` en el servidor (§6) |
| Binarios de PostgreSQL y Redis | Se instalan en el sistema (§2) |
| `media/` (imágenes subidas) y `staticfiles/` | Se crean en el servidor; los datos, con el dump opcional (§9) |

---

## 2. Requisitos en el servidor

- **Python 3.12** (el paquete se verificó con 3.12.3)
- **PostgreSQL 16** (el paquete declara psycopg2 y usa `btree_gist`, disponible en 13+)
- **Redis 7** — *opcional hoy*: el paquete configura `CHANNEL_LAYERS` con
  `channels-redis`, pero no existe ningún consumer, así que ningún flujo lo
  consulta. Puedes arrancar sin él y añadirlo cuando lleguen las notificaciones.
- **Node 20.19+** o **22.12+** y npm (solo para construir el frontend)
- **nginx** como reverse proxy y servidor de estáticos
- `gunicorn` viene en `requirements.txt` (no hay que instalarlo aparte)

```bash
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3-pip \
                    postgresql-16 redis-server nginx
```

Node, si no lo tienes: `curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs`

---

## 3. Base de datos y usuario del sistema

```bash
sudo -u postgres psql <<'SQL'
CREATE ROLE marketplace_user LOGIN CREATEDB PASSWORD 'CAMBIA_ESTA_CLAVE';
CREATE DATABASE marketplace_starter OWNER marketplace_user;
ALTER ROLE marketplace_user SET client_encoding TO 'utf8';
ALTER ROLE marketplace_user SET timezone TO 'America/Lima';
SQL
```

`CREATEDB` no es decorativo: `pytest` lo necesita para crear su base de test
(§8). Si no vas a correr la suite en el servidor, puedes quitarlo.

Usuario de sistema para el servicio:

```bash
sudo useradd --system --home /srv/marketplace-starter --shell /usr/sbin/nologin marketplace
```

---

## 4. Código, entorno virtual y configuración

```bash
sudo mkdir -p /srv/marketplace-starter
sudo unzip marketplace-starter-server.zip -d /tmp/bundle
sudo cp -a /tmp/bundle/marketplace-starter/. /srv/marketplace-starter/
sudo chown -R marketplace:www-data /srv/marketplace-starter
cd /srv/marketplace-starter

sudo -u marketplace python3.12 -m venv venv
sudo -u marketplace ./venv/bin/pip install --upgrade pip
sudo -u marketplace ./venv/bin/pip install -r requirements.txt
```

### El archivo de entorno: dos fases, no una

`core/settings.py` decide **qué archivo leer** según la variable de entorno del
proceso `DJANGO_ENV`:

- `DJANGO_ENV=production` → lee **`.env.production`**
- cualquier otro valor o sin definir → lee **`.env`**

Por eso `DJANGO_ENV` no puede ir dentro del archivo de entorno: se exporta en el
proceso (la unidad systemd de §7 ya lo hace).

```bash
cd /srv/marketplace-starter
sudo -u marketplace cp .env.production.example .env.production
sudo -u marketplace python -c "import secrets; print(secrets.token_urlsafe(50))"   # pega el resultado en SECRET_KEY
sudo -u marketplace nano .env.production
sudo chmod 600 .env.production
```

Rellena como mínimo: `SECRET_KEY` (nueva y distinta de la de desarrollo),
`DB_PASSWORD` (la misma de §3), `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
`FRONTEND_URL` y `BACKEND_URL`. Deja `DEBUG=False`.

`CLEANING_VERTICAL_ENABLED=True` monta `/api/cleaning/`. Las apps de la vertical
se instalan siempre (están en `INSTALLED_APPS`), así que las migraciones se
aplican igual con el flag activo o no.

---

## 5. Migraciones y superusuario

```bash
cd /srv/marketplace-starter
sudo -u marketplace env DJANGO_ENV=production ./venv/bin/python manage.py migrate
sudo -u marketplace env DJANGO_ENV=production ./venv/bin/python manage.py check
sudo -u marketplace env DJANGO_ENV=production ./venv/bin/python manage.py createsuperuser
```

> **`btree_gist` (importante).** La migración
> `cleaning_bookings.0002_booking_exclusion_constraint` ejecuta
> `CREATE EXTENSION IF NOT EXISTS btree_gist` antes de añadir la restricción de
> exclusión de agenda. Es una extensión *trusted* desde PostgreSQL 13, así que
> basta con que el usuario de migración tenga permiso `CREATE` **sobre esa base**
> (el propietario lo tiene). En un PostgreSQL gestionado que lo prohíba, habilita
> `btree_gist` desde el panel del proveedor antes de migrar; si falta, el error es
> `data type integer has no default operator class for access method "gist"`.

---

## 6. Frontend

```bash
cd /srv/marketplace-starter/frontend
sudo -u marketplace cp .env.example .env      # deja VITE_API_URL vacío
sudo -u marketplace npm ci
sudo -u marketplace npm run build             # genera frontend/dist/
```

`VITE_API_URL` vacío es lo correcto si sirves el frontend y la API en el **mismo
dominio**: `src/api/client.ts` cae a `window.location.origin`, así que no hay CORS
ni hosts incrustados en el bundle. Si la API va en otro subdominio, pon aquí su
URL pública y añádela a `CORS_ALLOWED_ORIGINS`.

Vite incrusta estas variables **en el build**: si cambias `VITE_API_URL`, hay que
reconstruir.

---

## 7. Estáticos, systemd y nginx

```bash
cd /srv/marketplace-starter
sudo -u marketplace env DJANGO_ENV=production ./venv/bin/python manage.py collectstatic --noinput
sudo mkdir -p media && sudo chown marketplace:www-data media
```

```bash
> **Nota de nomenclatura.** `deploy/marketplace.service` es una **plantilla
> genérica** y `deploy/instalar-marketplace.sh` nombra la unidad según
> `SERVICE_NAME` (por defecto `marketplace`). En el servidor de este proyecto se
> instaló con `SERVICE_NAME=mastercleanconnect`, así que allí la unidad activa es
> **`mastercleanconnect.service`** y los comandos son
> `systemctl restart mastercleanconnect`, etc. Si copias la plantilla a mano,
> hazlo con el nombre que elijas, como se muestra abajo.

```bash
# El nombre de la unidad lo decide esta variable (por defecto: marketplace).
# En el servidor de este proyecto se instaló con SERVICE_NAME=mastercleanconnect.
UNIT="${SERVICE_NAME:-marketplace}"
sudo cp deploy/marketplace.service "/etc/systemd/system/${UNIT}.service"
sudo systemctl daemon-reload
sudo systemctl enable --now "$UNIT"
sudo systemctl status "$UNIT"
```

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/marketplace
sudo ln -s /etc/nginx/sites-available/marketplace /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Certificado TLS (recomendado):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

---

## 8. Verificación

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://tudominio.com/                    # 200 (frontend)
curl -s -o /dev/null -w '%{http_code}\n' https://tudominio.com/api/listings/       # 200 (API)
curl -s -o /dev/null -w '%{http_code}\n' https://tudominio.com/admin/login/        # 200 (admin)
curl -s -o /dev/null -w '%{http_code}\n' https://tudominio.com/api/cleaning/providers/  # 200 si la vertical está activa
```

Y la suite de pruebas, que incluye la verificación de la restricción de exclusión
de agenda (necesita `CREATEDB`, ver §3):

```bash
cd /srv/marketplace-starter
# DJANGO_ENV también aquí: sin él, settings.py busca ".env" (que en el servidor
# no existe) y falla con FileNotFoundError antes de ejecutar un solo test.
sudo -u marketplace env DJANGO_ENV=production ./venv/bin/pytest -q
```

---

## 9. Migrar los datos actuales (opcional)

El ZIP **no** incluye la base de datos. Si quieres llevarte los datos que ya
tienes en local (categorías, anuncios de demostración, usuarios), junto al ZIP hay
un dump `marketplace-starter-data-*.dump`. Restáuralo **antes** de crear un
superusuario nuevo:

```bash
sudo -u postgres pg_restore --clean --if-exists --no-owner \
  --dbname=marketplace_starter ruta/al/marketplace-starter-data-*.dump
```

Ese archivo contiene hashes de contraseñas de los usuarios existentes: trátalo
como material sensible y bórralo del servidor cuando termines. Si prefieres
empezar limpio, ignora el dump y usa `createsuperuser` (§5).

---

## 10. Actualizaciones posteriores

```bash
cd /srv/marketplace-starter
sudo -u marketplace git pull          # o descomprimir el ZIP nuevo encima
sudo -u marketplace ./venv/bin/pip install -r requirements.txt
sudo -u marketplace env DJANGO_ENV=production ./venv/bin/python manage.py migrate
sudo -u marketplace env DJANGO_ENV=production ./venv/bin/python manage.py collectstatic --noinput
sudo -u marketplace bash -c 'cd frontend && npm ci && npm run build'   # solo si cambió el frontend
sudo systemctl restart mastercleanconnect
```

---

## 11. Diagnóstico rápido

| Síntoma | Causa habitual |
|---|---|
| `RepositoryEnv: FileNotFoundError` al arrancar **o al correr pytest** | Falta `DJANGO_ENV=production` en el proceso (entonces busca `.env`) o falta el archivo `.env.production` |
| `data type integer has no default operator class for access method "gist"` | `btree_gist` no está instalada en **esa** base (ver §5) |
| `DisallowedHost` | `ALLOWED_HOSTS` incompleto |
| Frontend carga pero la API falla con CORS | `CORS_ALLOWED_ORIGINS` no incluye el origen exacto (esquema incluido) |
| 404 en `/api/cleaning/...` | `CLEANING_VERTICAL_ENABLED=False` |
| Imágenes 404 | `media/` sin permisos para el usuario del servicio o nginx sin `alias /media/` |
| `pytest` falla al crear la base de test | El rol no tiene `CREATEDB` |
