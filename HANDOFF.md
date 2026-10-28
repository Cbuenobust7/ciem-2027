# Traspaso — desplegar Marketplace Starter + vertical de limpieza en este servidor

**Este documento es un relevo de contexto, no una especificación.** Existe porque
el desarrollo se hizo en otra máquina (`/home/carlos/ai_workspace`) y el agente
que trabaje aquí no tiene acceso a ese historial. Todo lo que sigue está
verificado por inspección directa de este árbol el **2026-10-09**, salvo lo
marcado como `NO VERIFICADO`.

- Ruta en el servidor: `/home/carlos/marketplace-starter` (workspace de este agente).
- Host: `192.168.1.50`, usuario `carlos`, nginx 1.24.0 (Ubuntu), gunicorn en `:8000`.
- Fuente: `find`, `grep` y lectura directa de los archivos citados.

## 1. Qué es este árbol

Extracción de `marketplace-starter-server-20261008.zip` (el ZIP está en
`/home/carlos/` de este servidor). Contiene el proyecto completo **más** la
vertical de limpieza en `verticals/cleaning/`, que no existe en el demo viejo.

La especificación oficial del diseño está en
[docs/CLEANING_VERTICAL_TECHNICAL_PLAN.md](docs/CLEANING_VERTICAL_TECHNICAL_PLAN.md).
Es la fuente de verdad arquitectónica: `ProviderAccount` es el tenant,
`ProviderMembership` el acceso, `ProviderResource` la agenda y las reservas, y
`Organization` queda fuera del MVP. Ese documento se mantiene fuera del ZIP de
compradores a propósito.

- Verificado: 5 migraciones de limpieza (`providers/0001`, `services/0001`,
  `availability/0001`, `bookings/0001`, `bookings/0002_booking_exclusion_constraint`).
- Verificado: las 4 apps se registran con labels explícitos
  (`cleaning_providers`, `cleaning_services`, `cleaning_availability`,
  `cleaning_bookings`) en [core/settings.py:226-229](core/settings.py#L226-L229).
- Verificado: las rutas se montan solo si `CLEANING_VERTICAL_ENABLED` es `True`
  ([core/urls.py:30](core/urls.py#L30), flag en [core/settings.py:223](core/settings.py#L223)).
  Las apps **siempre** se instalan, así que las migraciones se aplican con el
  flag activo o no.
- Verificado: [bookings/0002](verticals/cleaning/bookings/migrations/0002_booking_exclusion_constraint.py)
  usa `BtreeGistExtension()` antes de `AddConstraint` con `ExclusionConstraint`,
  con condición sobre `status in (requested, confirmed, in_progress)` y nombre
  `booking_no_overlap_per_resource`.

## 2. Estado de implementación

| Slice | Estado | Evidencia en este árbol |
|---|---|---|
| 0 — apps, migraciones, constraint de agenda | `[EXISTE]` | 4 apps con label, 5 migraciones, constraint de no-solapamiento |
| Providers + services | `[EXISTE]` | `providers/` y `services/` con serializers, views, permissions y tests |
| Catálogo/disponibilidad, reservas, transiciones, admin, frontend | `[NO IMPLEMENTADO]` | El plan (§10) los lista; no hay views ni urls para ellos |

Endpoints que existen hoy (verificado en
[verticals/cleaning/urls.py](verticals/cleaning/urls.py)), todos bajo
`/api/cleaning/` y solo con el flag activo:

| Ruta | Vista | Permiso |
|---|---|---|
| `providers/` | `ProviderListCreateView` | `IsAuthenticatedOrReadOnly` |
| `providers/<int:pk>/` | `ProviderDetailView` | `IsAuthenticatedOrReadOnly` |
| `providers/<int:pk>/services/` | `ProviderServicesView` | `AllowAny` |
| `providers/<int:pk>/service-areas/` | `ProviderServiceAreaListCreateView` | `IsAuthenticated` |
| `providers/<int:pk>/service-areas/<int:area_id>/` | `ProviderServiceAreaDeleteView` | `IsAuthenticated` |
| `services/` | `CleaningServiceCreateView` | `IsAuthenticated` |
| `services/<int:listing_id>/` | `CleaningServiceDetailView` | `IsAuthenticated` |

Contrato ya observado en pruebas previas: el directorio es público;
`GET /api/cleaning/services/` responde **401** y no 405 porque DRF comprueba
permisos antes del método. No es un bug; el listado público es
`/api/cleaning/providers/{id}/services/`.

Pruebas presentes (24 funciones `def test`, contadas por `grep`; **no ejecutadas
en este servidor**):

- `bookings/tests/test_exclusion_constraint.py` — 8
- `bookings/tests/test_concurrency.py` — 2
- `providers/tests/test_provider_api.py` — 6
- `services/tests/test_service_api.py` — 6
- `tests/test_url_gate.py` — 2

En la máquina de desarrollo la suite daba **23 pasan / 1 skip**, y el skip es
`test_url_gate` cuando la vertical está activa. Esa cifra es del entorno local:
aquí hay que confirmarla con el comando de §4.

## 3. Estado del despliegue en este servidor: EJECUTADO el 2026-10-09 (ver §8)

> El cuerpo de esta sección es el diagnóstico previo al despliegue y se conserva
> como registro; lo que hoy hay en el servidor está en §8.

**Verificado ausente** en este árbol: `.env`, `.env.production`, `venv/`,
`frontend/node_modules/`, `frontend/dist/`, `staticfiles/`, `media/`.
Solo hay plantillas `.env.example` y `.env.production.example`.

Observaciones de red (comprobadas con `curl` el 2026-10-09):

- `http://192.168.1.50/` → **502** de nginx (upstream del sitio por defecto caído).
- `http://192.168.1.50:8000/` → **400** de gunicorn: responde pero rechaza la
  petición (probable `ALLOWED_HOSTS`). `NO VERIFICADO` qué aplicación sirve ese
  proceso.
- `192.168.1.50:5432` cerrado desde fuera.
- Ya existe aquí un despliegue **viejo y funcionando**:
  `/home/carlos/ciem-marketplace-starter-demo` (gunicorn en `127.0.0.1:18079`,
  PostgreSQL en el puerto **5545**, Redis en **6482**, dominio `demo.ciem.pe`,
  servicio `deploy/marketplace-starter-demo.service`). **Ese árbol no tiene
  `verticals/`**: es la versión sin la vertical de limpieza. No lo toques sin
  decidirlo explícitamente; sirve de referencia de un despliegue que sí arranca.

## 4. Lo que faltaba: ejecutar la migración (hecho el 2026-10-09, ver §8)

La guía ya está escrita y adaptada a este proyecto:
[MIGRACION-SERVIDOR.md](MIGRACION-SERVIDOR.md). El orden es:

1. `venv` + `pip install -r requirements.txt` (Python 3.12).
2. `.env.production` desde la plantilla, con `SECRET_KEY` nueva, `DEBUG=False`,
   `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`, `BACKEND_URL` y
   `CLEANING_VERTICAL_ENABLED=True` si quieres `/api/cleaning/`.
3. Base y usuario PostgreSQL; `migrate` y `check` con `DJANGO_ENV=production`.
4. `npm ci && npm run build` en `frontend/` (`VITE_API_URL` vacío si API y
   frontend comparten dominio).
5. `collectstatic`, systemd ([deploy/marketplace.service](deploy/marketplace.service),
   gunicorn en `127.0.0.1:8078`) y nginx
   ([deploy/nginx.conf.example](deploy/nginx.conf.example)).
6. Verificación: `/`, `/api/listings/`, `/admin/login/` y
   `/api/cleaning/providers/` deben dar 200; y la suite:

```bash
cd /home/carlos/marketplace-starter
env DJANGO_ENV=production ./venv/bin/pytest -q
```

**Trampa ya documentada** (§11 de la guía): sin `DJANGO_ENV=production`,
`settings.py` busca `.env` y falla con `FileNotFoundError` antes de ejecutar un
solo test. Vale para arrancar la app y para pytest.

Decisión pendiente del dueño: si este despliegue va a `/srv/marketplace-starter`
(como asume la guía, con usuario de sistema `marketplace` y `sudo`) o se queda en
`/home/carlos/marketplace-starter` (sin `sudo`, como el demo viejo). La guía
asume lo primero y `deploy/marketplace.service` apunta a `/srv`.

## 5. Datos (opcional)

El ZIP de datos `marketplace-starter-data-20261008.dump` (159 KB, `pg_dump`
formato custom) **no está en este árbol**; se quedó en la máquina de desarrollo.
Contiene hashes de contraseñas: si lo copias aquí, trátalo como material
sensible y bórralo al terminar. Para empezar limpio, usa `createsuperuser`.

## 6. Acceso desde la máquina de desarrollo

El agente que escribió este documento trabaja en otra máquina y solo alcanza este
servidor por **FTP** (montaje `gvfs` en
`/run/user/1000/gvfs/ftp:host=192.168.1.50/`), sin shell: `ssh carlos@192.168.1.50`
responde `Permission denied (publickey,password)`. Por eso el despliegue queda
**pendiente de ejecución**: requiere shell local en este servidor.

Si quieres que aquel agente continúe el trabajo en vez de este, hay dos vías:
autorizar su clave SSH pública, o seguir aquí con este agente. La segunda es la
que está en uso ahora.

---

## 7. Notas verificadas el 2026-10-09 (segunda pasada)

Accesos comprobados desde la máquina de desarrollo (192.168.1.39):

- `ssh agenteai@192.168.1.50` **autentica** (contraseña válida) pero el servidor
  responde `This service allows sftp connections only`: ese usuario está atado al
  subsistema SFTP. Además su jaula es idéntica al montaje de `carlos`: solo ve
  `marketplace` (`/home`, `/srv` y `/etc` → *No such file*). **Archivos sí,
  comandos no.**
- `ssh carlos@192.168.1.50` → `Permission denied (publickey,password)`.
- Puertos abiertos desde fuera: 22, 80, 8000, 8078. Cerrado: 5432.

Estado real de lo que ya corre en el servidor (no es este proyecto):

- **`127.0.0.1:8078` está ocupado por `/home/carlos/ciem-creatorhub`** (Django
  5.2.10), **con `DEBUG=True`**: publica tracebacks con rutas del servidor y el
  nombre de la base (`ciem_creatorhub_dev`, usuario `ciem_user`, PostgreSQL en el
  puerto **5433**, que está caído → `/api/listings/` y `/admin/login/` dan 500).
  `deploy/marketplace.service` de la guía también apunta a 8078: **tal cual,
  choca**. Decisión del dueño: el marketplace va al puerto **8017**.
- `http://192.168.1.50/` (nginx) → 502: el sitio por defecto apunta a un upstream
  caído. Por eso el vhost generado usa `server_name` con la IP.
- `http://192.168.1.50:8000/` → 400 de gunicorn (sigue sin identificar).

Trampa adicional encontrada en la guía (§6): dice `cp .env.example .env # deja
VITE_API_URL vacío`, pero `frontend/.env.example` **trae**
`VITE_API_URL=http://localhost:8078`. Copiarlo literal incrusta `localhost:8078`
en el bundle de producción (justo el puerto de ciem-creatorhub). En
`frontend/src/api/client.ts` el fallback a `window.location.origin` solo ocurre si
la variable está **vacía**, así que hay que escribirla vacía a propósito.

Entregable nuevo: [deploy/instalar-marketplace.sh](deploy/instalar-marketplace.sh),
instalador idempotente que cubre §3–§7 de la guía con `PORT=8017`,
`APP_DIR=/srv/marketplace-starter`. Requiere shell **con sudo** en el servidor.

---

> **Nota de nomenclatura (2026-10-10).** `deploy/marketplace.service` es la
> **plantilla genérica** del paquete, y `deploy/instalar-marketplace.sh` genera la
> unidad a partir de la variable `SERVICE_NAME`, cuyo valor por defecto es
> `marketplace` ([instalar-marketplace.sh:47](deploy/instalar-marketplace.sh#L47)).
> En este servidor se instaló con **`SERVICE_NAME=mastercleanconnect`**, así que la
> unidad **instalada y activa** es **`mastercleanconnect.service`**. Los comandos
> operativos de este documento ya están corregidos: un `systemctl ... marketplace`
> apuntaría a un daemon inexistente.

## 8. Cierre del despliegue (2026-10-09)

Desplegado **en el sitio**, sin copiar el árbol: `APP_DIR=/home/carlos/marketplace-starter`
(el mismo que se ve por SFTP; `/srv/sftp-agente/marketplace` es un *bind mount* de él).
El guion es [deploy/instalar-marketplace.sh](deploy/instalar-marketplace.sh), en tres
modos repartidos por privilegio: `infra` (root), `app` (sin root) y `servicio` (root).

- Servicio `mastercleanconnect.service` (plantilla del paquete: `deploy/marketplace.service`): activo, `User=agenteai`, `Group=www-data`, gunicorn
  con 3 workers en **127.0.0.1:8017**. No se usó el 8078 de la guía porque lo ocupa
  `ciem-creatorhub`; y `marketplace.ciem.pe` es un vhost de **ese** proyecto, no de este.
- nginx: `/etc/nginx/sites-available/marketplace` con `server_name 192.168.1.50`.
  Ningún vhost previo reclamaba esa IP, así que no hubo conflicto de nombres.
- Base de datos `marketplace_starter`, rol `marketplace_user` con `CREATEDB` (para que
  pytest pueda crear su base de test). Secretos en `.env.production` (chmod 600,
  `agenteai:marketplace`).
- Verificado desde fuera de la máquina de desarrollo: `/` 200, `/api/listings/` 200,
  `/admin/login/` 200, `/api/cleaning/providers/` 200. `/api/cleaning/services/` da
  **401** por diseño: es el endpoint de alta autenticado, no el listado público.
- Corrección aplicada a la guía §6: `frontend/.env.example` trae
  `VITE_API_URL=http://localhost:8078`, así que copiarlo literal incrustaría esa URL en
  el bundle. El despliegue escribe la variable **vacía** a propósito; comprobado: el
  bundle no contiene `localhost:8078` y resuelve por `window.location.origin`.
- Suite de producción verificada también de forma independiente:
  `DJANGO_ENV=production ./venv/bin/pytest -q` → **24 pasan, 1 omitida**, exit 0
  (el skip es `test_url_gate` con la vertical activa). Esto cierra el cabo suelto
  de §2, donde la suite figuraba como no ejecutada en el servidor.
- Superusuario `admin` con contraseña rotada por el dueño.
- Detalle operativo: el usuario `agenteai` **no tiene HOME** (`/home/agenteai` no
  existe), así que `pip`/`npm` necesitan `HOME=/tmp/agenteai-home` si se vuelven a
  ejecutar a mano. El venv y systemd no lo necesitan.

Riesgo externo que sigue abierto, ajeno a este proyecto: `ciem-creatorhub` en `:8078`
corre con `DEBUG=True` y publica tracebacks con rutas y nombre de base a quien alcance
ese puerto.

### Actualizaciones posteriores

```bash
cd /home/carlos/marketplace-starter
git pull                                        # o descomprimir el ZIP nuevo encima
./venv/bin/pip install -r requirements.txt
sudo env DJANGO_ENV=production ./venv/bin/python manage.py migrate
sudo env DJANGO_ENV=production ./venv/bin/python manage.py collectstatic --noinput
sudo bash deploy/instalar-marketplace.sh servicio   # recrea unit + vhost y reinicia
```

Para reconstruir el frontend hace falta Node en la máquina (el servidor tiene 20.19.6,
que cumple `^20.19.0 || >=22.12.0` de Vite 8) y `HOME=/tmp/agenteai-home`.

---

## 9. Slice 2 de la vertical: implementado y probado (2026-10-09)

Continúa §7–§8. Todo vive en `/home/carlos/marketplace-starter` (el mismo árbol que
se ve por SFTP; `/srv/sftp-agente/marketplace` es un *bind mount* de él).

### Qué se implementó

| Bloque | Dónde |
|---|---|
| Disponibilidad (§7.1–7.3) | `verticals/cleaning/availability/services.py`, `views.py`, `serializers.py` |
| Reservas: creación, idempotencia, recurso libre y transiciones (§4.1, §5, §8) | `verticals/cleaning/bookings/services.py`, `views.py`, `serializers.py`, `permissions.py` |
| Agenda de recursos y miembros (§5.1) | `providers/views.py` (`resources/`, `resources/{rid}/schedule/`, `members/`) y `providers/permissions.py` (`IsProviderOwner`) |
| Contrato de error uniforme (§5.2) | `verticals/cleaning/errors.py` + `EXCEPTION_HANDLER` en `core/settings.py`, acotado a `/api/cleaning/` |
| Admin (§9.5) | `admin.py` de las cuatro apps de la vertical |
| Reseña verificada y visibilidad (§3.5, ADR-09/ADR-10) | `marketplace/reviews/` (modelo, serializer, vista, migración `0002`) y `marketplace/visibility/` (`0003` + `0004` de backfill) |
| Reputación y titularidad por señal | `verticals/cleaning/providers/signals.py` (incluye la invariante de §6.3) |
| Comando de expiración de holds | `bookings/management/commands/release_expired_holds.py` |
| Frontend (§9.6) | `frontend/src/pages/cleaning/`, `pages/provider/`, `api/cleaning.ts`, `stores/`, y el CTA en `pages/listings/ListingDetailPage.tsx` |
| Editor de agenda del proveedor | `pages/provider/ProviderSchedulePage.tsx` contra `GET/PUT .../resources/{rid}/schedule/`, con `ProviderResource`/`ResourceSchedule` en `types/api.ts`, los métodos en `api/cleaning.ts`, los hooks en `hooks/useCleaning.ts` y la conversión hora local del recurso ↔ UTC en `lib/cleaning.ts` (ADR-07) |

### Endpoints nuevos de este slice

`GET providers/{id}/availability/` · `POST|GET bookings/` · `GET bookings/{code}/` ·
`POST bookings/{code}/{confirm|decline|start|complete|cancel|mark-paid}/` ·
`GET|POST providers/{id}/resources/` · `GET|PUT providers/{id}/resources/{rid}/schedule/` ·
`POST|DELETE providers/{id}/members/` · `GET providers/{id}/bookings/`.

### Estado verificado

- **150 pruebas: 149 pasan, 1 omitida** (`env DJANGO_ENV=production ./venv/bin/pytest -q`).
- `manage.py check` y `makemigrations --check` limpios.
- Migraciones aplicadas: `cleaning_*`, `marketplace_reviews.0002`,
  `marketplace_visibility.0003` y `0004_backfill_provider_account`.
- Frontend: `tsc -b && vite build` en verde y el hash servido por nginx coincide con el
  generado; no requiere reinicio, lo sirve nginx desde `frontend/dist`. Tras cablear la
  agenda los assets son `index-CDcMc-yT.js` y `index-C2MjJvcQ.css`.
- Conversión de zona horaria del editor de agenda verificada aparte con Node (Lima UTC-5,
  Santiago con horario de verano UTC-3/UTC-4, UTC y casos de ida y vuelta): 11/11 correctos.
- En vivo: `/`, `/api/listings/`, `/admin/login/`, `/api/cleaning/providers/` → 200;
  `/api/cleaning/bookings/` → **401 con `{"code":"not_authenticated"}`**, prueba de que
  la ruta nueva y el handler están cargados.

### Pendiente

1. **Pase manual del flujo completo** (Apéndice C, punto 5): proveedor → agenda →
   disponibilidad → reserva → confirmación → completado → reseña. La base tiene hoy
   0 proveedores, así que ese recorrido no se ha hecho con datos reales.
2. **Reinicio del servicio: hecho** (`sudo systemctl restart mastercleanconnect`, 2026-10-09
   07:06:04 UTC). Antes de reiniciar, gunicorn tenía workers viejos y nuevos conviviendo
   —el master arrancó a las 05:52:20 y el código cambió a las 06:48—, así que la misma
   ruta respondía 401 (worker nuevo) o 404 (viejo) de forma intermitente (medido: 7×401 y
   1×404 en 8 peticiones). Tras el reinicio, verificado desde fuera: 6×401 consecutivos en
   `/api/cleaning/bookings/`; 3×401 en cada ruta nueva (`resources/`,
   `resources/{rid}/schedule/`, `members/`); 404 estable en una ruta inexistente; y el
   `detail` del 401 ya sin el prefijo `"detail: "`, prueba de que el normalizador está
   vivo. **Lección operativa**: desplegar código sin reiniciar deja el servicio en un
   estado mixto e impredecible; compruébalo con varias peticiones seguidas, no con una.
3. `GET /api/cleaning/featured/?city=&district=` (§9.3): diseñado y **fuera** de la lista
   de entregables de la Fase 2; sin implementar.

### Notas operativas que ahorran tiempo

- Las herramientas de escritura de DSH **fallan** sobre este montaje gvfs
  (`EPERM … link`): hay que escribir en `/tmp` y subir por SFTP con `paramiko`,
  verificando sha256.
- `agenteai` **no tiene HOME**: `pip`/`npm` a mano necesitan `HOME=/tmp/agenteai-home`.
- Los archivos de `carlos` se pueden sobrescribir por grupo (`marketplace`) pero no
  cambiar de permisos: los avisos de `chmod` son normales y no son fallos.
- **Matar un job de pytest no mata el proceso remoto**, y dos corridas simultáneas
  sobre la misma base de test producen ERROR masivos de fixture. Comprueba antes con
  `pgrep -af pytest` y limpia con `kill`.

---

## 10. Separación por rol cliente / proveedor (2026-10-09)

Motivo: en el marketplace base **cualquier usuario autenticado podía publicar**.
Un cliente debe poder reaccionar (reservar, favoritos, reseñar), no vender.

### Dónde se decide el rol

En `ProviderMembership`, como manda ADR-11. Los flags `User.is_seller`/`is_buyer`
siguen siendo **vestigiales** y no se usan para permisos ni para enrutar.

| Concepto | Regla | Dónde |
|---|---|---|
| `is_provider` | tiene alguna membership activa de una cuenta activa | `providers/permissions.py::is_provider_user` |
| `can_publish` | es `owner`/`admin` de alguna cuenta (o `is_staff` de plataforma) | `providers/permissions.py::has_publishing_membership` |
| `provider_accounts` | sus cuentas con el rol, para que el frontend no adivine | `providers/permissions.py::provider_accounts_payload` |

Los tres viajan en el usuario (`marketplace/users/serializers.py`), así que el
**login ya trae el rol** y el frontend no necesita una petición extra para saber a
qué panel enviar a cada quien.

### El gate de publicación

`CanPublishListing` (`marketplace/listings/permissions.py`) se añadió a
`ListingViewSet`. Es **acotado al flag**: con `CLEANING_VERTICAL_ENABLED=False`
devuelve `True` para cualquier autenticado y el paquete base recupera su
comportamiento original (ADR-10). El `staff` de una cuenta **no** publica (§6.1).
La lectura del catálogo sigue siendo pública.

### Frontend

- Barra pública (`components/layout/Header.tsx`): «Iniciar sesión» abre un
  **modal** (`components/auth/LoginModal.tsx`) que enruta por rol
  (`is_provider` → `/provider/dashboard`; cliente → ruta de origen o `/`),
  «Registrarse» (registro ultraligero de cliente) y el enlace destacado
  «¿Eres una empresa de limpieza? Únete como proveedor» → `/unete`.
- «Publicar anuncio» y «Mis anuncios» solo aparecen con `can_publish`.
- `/unete` (y el alias `/proveedores`): beneficios + formulario enriquecido;
  sin sesión registra al usuario y después crea la cuenta; con sesión solo la
  crea; termina en `/provider/dashboard`.
- `RequirePublisher` protege `/listings/new`, `/listings/:id/edit` y
  `/my-listings`: sin sesión → `/login`; con sesión sin `can_publish` → `/unete`
  con aviso, en vez de un 403 seco.
- `components/Header.tsx` (código muerto con el markup antiguo) pasa a reexportar
  el de `layout/` para que no haya dos barras divergentes.

### Verificación

- **165 pruebas: 164 pasan, 1 omitida**, incluidos 15 tests nuevos de roles
  (`verticals/cleaning/providers/tests/test_roles.py`): cliente 403, owner/admin
  201, `staff` 403, plataforma 201, sin sesión 401, lectura pública intacta, con
  la vertical apagada se recupera el comportamiento base, el perfil y el login
  traen el rol, y una membership o cuenta inactiva no da rol.
- Frontend: `tsc -b && vite build` en verde; los assets servidos por nginx
  (`index-B528JLRn.js`, `index-yV_ttxbk.css`) coinciden con el build, reproducido
  de forma independiente.

### Pendiente / fuera de alcance

1. **`logo` en el alta de proveedor**: es `ImageField` multipart y
   `cleaningApi.createProvider` envía JSON; falta un camino multipart.
2. **Aviso de Vite**: el chunk principal pasa de 500 kB (505.68). Se corrige con
   code-splitting, fuera del alcance de este cambio.
3. `/login` sigue existiendo como página (la usan los redirects), además del modal.
4. **No hay tests de frontend** en el proyecto: la verificación es compilación,
   hash del bundle servido y la suite de backend.

---

## 11. Deuda técnica del §10, resuelta (2026-10-09)

### 1. Logo del alta de proveedor: multipart

El backend **ya estaba listo**: `ProviderListCreateView` declara
`parser_classes = [JSONParser, MultiPartParser, FormParser]` y el serializer ya
incluía `logo`. El único cambio necesario era el frontend:

- `api/cleaning.ts::createProvider(payload, logo)`: si hay logo, la petición va
  como `FormData`; si no, sigue en JSON. **No** se fija el `Content-Type` a mano:
  axios detecta el `FormData` y en el navegador borra la cabecera para que la
  ponga el navegador con su `boundary` (verificado en el propio código de axios,
  `lib/helpers/resolveConfig.js:73`, no asumido).
- `hooks/useCleaning.ts::useCreateProvider` recibe `{payload, logo}`. Ojo: hubo
  un segundo consumidor (`ProviderAccountGate`) que el compilador delató.
- `JoinPage`: input de archivo con `accept` de imágenes y aviso de qué se enviará.
- 4 pruebas nuevas en `providers/tests/test_provider_media.py`: alta multipart con
  logo (se guarda el archivo y se crea la membership `owner`), alta sin logo por
  JSON, logo opcional en multipart y anónimo rechazado. Usan un `MEDIA_ROOT`
  temporal para no dejar archivos en el `media/` del proyecto.

### 2. Bundle de Vite: 505,68 kB → 276,37 kB

Resuelto con **carga perezosa de rutas** (`React.lazy` + `Suspense` en `App.tsx`):
la única página ansiosa es el catálogo (`HomePage`); el panel de proveedor, el
asistente de reserva, la agenda, la moderación y los pagos pasan a chunks propios.
El aviso de «chunk mayor de 500 kB» **desaparece** sin tocar `vite.config.ts`.

> Corrección a la receta habitual: este proyecto usa **Vite 8 con rolldown**, así
> que `build.rollupOptions.output.manualChunks` no aplica (el propio aviso apunta a
> `build.rolldownOptions.output.codeSplitting`). No hizo falta: medido antes y
> después, la carga perezosa bastó.

### 3. Login unificado

`components/auth/LoginForm.tsx` es ahora el único formulario; el modal
(`LoginModal`) y la página (`LoginPage`) son envoltorios delgados que solo deciden
a dónde ir. Efecto colateral que arregla un fallo real: **`/login` no enrutaba por
rol** (un proveedor que entrara por esa página acababa en el catálogo) ni
preseleccionaba su cuenta; ahora ambas cosas las hace el formulario compartido.

### Estado verificado

- **169 pruebas: 168 pasan, 1 omitida**; `manage.py check` limpio.
- Build del frontend reproducible: `tsc -b && vite build` en verde, chunk principal
  `index-*.js` de 276,37 kB y un chunk por página.

### Dos cosas que conviene tener presentes

1. **Fallo transitorio, no reproducible.** En una corrida completa falló
   `services/tests/test_service_api.py::test_services_are_listed_publicly_only_after_listing_is_published`
   («un servicio no se lista hasta publicar el anuncio»). No se reprodujo ni en
   aislado, ni por archivo, ni en el par ordenado, ni en la suite completa
   posterior, y una **sonda transaccional** contra la base real confirmó el
   comportamiento correcto (`draft` → el endpoint público devuelve `[]`, el de
   gestión `/services/manage/` sí lo muestra). La explicación más probable: el
   módulo se importó mientras se estaba guardando una edición. Si vuelve a pasar,
   reproduce primero con el test aislado antes de tocar código.
2. **Correr dos suites a la vez se pisa.** Ya pasó dos veces: dos `pytest`
   concurrentes sobre la misma base de test dan ERROR masivos de fixture. Para
   verificar en paralelo, aísla la base:
   `DB_NAME=marketplace_starter_verify ./venv/bin/pytest -q` (decouple da
   prioridad al entorno sobre el archivo `.env`). Comprueba antes con
   `pgrep -af pytest`.

### Moderación de servicios: cubierta con pruebas (2026-10-09)

El flujo `draft → pending_review → active|rejected` —aprobación/rechazo y
aprobación masiva en el admin, con `reviewed_by`/`reviewed_at`— tenía superficie
nueva y cero red de seguridad. Ya no: **24 pruebas** en
`verticals/cleaning/providers/tests/test_listing_moderation.py`, que cubren la
máquina de estados (solo `draft`/`rejected` van a revisión; enviar limpia el
motivo y la revisión anterior; aprobar y rechazar registran revisor y fecha), las
acciones de la API (`submit-review` 200/400/403/409; `publish` de un servicio
exige aprobación; un anuncio normal sin `ServiceDetails` se sigue publicando
directo), la visibilidad pública frente a la privada del panel, el retorno a
`draft` al editar un servicio `active` o `rejected`, y la aprobación masiva del
admin (que solo toca servicios en `pending_review`), y el estampado de
revisor y fecha cuando un admin cambia el estado a mano en el formulario.

Suite total: **193 pruebas, 192 pasan y 1 omitida**.

---

## 12. Moderación de servicios por listing (2026-10-09)

### Decisión de producto

No se congela una cuenta de proveedor completa mientras la plataforma revisa su
oferta. Un proveedor puede crear su perfil, configurar zonas, recursos, agenda y
servicios desde el primer momento; la moderación se hace **por servicio**. Esto
permite revisar precio, descripción, fotos y requisitos específicos sin bloquear
la operación de la empresa.

La implementación reutiliza `marketplace_listings.Listing`; **no** existe un
modelo paralelo `ServiceListing`. Un servicio de limpieza es el `Listing` ya
existente más su `ServiceDetails` (ADR-02).

### Estados y datos de auditoría

La migración aplicada `marketplace_listings.0004_service_listing_moderation`
añade a `Listing`:

- Estados `pending_review` (pendiente de revisión) y `rejected` (rechazado),
  además de los estados existentes `draft`, `active`, `paused`, `sold` y
  `expired`.
- `rejection_reason`, `reviewed_at` y `reviewed_by`.

El flujo de un servicio es:

```text
draft o rejected --POST /api/listings/{id}/submit-review/--> pending_review
pending_review --Admin aprueba--> active
pending_review --Admin rechaza con motivo--> rejected
active o rejected --proveedor edita--> draft
```

Solo `active` se expone en catálogo público, disponibilidad y reservas. El
método legado `POST /api/listings/{id}/publish/` no permite a un proveedor activar
un servicio: responde 403 e indica que debe enviarlo a revisión; `is_staff` de
plataforma puede aprobarlo. Los listings no pertenecientes a la vertical conservan
su publicación normal.

### Backend y Admin

| Responsabilidad | Archivo |
|---|---|
| Estados, transición y auditoría | `marketplace/listings/models.py` |
| Migración aditiva aplicada | `marketplace/listings/migrations/0004_service_listing_moderation.py` |
| Envío a revisión y bloqueo de publicación directa | `marketplace/listings/views.py` |
| Acción masiva de aprobación y auditoría de cambios manuales | `marketplace/listings/admin.py` |
| Al editar un servicio activo/rechazado vuelve a borrador | `verticals/cleaning/services/serializers.py` |
| Catálogo público solo `active` | `verticals/cleaning/providers/views.py::ProviderServicesView` |
| Panel privado del proveedor, con borradores/pendientes/rechazos | `ProviderManagedServicesView`, ruta `GET providers/{id}/services/manage/` |

La separación público/privado se corrigió tras una prueba real: inicialmente el
endpoint público `GET providers/{id}/services/` enseñaba borradores cuando el
owner estaba autenticado. Eso rompió el aislamiento y una prueba existente lo
detectó. La solución definitiva no fue condicionar el endpoint público por el
usuario, sino mantenerlo exclusivamente `active` y crear el endpoint privado
`services/manage/`, limitado a `owner`/`admin`.

### Frontend

- `/unete` (también `/proveedores`) crea primero el usuario si no hay sesión y
  después la cuenta `ProviderAccount` con membership `owner` y recurso
  `Principal`.
- El registro `/register` es deliberadamente ligero y crea cliente.
- La barra solo muestra publicación a quien trae `can_publish=true`; un cliente
  puede reservar, guardar favoritos y reseñar, pero no publicar.
- `ProviderServicesPage` consulta el listado privado, muestra el estado y el
  motivo de rechazo, y usa «Enviar a revisión» para los servicios `draft` o
  `rejected`.
- Los tipos y cliente HTTP están en `frontend/src/types/api.ts`,
  `frontend/src/api/listings.ts` y `frontend/src/hooks/useListings.ts`.

### Verificación final de este cambio

Ejecutada después de aplicar la migración y antes de este relevo:

```bash
sudo -u agenteai env DJANGO_ENV=production venv/bin/python manage.py check
sudo -u agenteai env DJANGO_ENV=production venv/bin/pytest -q
sudo -u agenteai env HOME=/tmp/agenteai-home \
  bash -c 'cd /home/carlos/marketplace-starter/frontend && npm run build'
sudo systemctl restart mastercleanconnect
```

Resultado: `check` limpio, `pytest` verde con un único skip esperado, y
`tsc -b && vite build` verde (218 módulos). El bundle vigente incluye
`ProviderServicesPage-WqcQgRYz.js` e `index-C6kNGjeJ.js`. La migración
`0004_service_listing_moderation` se aplicó correctamente; `makemigrations
--check` no detectó cambios.

### Operación diaria de moderación

1. El proveedor crea o edita un servicio y pulsa «Enviar a revisión».
2. Operaciones abre `/admin/`, filtra Listings por `pending_review`, revisa el
   servicio y sus imágenes.
3. Para aprobar, usa la acción «Aprobar servicios seleccionados» o cambia el
   estado a `active`. Se registra automáticamente revisor y fecha.
4. Para rechazar, cambia el estado a `rejected`, escribe un motivo claro en
   `rejection_reason` y guarda. También se registra revisor y fecha.
5. El proveedor corrige el servicio; la edición lo devuelve a `draft` y limpia
   el resultado de la revisión anterior antes de reenviarlo.

### Pendiente de aceptación manual

El único pendiente funcional continúa siendo un recorrido real con cuentas y
datos de prueba: cliente no puede publicar; proveedor crea servicio; lo envía a
revisión; admin aprueba o rechaza; servicio activo aparece públicamente; cliente
reserva, proveedor completa y cliente deja reseña. Este recorrido no se ha
sustituido por la suite porque la base de producción empezó sin proveedores.

### Actualización futura

Tras cualquier cambio de backend o frontend, aplicar siempre el orden:

```bash
cd /home/carlos/marketplace-starter
sudo -u agenteai env DJANGO_ENV=production venv/bin/python manage.py migrate
sudo -u agenteai env DJANGO_ENV=production venv/bin/python manage.py check
sudo -u agenteai env DJANGO_ENV=production venv/bin/pytest -q
sudo -u agenteai env HOME=/tmp/agenteai-home \
  bash -c 'cd /home/carlos/marketplace-starter/frontend && npm run build'
sudo systemctl restart mastercleanconnect
```

El reinicio es obligatorio para que todos los workers de Gunicorn carguen el
mismo código; validar después varias peticiones consecutivas, como se documenta
en §9.

---

## 13. Dominio público, TLS e incidentes resueltos (2026-10-09)

### Dominio canónico

El despliegue público es **https://mastercleanconnect.ciem.pe/**. nginx sirve el
SPA desde `frontend/dist` y hace proxy de `/api/`, `/admin/` y `/static/` a
Gunicorn en `127.0.0.1:8017`; HTTP redirige a HTTPS y el certificado TLS es
válido.

`.env.production` debe contener el dominio canónico en estas variables:

```env
ALLOWED_HOSTS=mastercleanconnect.ciem.pe,192.168.1.50,localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=https://mastercleanconnect.ciem.pe
CSRF_TRUSTED_ORIGINS=https://mastercleanconnect.ciem.pe
FRONTEND_URL=https://mastercleanconnect.ciem.pe
BACKEND_URL=https://mastercleanconnect.ciem.pe
```

`VITE_API_URL` permanece vacío intencionadamente: el cliente API usa
`window.location.origin`, por lo que no hay que reconstruir el frontend cuando
solo cambia el dominio. El archivo de entorno se lee al iniciar: cada cambio
requiere `sudo systemctl restart mastercleanconnect`.

### Incidente: DisallowedHost por un typo de dominio

Durante el cambio, `/` seguía en 200 (nginx devuelve estáticos) mientras todas
las rutas Django devolvían 400. La causa fue un typo: `marketplaceconnect` en
lugar de `mastercleanconnect` en `.env.production`. Diagnóstico:

```bash
systemctl show mastercleanconnect -p WorkingDirectory -p ExecMainStartTimestamp --value
sudo -u agenteai grep -E '^(ALLOWED_HOSTS|CORS_ALLOWED_ORIGINS|CSRF_TRUSTED_ORIGINS|FRONTEND_URL|BACKEND_URL)=' \
  "$(systemctl show mastercleanconnect -p WorkingDirectory --value)/.env.production"
```

Si el archivo contiene el dominio correcto pero la API sigue en 400, reiniciar
el servicio y comparar la marca de inicio con la de edición. Lección: no
confundir una raíz estática 200 con un backend sano.

### Incidente: pantalla blanca en `/unete` (React #185)

`/unete` devolvía shell 200 y el chunk `JoinPage-*.js` también 200, pero React
mostraba error minificado #185: «Maximum update depth exceeded». El selector de
Zustand de `JoinPage` usaba `s.user?.provider_accounts ?? []`, creando una lista
nueva en cada render sin sesión y produciendo un bucle infinito.

Se corrigió con `useProviderAccounts()` de `frontend/src/stores/auth.ts`, que
usa la constante de módulo `SIN_CUENTAS`. Regla: nunca usar `?? []` ni `?? {}`
en selectores Zustand ni como dependencia derivada de render; usar referencias
estables. Para diagnosticar futuros errores minificados, reproducir con
`npm run dev`: React muestra el mensaje y componente sin minificar.

Build corregido, servido por nginx sin reinicio:

- `assets/index-_qodR5Ty.js`
- `assets/JoinPage-U8uIQ5hH.js`

El aviso de TronLink observado en consola pertenece a una extensión del
navegador y es independiente de la aplicación.

### Verificación por dominio y TLS

| Ruta | Resultado esperado/verificado |
|---|---|
| `/` | 200 (shell SPA) |
| `/api/listings/` | 200 JSON |
| `/admin/login/` | 200 |
| `/api/cleaning/providers/` | 200 |
| `/api/cleaning/bookings/` | 401 con contrato `{code, detail, extra}` |

### Pendientes de operación (actualizados)

1. Antes del pase manual, revisar/eliminar los datos de prueba que no se quieran
   conservar en producción.

### Actualización §13 — proxy HTTPS y ErrorBoundary (2026-10-09)

Resuelto:

- `core/settings.py` define `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')`
  y lee `CSRF_TRUSTED_ORIGINS` desde `.env.production`. Verificado con
  `DJANGO_ENV=production manage.py check` y una aserción de configuración contra
  `https://mastercleanconnect.ciem.pe`.
- `frontend/src/components/ui/ErrorBoundary.tsx` rodea las rutas en `App.tsx`,
  fuera de `Suspense`. Un error de render muestra recuperación («Recargar» o «Ir
  al inicio») en lugar de dejar el SPA en blanco. El build pasó con 219 módulos;
  bundle principal actual: `index-43GnDzpf.js`.

`SECURE_PROXY_SSL_HEADER` requiere reinicio de `mastercleanconnect.service` para entrar
en los workers; el ErrorBoundary ya está publicado porque nginx sirve
`frontend/dist` directamente.
