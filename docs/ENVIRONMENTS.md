# Matriz de entornos

> **Documento interno de operación.** Fuera del índice y del ZIP de compradores
> (misma regla que `MIGRACION-SERVIDOR.md` y el plan técnico).
>
> **Estado: ejecutado lo que no requiere root (2026-10-10).** Las bases, los `.env`,
> las migraciones y las instalaciones limpias de producto están hechas (§6). Lo que
> queda está en §7 y requiere root.

## 1. Topología actual (verificada)

Cuatro árboles: el tenant en operación, dos instalaciones limpias de producto y una
copia cruda heredada pendiente de retirar.

| Árbol | Ruta real | Propietario | Tamaño | Visible también como |
|---|---|---|---|---|
| **Tenant** | `/home/carlos/masterclean-connect` | `carlos:marketplace` | 752 M | bind en los chroots como `marketplace` |
| **Producto dev** | `/srv/chroot-devuser/home/devuser/booking-starter-dev` | `devuser:devuser` | **207 M** (código 2,6 M) | — (sin bind) |
| **Producto prod** | `/srv/chroot-produser/home/produser/marketplace-starter` | `produser:produser` | **211 M** (código 5,7 M) | `/srv/chroot-agenteai/booking-prod`, `/srv/chroot-agente2/home/agente2/prod` |
| **Copia cruda (retirar)** | `/srv/chroot-devuser/home/devuser/marketplace-starter` | `devuser:devuser` | 755 M | `/srv/chroot-agenteai/booking-dev`, `/srv/chroot-agente2/home/agente2/dev` |

Los cuatro bind están en `/etc/fstab` (líneas 17-20, `bind,nofail`) → persistentes, y
**siguen apuntando a la copia cruda**: al retirarla hay que reapuntarlos a
`booking-starter-dev` o eliminarlos.

Chroots SSH (`sshd_config`): `agenteai` → `/srv/chroot-agenteai`,
`devuser` → `/srv/chroot-devuser`, `produser` → `/srv/chroot-produser`,
`agente2` → `/srv/chroot-agente2`.

## 2. Estado de cada entorno

| Dimensión | Tenant | Producto dev | Producto prod |
|---|---|---|---|
| Commit | `c6d44eb` | `c6d44eb` | `c6d44eb` |
| Base de datos | `marketplace_starter` | `booking_starter_dev` | `booking_starter` |
| Migraciones | 55 | **55** | **55** |
| Datos | 3 anuncios, 4 usuarios | 0 / 0 | 0 / 0 |
| Usuario de base | `marketplace_user` | `marketplace_user` (provisional) | `marketplace_user` (provisional) |
| `SECRET_KEY` | propio | **nuevo y distinto** | **nuevo y distinto** |
| `DEBUG` | `False` | `True` (`.env`) | `False` |
| `DJANGO_ENV` | `production` (en la unidad) | `development` | `production` |
| `venv` | heredado, **20/26 scripts rotos** | **nuevo, sano** (21/26 con shebang correcto) | **nuevo, sano** |
| Mercado Pago | credenciales existentes | **vacías** | **vacías** |
| Puerto | `8017` | `8021` | `8022` |
| Sirviendo | `mastercleanconnect.service` | **gunicorn manual (stopgap)** | no arrancado |
| Dominio | `mastercleanconnect.ciem.pe` | sin dominio público | por definir |

## 3. Matriz objetivo

| | Tenant (masterclean-connect) | Producto dev | Producto prod |
|---|---|---|---|
| Papel | Producción en curso | Desarrollo del producto | Producción del producto |
| Usuario del proceso | `agenteai` | `devuser` | `produser` |
| Árbol | `/home/carlos/masterclean-connect` | `/srv/chroot-devuser/home/devuser/booking-starter-dev` | `/srv/chroot-produser/home/produser/marketplace-starter` |
| Base | `marketplace_starter` | `booking_starter_dev` | `booking_starter` |
| Rol de base | `mastercleanconnect_prod` (pendiente) | `booking_starter_dev` (pendiente) | `booking_starter_prod` (pendiente) |
| Puerto | `8017` | `8021` | `8022` |
| Unidad | `mastercleanconnect.service` | `booking-dev.service` | `booking-prod.service` |
| `RootDirectory` | — | **—** | **—** |
| Dominio | `mastercleanconnect.ciem.pe` | sin dominio público | por definir |
| `DEBUG` | `False` | `True` | `False` |

> **Corrección respecto a la propuesta anterior:** las instalaciones limpias **no**
> usan `RootDirectory`. Su `venv` se creó en la ruta real, así que las unidades deben
> ejecutarse desde esa ruta sin chroot. El `RootDirectory` solo era necesario para
> los `venv` heredados de las copias, que tenían las rutas del chroot incrustadas.

## 4. Trampas documentadas

1. **`DJANGO_ENV` se lee del entorno del proceso, no del archivo.**
   `core/settings.py:12` usa `os.getenv("DJANGO_ENV", "development")` **antes** de
   cargar el `.env`; con `production` lee `.env.production` y con cualquier otro
   valor lee `.env`. Ponerlo dentro del archivo no tiene efecto: debe ir en
   `Environment=` de la unidad systemd.
2. **Los `venv` heredados solo resuelven dentro de su chroot.** En las copias,
   el shebang de `gunicorn` apunta a `/home/<usuario>/marketplace-starter/venv/bin/…`,
   ruta que existe **dentro** del chroot y no en el sistema real; por eso el tenant
   arrastra 20 de 26 scripts rotos tras el renombrado. Las **instalaciones limpias no
   tienen este problema**: su `venv` se creó en la ruta real y 21 de 26 scripts
   (todos los relevantes: `pip`, `gunicorn`, `django-admin`…) apuntan bien.
3. **Todo dentro de los entornos de producto apunta a su base de desarrollo o de
   producción**, incluido su `.env.production` en el caso del árbol de desarrollo,
   para que ningún `DJANGO_ENV` pueda alcanzar datos del tenant.
4. **Los artefactos pesados viajan en las copias crudas**: `venv` (201 M),
   `node_modules` (373 M), `frontend/node_modules` (168 M), `frontend/dist`,
   `staticfiles` y `media`. Conviene reconstruir dentro de cada entorno en vez de
   copiar: es lo que se hizo en las dos instalaciones limpias.
5. **Las credenciales de Mercado Pago se vaciaron en las instancias de producto**
   para que ninguna pueda cobrar con las credenciales del tenant. Los valores
   originales están en `/tmp/env-backup-*/`.
6. **El entorno del proceso GANA al archivo `.env`.** `python-decouple` consulta
   primero `os.environ` y solo después el repositorio. La sesión del agente tiene
   exportadas `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DEBUG`,
   `ALLOWED_HOSTS`, `CLEANING_VERTICAL_ENABLED` y `REDIS_*`, así que una copia
   puede arrancar contra la base de **producción** aunque su `.env` diga otra
   cosa. Comprobado: sin limpiar el entorno, el árbol de desarrollo resolvía
   `marketplace_starter`; limpiándolo, `booking_starter_dev`.
   **Toda ejecución manual debe limpiar el entorno** y las unidades systemd deben
   declarar su propio `Environment=` sin heredar nada:

   ```bash
   env -u DB_NAME -u DB_USER -u DB_PASSWORD -u DB_HOST -u DB_PORT -u DEBUG \
       -u SECRET_KEY -u ALLOWED_HOSTS -u CLEANING_VERTICAL_ENABLED \
       -u REDIS_HOST -u REDIS_PORT \
       DJANGO_ENV=development HOME=/tmp \
       <árbol>/venv/bin/python <árbol>/manage.py <comando>
   ```
7. **Un árbol nuevo no es instalable por otro usuario hasta que se le concede la
   ACL.** El clon `booking-starter-dev` nació como `devuser:devuser drwxrwsr-x`, sin
   entrada para `agenteai`, y el primer intento de crear el `venv` falló con
   `Permission denied`. La copia antigua sí la tenía. Es un paso obligatorio de
   aprovisionamiento (§9).

8. **El `.git` del tenant es un archivo con ruta absoluta fuera del árbol.**
   `/home/carlos/masterclean-connect/.git` contiene
   `gitdir: /home/carlos/masterclean-connect-tenant/.git`. Git funciona desde el host y a
   través de los binds, **pero falla dentro de cualquier chroot** (esa ruta no existe ahí) y
   **cualquier copia o `tar` del árbol pierde el vínculo con el repositorio**. Para replicar
   el entorno, clonar desde el remoto; no copiar el árbol.

## 5. Decisiones pendientes

1. **Nombre del producto**: hoy las bases siguen el repo `booking-starter`
   (`booking_starter`, `booking_starter_dev`). Renombrar una base es un
   `ALTER DATABASE ... RENAME TO ...`.
2. **Roles de base separados** (bloqueante del Gate: «credenciales compartidas»).
   Requiere superusuario: `marketplace_user` tiene `CREATEDB` pero **no `CREATEROLE`**.
3. **Dominio de producto prod** y si sustituye al tenant actual.
4. **Puertos definitivos** `8021`/`8022` (hoy libres).
5. **Retirar la copia cruda** de 755 M y reapuntar (o eliminar) los dos bind mounts
   que dependen de ella.

## 6. Ejecutado (2026-10-10, sin root)

- Creadas las bases `booking_starter` y `booking_starter_dev` (dueño
  `marketplace_user`, UTF8, `template0`).
- Escritos los `.env` de cada entorno con `SECRET_KEY` **nueva y distinta** (tres
  valores diferentes, verificados), base propia, `DEBUG` según entorno y Mercado
  Pago vacío. Permisos `640`.
- Respaldados los `.env` originales en `/tmp/env-backup-1791655085/` y eliminados los
  `.env.production.bak.*` de las copias (contenían secretos antiguos).
- Borrados los ficheros basura `echo` y `sudo` de los **tres** árboles.
- **Migraciones aplicadas** en las tres bases (55/55) con `manage.py check` limpio.
- **Instalación limpia de producto prod**: desde Git, 755 M → 211 M, `venv` nuevo,
  secretos propios, gunicorn verificado en `127.0.0.1:8022` (`/api/listings/` 200).
- **Instalación limpia de producto dev** (2026-10-10): clon limpio de 2,6 M, `venv`
  nuevo, `.env` de desarrollo, base recreada desde cero → **55/55 migraciones**,
  165 estáticos, `check` limpio, y **gunicorn sirviendo en `127.0.0.1:8021`**
  (`/api/listings/` 200, `/admin/login/` 200, `/api/cleaning/providers/` 200).
  Arranque manual desacoplado como **stopgap** hasta que exista la unidad (§7).

## 7. Pendiente (requiere root)

```bash
# 0. RESPALDO VERIFICABLE antes de tocar roles
sudo -u postgres pg_dump -Fc marketplace_starter > /root/backup-marketplace_starter-$(date +%F).dump
sudo -u postgres pg_dump -Fc booking_starter     > /root/backup-booking_starter-$(date +%F).dump
sudo -u postgres pg_dump -Fc booking_starter_dev > /root/backup-booking_starter_dev-$(date +%F).dump
for f in /root/backup-*.dump; do sudo -u postgres pg_restore --list "$f" >/dev/null && echo "OK $f"; done

# 1. Roles separados (la contraseña nunca entra en el historial)
sudo -u postgres psql <<'SQL'
CREATE ROLE mastercleanconnect_prod LOGIN;
\password mastercleanconnect_prod
CREATE ROLE booking_starter_prod LOGIN;
\password booking_starter_prod
CREATE ROLE booking_starter_dev LOGIN CREATEDB;
\password booking_starter_dev
ALTER DATABASE marketplace_starter OWNER TO mastercleanconnect_prod;
ALTER DATABASE booking_starter     OWNER TO booking_starter_prod;
ALTER DATABASE booking_starter_dev OWNER TO booking_starter_dev;
\c marketplace_starter
REASSIGN OWNED BY marketplace_user TO mastercleanconnect_prod;
GRANT ALL ON SCHEMA public TO mastercleanconnect_prod;
SQL
# repetir REASSIGN + GRANT dentro de booking_starter y booking_starter_dev
# y NO retirar marketplace_user hasta que cada instancia arranque con su rol nuevo

# 2. Unidades systemd (SIN RootDirectory: el venv está en la ruta real)
#    booking-dev.service  → User=devuser  · 8021 · Environment=DJANGO_ENV=development
#    booking-prod.service → User=produser · 8022 · Environment=DJANGO_ENV=production
#    WorkingDirectory y ExecStart con la ruta real de cada árbol

# 3. nginx, si se decide dominio para producto prod
```

## 8. Verificación de cada entorno

```bash
# identidad del entorno (no debe decir marketplace_starter)
grep -E '^(DB_NAME|DEBUG)' <árbol>/<archivo de entorno>

# arranque en seco (con el entorno limpio, ver trampa 6)
env DJANGO_ENV=<development|production> HOME=/tmp \
  <árbol>/venv/bin/python <árbol>/manage.py check

# aislamiento de datos
psql -h 127.0.0.1 -p 5432 -U marketplace_user -d booking_starter_dev \
  -c 'select count(*) from marketplace_listings_listing;'

# smoke test del entorno de desarrollo (8021) / producción (8022)
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: localhost' http://127.0.0.1:8021/api/listings/

# detener el arranque manual (stopgap) del entorno de desarrollo
PID=$(ss -ltnp | grep ':8021' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2); kill "$PID"
```

## 9. Alta de un entorno nuevo (paso obligatorio)

```bash
# 1. Clonar (devuser/produser tienen deploy key de SOLO LECTURA; Carlos controla los push)
# Tenant: git@github.com:Cbuenobust7/mastercleanconnect.git
# Producto: git@github.com:Cbuenobust7/booking-starter.git (la entrega sale del paquete saneado)
sudo -u <usuario> git clone <url-del-repositorio-correspondiente> <árbol>

# 2. Conceder ACL ANTES de instalar desde otro usuario (trampa 7)
sudo setfacl -m u:agenteai:rwx <árbol>
sudo setfacl -d -m u:agenteai:rwx <árbol>    # por defecto: lo creado después lo hereda

# 3. Instalar: /usr/bin/python3 -m venv venv · pip install -r requirements.txt
#    · escribir .env propio (SECRET_KEY nuevo) · migrate · collectstatic · check

# 4. Unidad systemd desde la ruta real y smoke test (§7 y §8)
```

> La ACL es necesaria porque **los árboles los crea el usuario del entorno** (o root)
> y nacen sin entrada para `agenteai`. Añadir el usuario al grupo no sirve si la
> sesión ya está iniciada: los grupos se resuelven al arrancar.
