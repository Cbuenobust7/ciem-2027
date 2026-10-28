# Productization Gate — Ciem Booking Starter

**Producto:** Booking Starter (repo `booking-starter`) — paquete comercializable (Codester)
**Tenant de referencia:** MasterClean Connect (instancia `masterclean-connect`), actualmente operativo
**Estado:** `OPEN` · **Última actualización:** 2026-10-11 · **Commit de referencia:** `d95b341` (tenant) · `55463fd` (producto)
**Bloqueos mínimos actuales (necesarios, no suficientes):** roles de base independientes · sin acceso compartido a secretos en el host. La **instalación reproducible quedó resuelta** el 2026-10-11 (§7.3). **Además sigue bloqueando el Scope v1.0 sin aprobar.** El detalle completo está en §7.
**Documento interno:** excluido de `DOCUMENTATION_MAP.md` y del ZIP para compradores.

---

## 1. Propósito

Determina cuándo **Booking Starter** (el producto) está suficientemente cerrado, limpio
y verificable para transformarse en un paquete comercial reutilizable, y separa esa
evaluación de lo que es operación del **tenant** y de lo que son condiciones del **host
compartido**.

**Dependencias documentales:** instalación limpia (E) ↔ `INSTALL.md`,
`CONFIGURATION.md`, `DEPLOYMENT.md`, `TROUBLESHOOTING.md`; auditoría (B) ↔
`SECURITY_AUDIT.md` y `AUDIT_FINDINGS.md` (por crear); scope (C) ↔
`SCOPE_MATRIX_V1.md` (por crear); entornos ↔ `ENVIRONMENTS.md` (por versionar) y
`ENVIRONMENT_VARIABLES.md`; empaquetado ↔ `RELEASE_PACKAGING.md` (por crear).

El Gate es binario: `OPEN` o `PASSED`. No hay estado intermedio.

### 1.1 Alcance: tenant, producto y host

Un hallazgo del tenant no es un defecto del producto, y un pendiente del producto no
bloquea la operación del tenant. Las condiciones del host compartido se evalúan aparte.

| | **MasterClean Connect** (tenant) | **Booking Starter** (producto) |
|---|---|---|
| Qué es | Instancia real en operación | Paquete vendible |
| Árbol | `/home/carlos/masterclean-connect` (752 M) | clon limpio `booking-starter-dev` (2,6 M) |
| Servicio | `mastercleanconnect.service`, `127.0.0.1:8017` | **ninguno todavía** |
| Base de datos | `marketplace_starter` (55 migraciones, 3 anuncios, 4 usuarios) | `booking_starter` y `booking_starter_dev` (0 datos) |
| Dominio | `mastercleanconnect.ciem.pe` | por definir |
| Estado | **operativo** | **dev verificado de forma reproducible (§3.5 E); prod verificado manualmente; unidades systemd pendientes** |
| Git | **Carlos puede hacer `push`; `devuser` solo puede clonar y hacer `fetch`/`pull` mediante deploy key de lectura.** | igual |

### 1.2 Repositorios

| Repositorio | Papel | Rama | Historia |
|---|---|---|---|
| `Cbuenobust7/mastercleanconnect` (privado) | Tenant MasterClean Connect, desplegado en `mastercleanconnect.ciem.pe` | `main` @ `d95b341` | Propia, 1 commit |
| `Cbuenobust7/booking-starter` | Desarrollo del producto | `main` @ `55463fd` | 13 commits; **conserva en su historial el manual de identidad del cliente** |
| `ciem-marketplace-starter-release` (local) | **Paquete saneado** para compradores | `main` @ `c9ef158` | Propia, 6 commits, sin rastros del cliente |

El árbol desplegado resuelve su Git mediante un archivo `.git` con `gitdir:` absoluto hacia
el repositorio del tenant (ver la trampa 8 de `ENVIRONMENTS.md`).

---

## 2. Regla

Solo puede declararse `PASSED` cuando **todos** los criterios obligatorios estén
verificados y exista evidencia registrada (commit, comando y salida, URL, prueba
end-to-end o documento versionado).

### 2.1 Orden de verificación

1. **G — Runtime** (bloqueante). Sin runtime de producto separado no hay dónde verificar el resto.
2. **F — Pagos** (depende de G). *En esta versión F queda **fuera de alcance por decisión**
   (sin pagos activos), así que E no depende de F: la cadena efectiva es G → E → B → A/C/D.*
3. **E — Instalación limpia** (depende de G).
4. **B — Auditoría del paquete** (depende de G, E).
5. **A, C, D** — en paralelo una vez G esté cerrado.

---

## 3. Criterios obligatorios

### 3.1 A. Fase 0 cerrada

- [ ] Booking Starter (producto) funcional extremo a extremo.
- [x] Tenant MasterClean Connect correctamente desplegado.
- [ ] Entornos de producto correctamente separados.
- [ ] Seguridad mínima verificada.

**Evidencia:** A consolida G, F, E, B, C y D. Se cierra cuando todos lo estén.

---

### 3.2 B. Auditoría del paquete

- [ ] `docs/scripts/audit_package.sh` existe y se ha ejecutado (**no existe hoy**).
- [ ] Sin hallazgos críticos.
- [ ] Hallazgos no críticos documentados en `AUDIT_FINDINGS.md` (**por crear**).

**Hallazgos abiertos (solo lo pendiente):**

| # | Hallazgo | Ámbito | Gravedad |
|---|---|---|---|
| 1 | `deploy/instalar-marketplace.sh:43` fija `APP_DIR=/home/carlos/marketplace-starter` (ruta del mantenedor, ya inexistente) y contradice el `/srv/marketplace-starter` que documenta la línea 19 | Producto | **Alta** (residuo PRODUCT-SPECIFIC + trampa: reejecutarlo recrea la ruta vieja) |
| 2 | Rol PostgreSQL `marketplace_user` **compartido** por el tenant y las dos instancias de producto | Producto + tenant | **Alta — bloqueo técnico principal** (ver §7) |
| 3 | Artefactos ajenos en la raíz: `node.tar.xz` (0 B), `wget-log`, `install.sh?_x_tr_sl=en` y `package.json` + `node_modules` de `@deepseek-ai/dsh` (373 M) | Producto | Media |
| 4 | **Duplicación de árboles**: la copia cruda `…/devuser/marketplace-starter` (755 M) convive con el clon limpio `booking-starter-dev` (2,6 M), y los bind mounts siguen apuntando a la cruda | Producto | Media |
| 5 | Cuatro documentos y el instalador citan `/home/carlos/marketplace-starter` | Producto | Baja |
| 6 | No existe el guion de auditoría ni `AUDIT_FINDINGS.md`: el propio criterio B no tiene herramienta | Producto | Media |
| 7 | `dshweb.service` publica `manage.py runserver` en `0.0.0.0:8098` (servidor de desarrollo como servicio) | Host compartido | Alta |
| 8 | `dshweb-agente.service` en bucle de reinicio: su `ExecStart` usa `/usr/bin/node` (v20) y el harness exige ≥22 | Host compartido | Media |

**Seguimiento del tenant (no defecto del producto):**

- Los *console scripts* del `venv` del tenant conservan shebangs de la ruta anterior
  (`marketplace-starter`) tras el renombrado. **No afecta al producto**: el instalador crea
  el `venv` desde cero y en las instalaciones limpias los shebangs son correctos.
  Pendiente: reconstruir el `venv` del tenant.

---

### 3.3 C. Scope v1.0

- [ ] CORE identificado.
- [ ] MODULE identificado.
- [ ] PRODUCT-SPECIFIC identificado.
- [ ] FUTURE identificado.
- [ ] Scope aprobado como definición documental de v1.0.

**Clasificación propuesta (a aprobar en `SCOPE_MATRIX_V1.md`):**

| Clase | Contenido |
|---|---|
| **CORE** | `core/`, `creatorhub_core/`, `marketplace/` (users, categories, listings, favorites, reviews, visibility), `creatorhub_core/payments_core/`, frontend base, `deploy/`, `docker-compose.yml` |
| **MODULE** | `verticals/cleaning/` (providers, services, availability, bookings) tras `CLEANING_VERTICAL_ENABLED` (ADR-10), con moderación por listing y separación cliente/proveedor |
| **PRODUCT-SPECIFIC** | Identidad `masterclean-connect`, dominio `mastercleanconnect.ciem.pe`, `HANDOFF.md`, `RENOMBRADO-MASTERCLEAN-CONNECT.md`, `SERVICE_PUBLISHING_UX_PLAN.md`, `CLEANING_VERTICAL_TECHNICAL_PLAN.md`, el `APP_DIR` del instalador y la cobertura por distrito acoplada al catálogo premium `City` |
| **FUTURE** | Precios por fecha/temporada, reserva instantánea por día, calendario visual multi-recurso, sincronización iCal, split de pagos y checkout de listings |

---

### 3.4 D. Documentación

- [x] Instalación — `docs/INSTALL.md`
- [x] Configuración — `docs/CONFIGURATION.md`
- [x] Variables de entorno — `docs/ENVIRONMENT_VARIABLES.md`
- [x] Deployment — `docs/DEPLOYMENT.md`
- [x] Troubleshooting — `docs/TROUBLESHOOTING.md`
- [x] Mapa documental — `docs/DOCUMENTATION_MAP.md`
- [ ] Entornos — `ENVIRONMENTS.md` **existe en el árbol del tenant pero no está versionado**:
  no viaja en el clon limpio `booking-starter-dev`. **Hasta que exista en ese clon, el
  criterio D continúa abierto**
- [ ] Guía de comprador alineada con la versión desplegada (`docs/BUYER_SETUP_GUIDE.md` describe v1.0.1)
- [ ] Documentación saneada de referencias a `carlos` y a rutas del servidor

---

### 3.5 E. Instalación limpia

**Producto — producción:** `/srv/chroot-produser/home/produser/marketplace-starter`
(= `/home/agente2/prod` en el chroot de `agente2`)

- [x] Código desde Git, **no copia cruda**: `git status` limpio en `c6d44eb`
- [x] Purga del contenido no versionado: **755 M → 5,7 M de código** (sin `venv`, `node_modules`, `media`, `staticfiles` ni `dist` heredados). La **instalación completa**, ya con `venv` y estáticos, queda en **211 M**
- [x] `venv` nuevo con Python del sistema (`/usr/bin/python3`, pip 26.2.1, Django 5.2.10)
- [x] Secretos **propios** (no copiados): `SECRET_KEY` distinto del de producción
- [x] Base recreada desde cero: 0 tablas → **55/55 migraciones**
- [x] `collectstatic` → 165 archivos
- [x] `manage.py check` sin incidencias
- [x] Aplicación iniciada y verificada: gunicorn en `127.0.0.1:8022`
- [x] Flujo principal verificado en API: `/api/listings/` → **200** (`{"count":0}`), `/admin/login/` → **200**
- [ ] Unidad systemd del entorno (`booking-prod.service`, puerto 8022) — requiere root
- [ ] Superusuario del entorno (la base nueva no tiene cuentas)
- [ ] Frontend construido (`npm ci && npm run build`)
- [ ] Flujo verificado en UI (borrador → revisión → aprobación → reserva)

**Producto — desarrollo:**

- [x] **Código limpio desde Git**: `booking-starter-dev`, **2,6 M de código**, sin `venv` ni secretos, en `c6d44eb`
- [x] **Instalación reproducible** con `deploy/instalar-entorno.sh dev` y evidencia con `deploy/verificar-entorno.sh dev`: **10 PASS · 0 FAIL** en clon limpio (2026-10-11), con base y puerto de prueba
- [x] `venv` nuevo, `.env` propio, base recreada desde cero → **55/55 migraciones**, 165 estáticos, `check` limpio
- [x] Arranque verificado: gunicorn en `127.0.0.1:8021` (`/api/listings/` 200, `/admin/login/` 200)
- [ ] Unidad systemd del entorno (`booking-dev.service`, puerto 8021) — requiere root

**Aislamiento verificado (2026-10-10):**

| Base | Migraciones | Anuncios | Usuarios |
|---|---|---|---|
| `marketplace_starter` (tenant) | 55 | 3 | 4 |
| `booking_starter` (producto prod) | 55 | 0 | 0 |
| `booking_starter_dev` (producto dev) | 55 | 0 | 0 |

> **Nota sobre las cifras de tamaño.** Son tres mediciones distintas y todas válidas:
> *código versionado* (`git` limpio) = **5,7 M** en producto-prod y **2,6 M** en
> producto-dev; *copia cruda previa a la purga* = **755 M**; *instalación completa lista
> para arrancar* = **211 M** (código + `venv` 201 M + estáticos 3,9 M).

---

### 3.6 F. Mercado Pago

- [x] Fuera de alcance declarado de v1.0 para esta instancia.
- [x] Claves `MERCADOPAGO_*` vaciadas en las instancias de producto para impedir cobros cruzados.
- [ ] Decidir si el tenant venderá Zona Premium (hoy `Lima` con `premium_slots_count=0`, `price=0.00`, `is_promo_mode=False`).
- [ ] Si aplica: credenciales PROD propias, webhook registrado y verificación HMAC E2E.

---

### 3.7 G. Runtime

**Tenant — verificado (2026-10-10):**

- [x] `mastercleanconnect.service` activo, `User=agenteai`, gunicorn en `127.0.0.1:8017`
- [x] Árbol activo `/home/carlos/masterclean-connect` (renombrado desde `marketplace-starter`)
- [x] `DEBUG=False` y `DJANGO_ENV=production` en la unidad
- [x] Base correcta: `marketplace_starter`
- [x] nginx `mastercleanconnect.ciem.pe` → `127.0.0.1:8017`; TLS por Cloudflare
- [x] Smoke test público: `/` 200 · `/api/listings/` 200 · `/admin/login/` 200 · `/api/cleaning/bookings/` 401 con contrato uniforme · HTTPS 200

**Producto — pendiente:**

- [ ] Runtime de producción del producto en ejecución como servicio
- [ ] Runtime de desarrollo en ejecución y aislado del de producción
- [ ] Separación de **credenciales de base** (rol propio por instancia) — §7

**Notas de entorno que el Gate exige (verificadas):**

1. **`DJANGO_ENV` se lee del proceso, no del archivo** (`core/settings.py:12`). Sin
   `Environment=DJANGO_ENV=production` en la unidad, leería `.env`. Ponerlo dentro del
   archivo **no tiene efecto**.
2. **El entorno del proceso gana al `.env`**: `python-decouple` consulta primero
   `os.environ`. La sesión del agente exporta `DB_NAME`, `DB_USER`, `DEBUG`,
   `ALLOWED_HOSTS`… y una copia llegó a resolver `marketplace_starter` en vez de su propia
   base. Toda ejecución manual debe limpiar el entorno; toda unidad debe declarar su
   `Environment=` sin heredar nada.
3. **El `venv` fija rutas absolutas**: los *console scripts* solo funcionan donde se
   crearon. Las unidades deben ejecutarse desde la ruta real (sin `RootDirectory`) o
   reconstruir el `venv` desde la vista del chroot.

---

## 4. Hallazgos resueltos

| Fecha | Hallazgo | Evidencia |
|---|---|---|
| 2026-10-11 | **El activo del cliente salió del control de versiones**: el manual de identidad vive en `~/Documentos/` y 0 PDFs están versionados en el repositorio del tenant | `git ls-files | grep -c '\.pdf$'` → 0; copia externa de 104.901 bytes |
| 2026-10-11 | **El trabajo del tenant dejó de estar en el repositorio del producto**: se creó `Cbuenobust7/mastercleanconnect` con historia propia | `masterclean-connect/.git` → `gitdir: .../masterclean-connect-tenant/.git`; `origin/main` @ `d95b341` |
| 2026-10-11 | **Guiones de entornos saneados e incorporados al paquete** | `deploy/instalar-entorno.sh` y `deploy/verificar-entorno.sh` en el paquete (commit `c9ef158`), 0 referencias al tenant |
| 2026-10-10 | **Ollama ya no está expuesto**: escucha en `127.0.0.1:11434` y su almacén está fuera del proyecto | `ss -ltn` → `127.0.0.1:11434`; `ollama.service.d/override.conf` → `OLLAMA_HOST=127.0.0.1:11434`, `OLLAMA_MODELS=/var/lib/ollama/models` |
| 2026-10-10 | `.env.production.bak.*` con secretos antiguos en las copias | Eliminados; respaldo íntegro en `/tmp/env-backup-1791655085/` |
| 2026-10-10 | Ficheros basura `echo` y `sudo` (0 B) | Eliminados de los tres árboles; `git status` limpio |
| 2026-10-10 | Copia cruda de producción con `venv`/`node_modules`/`media`/secretos heredados | Reconstruida desde Git: **755 M → 211 M de instalación completa** (código 5,7 M + `venv` 201 M + estáticos 3,9 M) |
| 2026-10-10 | `.git` con 2,03 GiB de basura (`tmp_pack`) por `.ollama` no ignorado | `.git` → 3,3 MB; `/.ollama/` en `.gitignore`; almacén movido a `/var/lib/ollama` |
| 2026-10-10 | Renombrado de raíz `marketplace-starter` → `masterclean-connect` | nginx, systemd, `fstab` y los tres bind mounts actualizados; producción recuperada y verificada |

---

## 5. Evidencia

Cada criterio se vincula a evidencia concreta: commit, comando y salida, captura, log,
URL, prueba end-to-end o documento técnico versionado.

---

## 6. Registro de aprobación

> **Plantilla.** No copiar este bloque con valores rellenos. El estado solo se escribe
> aquí cuando el Gate se aprueba formalmente, con las evidencias verificadas.

```
Estado al aprobar: ____________________
Fecha:             ____________________
Commit:            ____________________
Responsable:       ____________________

Evidencias:
1.
2.
3.
4.
5.

Observaciones:
```

---

## 7. Regla de bloqueo

| Elemento | Estado hoy | ¿Bloquea? |
|---|---|---|
| `DEBUG=True` en producción | No en el tenant | No |
| Bases de datos compartidas | No: tres bases lógicas separadas | No |
| **Credenciales compartidas** | **SÍ**: rol `marketplace_user` y su contraseña en el tenant y en las dos instancias de producto | **SÍ — bloqueo técnico principal** |
| Webhooks ambiguos | No aplica (sin pagos activos) | No |
| Instalación no reproducible | Parcial: producto-prod reproducida una vez (E); falta guion repetible y la instalación de `booking-starter-dev` | **SÍ** |
| Seguridad mínima del host compartido | Acceso efectivo a secretos del tenant por otro UID/grupo (ver abajo) | **SÍ, mientras exista el acceso** |
| Scope v1.0 indefinido | La matriz de C está propuesta, no aprobada | **SÍ** |

### 7.1 Plan de desbloqueo de credenciales

Roles objetivo, **con la propiedad real de los objetos**:

| Instancia | Base | Rol nuevo | `CREATEDB` |
|---|---|---|---|
| Tenant MasterClean | `marketplace_starter` | `mastercleanconnect_prod` | **No** |
| Producto prod | `booking_starter` | `booking_starter_prod` | **No** |
| Producto dev | `booking_starter_dev` | `booking_starter_dev` | Sí (pytest crea su base de test) |

**Antes de tocar nada: respaldo verificable y smoke test por instancia.**

```bash
# 0) RESPALDO VERIFICABLE de cada base (antes de cualquier cambio)
sudo -u postgres pg_dump -Fc marketplace_starter > /root/backup-marketplace_starter-$(date +%F).dump
sudo -u postgres pg_dump -Fc booking_starter     > /root/backup-booking_starter-$(date +%F).dump
sudo -u postgres pg_dump -Fc booking_starter_dev > /root/backup-booking_starter_dev-$(date +%F).dump
# comprobar que los tres volcados son legibles:
for f in /root/backup-*.dump; do sudo -u postgres pg_restore --list "$f" >/dev/null && echo "OK $f"; done
```

> **Regla de oro de esta migración.** No revoques permisos ni elimines
> `marketplace_user` hasta que **cada** instancia arranque correctamente con su rol
> nuevo y supere su smoke test. El orden es: crear rol → transferir base → transferir
> objetos → actualizar `.env` → reiniciar → **verificar** → y solo entonces retirar el
> rol antiguo.

```sql
-- 1) Crear los roles SIN que la contraseña pase por el historial de psql:
CREATE ROLE mastercleanconnect_prod LOGIN;
\password mastercleanconnect_prod

CREATE ROLE booking_starter_prod LOGIN;
\password booking_starter_prod

CREATE ROLE booking_starter_dev LOGIN CREATEDB;
\password booking_starter_dev

-- 2) Cambiar el dueño de cada base:
ALTER DATABASE marketplace_starter OWNER TO mastercleanconnect_prod;
ALTER DATABASE booking_starter     OWNER TO booking_starter_prod;
ALTER DATABASE booking_starter_dev OWNER TO booking_starter_dev;

-- 3) Transferir los OBJETOS que hay dentro, ANTES de retirar permisos:
\c marketplace_starter
REASSIGN OWNED BY marketplace_user TO mastercleanconnect_prod;
GRANT ALL ON SCHEMA public TO mastercleanconnect_prod;
-- repetir REASSIGN + GRANT dentro de booking_starter y booking_starter_dev
```

> **Aviso verificado.** Las **36 tablas** de `marketplace_starter` pertenecen a
> `marketplace_user`. `ALTER DATABASE ... OWNER` **no** transfiere las tablas: sin el
> `REASSIGN OWNED` —ejecutado **antes** de retirar permisos— el tenant arranca y falla con
> `permission denied for table …`. Además, `marketplace_user` tiene `rolcreaterole = f`, así
> que la creación de roles **solo puede hacerla el superusuario**.

Después hay que actualizar `DB_USER`/`DB_PASSWORD` en el `.env.production` del tenant y en
los de las dos instancias de producto, **verificar cada instancia** (arranque, `manage.py
check`, `/api/listings/` 200, `/admin/login/` 200) y **reiniciar**
`mastercleanconnect.service` (cambio en producción: requiere ventana).

### 7.2 Riesgos de plataforma (host compartido)

**No son defectos del ZIP de Codester.** Son condiciones de este servidor compartido y
**bloquean certificar el host como entorno aislado** mientras compartan acceso efectivo a
secretos, base o ficheros del producto.

| Riesgo | Medición | Consecuencia |
|---|---|---|
| `ciem-creatorhub` con `DEBUG=True` publicando tracebacks (8078/8079) y su PostgreSQL `:5433` caído | Ambas unidades corren como **`carlos`**, que pertenece al grupo **`marketplace`**, y `masterclean-connect/.env.production` es `-rw-rwx--- agente2:marketplace` → **`carlos` puede leer los secretos del tenant** | **Bloquea la certificación del host**: existe la cadena UID → secreto → base del producto. El problema no es el `DEBUG`, es el acceso |
| `dshweb.service` sirviendo `runserver` en `0.0.0.0:8098` | Puerto escuchando; unidad activa | Hallazgo de host (B-7) |
| `dshweb-agente.service` en bucle de reinicio por Node v20 | `activating (auto-restart)` | Hallazgo de host (B-8) |

**Cortar el acceso cruzado** (cualquiera de estas, de menor a mayor impacto): sacar a
`carlos` del grupo `marketplace` si no lo necesita; servir el `.env.production` del tenant
con un grupo del que `carlos` no forme parte; o ejecutar `ciem-creatorhub` con un usuario
dedicado.

### 7.3 Bloqueos mínimos actuales (necesarios, no suficientes)

1. **Roles de base independientes** por instancia, con `REASSIGN OWNED` aplicado y
   producción sin `CREATEDB` (§7.1).
2. **Sin acceso compartido a secretos en el host**: cortada la cadena UID → secreto → base (§7.2).
3. ~~**Instalación reproducible de `booking-starter-dev`** (producto dev)~~ → **resuelto
   (2026-10-11)**: guion `deploy/instalar-entorno.sh` + verificación `deploy/verificar-entorno.sh`
   con **10 PASS · 0 FAIL** en clon limpio (evidencia en §3.5 E).

> Cumplir estos dos es **necesario, no suficiente**: la tabla de §7 incluye además el
> **Scope v1.0 sin aprobar** y el **paquete saneado sin remoto (§7.4)**.
> Ninguno de ellos autoriza por sí solo el paso a `PASSED`.

### 7.4 Paquete saneado y entrega

- **Bloqueante (criterios D y E):** el historial de `booking-starter` conserva el manual de
  identidad del cliente (añadido en `8dc6b5d`, borrado en `55463fd`). Quien clone con
  historial completo lo recibe. **Mitigación: entregar siempre desde el paquete saneado**,
  nunca desde `booking-starter`.
- **Pendiente:** 7 documentos internos siguen versionados en el repositorio del producto
  (`HANDOFF.md`, `MIGRACION-SERVIDOR.md`, `RENOMBRADO-MASTERCLEAN-CONNECT.md`,
  `docs/ENVIRONMENTS.md`, este mismo Gate, `docs/SERVICE_PUBLISHING_UX_PLAN.md` y
  `docs/CLEANING_VERTICAL_TECHNICAL_PLAN.md`).
- **Pendiente:** el paquete saneado (`ciem-marketplace-starter-release`, 6 commits, incluida
  la página de producto de Codester y la guía de comprador) **no tiene remoto**.
- **Resuelto (2026-10-11):** los guiones de entornos viven en el paquete, saneados — 0
  referencias al tenant o a `booking_starter` —, con los valores por defecto alineados con
  `.env.example` y documentados en `docs/DEPLOYMENT.md`.

---

## 8. Después del Gate

```
Booking Starter (CORE + MODULE)
      ↓
Sanitización (CORE/MODULE vs PRODUCT-SPECIFIC)
      ↓
Documentación de comprador
      ↓
Packaging y ZIP
      ↓
Distribución
      ↓
Validación comercial
```

---

## 9. Historial

| Fecha | Criterio / Ámbito | Estado | Evidencia / Detalle |
|---|---|---|---|
| 2026-10-11 | Paquete saneado | Verificado | Guiones de entornos incorporados al paquete y saneados (0 rastros del cliente) |
| 2026-10-11 | Repositorios y activos | Verificado | Tenant con repositorio propio; manual del cliente fuera de git; producto y paquete saneado separados |
| 2026-10-11 | E — Reproducibilidad | Verificado | `instalar-entorno.sh` + `verificar-entorno.sh`: clon limpio → 10/10 PASS (incluido smoke HTTP) |
| 2026-10-10 | E — Producto dev | Parcial | Clon limpio `booking-starter-dev` (2,6 M de código, sin `venv` ni secretos); instalación pendiente |
| 2026-10-10 | E — Producto prod | Verificado | Desde Git, código 5,7 M (instalación completa 211 M), `venv` y secretos nuevos, base recreada, 55/55 migraciones, gunicorn en 8022 con `/api/listings/` 200 |
| 2026-10-10 | G — Tenant | Verificado | `mastercleanconnect.service` activo desde 18:01:49 en la ruta nueva; smoke test público 4/4 + HTTPS |
| 2026-10-10 | Host — Ollama | Resuelto | Escucha en `127.0.0.1:11434`; almacén en `/var/lib/ollama/models` |
| 2026-10-10 | Host — Servicios auxiliares | Hallazgo | `dshweb.service` con `runserver` en `0.0.0.0:8098`; `dshweb-agente.service` en bucle por Node v20 |
| 2026-10-10 | G — Aislamiento | Parcial | Tres bases migradas y `SECRET_KEY` distintos; **rol PostgreSQL compartido** |
| 2026-10-10 | Publicación de servicios | Verificado | Commits `10cbee4` y `c6d44eb` empujados a `origin/main` (solo Carlos empuja; `devuser` con deploy key de lectura) |
| 2026-10-10 | D — Documentación | Parcial | `ENVIRONMENTS.md` y el runbook creados pero **sin versionar** |
| 2026-10-10 | Ámbito de infraestructura | Verificado | `.git` 2,1 GB → 3,3 MB; basura `tmp_pack` eliminada; `.gitignore` saneado |
| 2026-10-10 | Renombrado de raíz | Verificado | `marketplace-starter` → `masterclean-connect`; producción recuperada |
| 2026-10-09 | Fase 2 — Vertical de limpieza | Verificado | Moderación por listing, separación cliente/proveedor, agenda y reservas (ver `HANDOFF.md` §9–§13) |
| 2026-10-09 | Gate inicial | OPEN | Sin entornos separados, sin instalación limpia, sin scope |