# Plan técnico — Vertical de limpieza sobre Marketplace Starter v1.0.1

**Especificación técnica oficial · Arquitectura congelada · Estado: Fase 2 implementada y probada; moderación por servicio y separación cliente/proveedor desplegadas; pendiente el pase manual de aceptación (Apéndice C).**

Este documento diseña la vertical de limpieza (servicios, agenda, reservas,
reputación, dinero) sobre la base ya desplegada y verificada de Marketplace
Starter. Su objetivo declarado es que la **Fase 2 (implementación del MVP) sea
una ejecución casi mecánica de lo aquí escrito**: modelos, campos, índices,
restricciones, estados, endpoints, permisos, transacciones y pruebas quedan
especificados con el detalle suficiente para programarlos sin volver a decidir
nada estructural.

- Base auditada: `marketplace-starter-v1.0.1` (paquete comercial v1.0.1).
- Despliegue de referencia: `/home/carlos/ai_workspace/marketplace-starter-v1.0.1`
  (Django 5.2.10 · DRF 3.16.1 · React 19 · Vite 8 · PostgreSQL 16.15 · Redis 7.0.15).
- Fecha: 2026-10-08.
- Documento de trabajo original: `verticals/cleaning/PLAN-TECNICO-CLEANING.md`.
- Esta es la fuente oficial en el árbol fuente del proyecto y queda excluida del
  ZIP para compradores. Los cambios posteriores deben hacerse aquí para evitar
  que existan dos especificaciones divergentes.

### Estado de implementación

- `[EXISTE]` Slice 0: cuatro apps Cleaning instaladas con labels explícitos,
  rutas condicionadas por `CLEANING_VERTICAL_ENABLED`, migraciones iniciales y
  constraint PostgreSQL de no-solapamiento. Aceptación: 11 pruebas pasaron en
  PostgreSQL; `manage.py check` y `makemigrations --check` limpios.
- `[EXISTE]` Providers + services: perfiles y directorio, alta de cuenta con
  membership `owner` y recurso `Principal`, gestión de zonas, creación atómica
  de `Listing` + `ServiceDetails`, edición por owner/admin y `service_details`
  en el detalle del listing. `manage.py check` limpio tras este slice.
- `[EXISTE]` Slice 2 (Fase 2 completa, salvo el pase manual): disponibilidad
  calculada sin materializar slots (§7) en `verticals/cleaning/availability/`;
  creación de reservas con idempotencia, recurso libre automático y traducción de
  SQLSTATE (§8) en `verticals/cleaning/bookings/services.py`; máquina de
  transiciones de §4.1; permisos de §6.2 y aislamiento de §6.4 en
  `bookings/permissions.py` y `providers/permissions.py`; agenda de recursos y
  miembros (§5.1) en `providers/views.py`; admin de §9.5 en los cuatro `admin.py`;
  reseña verificada (ADR-09) con agregado de reputación por señal; y pago de
  reserva por señal (`payment_type='booking'`) en `bookings/signals.py`.
- `[EXISTE]` Contrato de error uniforme `{code, detail, extra}` (§5.2) en
  `verticals/cleaning/errors.py`, con un `EXCEPTION_HANDLER` acotado a
  `/api/cleaning/` para no alterar el formato del marketplace base.
- `[EXISTE]` Frontend mínimo de §9.6: ocho rutas de limpieza y proveedor en
  `frontend/src/App.tsx`, más el CTA «Reservar» en `ListingDetailPage`.
- `[EXISTE]` Moderación de servicios publicados: `Listing.status` recorre
  `draft → pending_review → active | rejected` con `rejection_reason`,
  `reviewed_by` y `reviewed_at`; el proveedor envía su borrador o su rechazo a
  revisión desde el panel, editar un anuncio `active`/`rejected` lo devuelve a
  `draft`, y el admin aprueba o rechaza (también en masa) registrando revisor y
  fecha. Migración `marketplace_listings/0004_service_listing_moderation`.
  24 pruebas en `verticals/cleaning/providers/tests/test_listing_moderation.py`
  (máquina de estados, acciones de la API, visibilidad pública/privada, retorno a
  `draft` al editar y aprobación masiva del admin).
- [EXISTE] Despliegue público TLS en https://mastercleanconnect.ciem.pe/ con nginx
  y gunicorn en 127.0.0.1:8017; ALLOWED_HOSTS, CORS, CSRF y URLs públicas
  apuntan al dominio. Se corrigieron DisallowedHost por typo y React #185 en
  /unete (ver HANDOFF §13). HTTPS proxy y CSRF configurados.

- `[EXISTE]` Separación por rol cliente/proveedor: el rol lo decide
  `ProviderMembership` (ADR-11) y viaja en el usuario (`is_provider`,
  `can_publish`, `provider_accounts` en `marketplace/users/serializers.py`);
  publicar queda cerrado a `owner`/`admin` con `CanPublishListing`
  (`marketplace/listings/permissions.py`), gate **acotado al flag**: con
  `CLEANING_VERTICAL_ENABLED=False` el paquete base recupera su comportamiento.
  Frontend: barra pública con modal de login que enruta por rol, registro
  ultraligero de cliente, landing `/unete` con alta de proveedor y
  `RequirePublisher` protegiendo las rutas de publicación.
- Verificación en el servidor de referencia (2026-10-09): **193 pruebas, 192 pasan
  y 1 omitida**; `manage.py check` y `makemigrations --check` limpios; migraciones
  de la vertical y de §3.5 aplicadas. En `pytest.ini` y `conftest.py` la forma real
  es la del repositorio, no la del ejemplo de §11.1.
- `[PENDIENTE]` Apéndice C punto 5: pase manual del flujo completo con datos reales
  (proveedor → agenda → disponibilidad → reserva → confirmación → completado →
  reseña).

### Estado de esta especificación

La arquitectura queda congelada para la Fase 2: `ProviderAccount` es el tenant,
`ProviderMembership` define el acceso de sus usuarios, `ProviderResource` tiene
agenda y reservas, y `Organization` queda fuera del MVP y se ubicará por encima
de `ProviderAccount` en la Fase 5. Los valores predeterminados de producto y las
correcciones de consistencia detectadas en la revisión final se registran en
§12.1. Este estado describe el diseño aprobado; no afirma que el código exista.

---

## 0. Cómo leer este documento

Cada afirmación sobre el estado del código lleva una etiqueta. **No hay ninguna
afirmación sin etiqueta**: si algo no está marcado, es un error del documento.

| Etiqueta | Significado |
|---|---|
| `[EXISTE]` | Está en el paquete v1.0.1 y fue verificado en el despliegue local. |
| `[AUSENTE]` | Se verificó que la capacidad no está implementada en el paquete v1.0.1. |
| `[PROPUESTO]` | Se diseña aquí y se implementa en la Fase 2 (MVP). |
| `[FASE 3]` | Se implementa después del MVP (operación, documentos de verificación, notificaciones y experiencia ampliada de reputación). |
| `[FASE 4]` | Dinero real: comisión y split con Mercado Pago Marketplace. |
| `[FUTURO]` | Fuera del alcance actual; se menciona solo para no cerrar puertas. |

Regla de oro del documento: **nunca se asume que algo existe por estar en la
documentación de producto o en la visión de negocio.** Toda afirmación sobre el
estado del paquete se marca `[EXISTE]` o `[AUSENTE]`; todo `[EXISTE]` tiene una
referencia a archivo y línea. Las decisiones nuevas se marcan `[PROPUESTO]`,
`[FASE 3]`, `[FASE 4]` o `[FUTURO]` según cuándo se implementen.

---

## 1. Estado actual verificado (Fase 0 — auditoría)

> **Auditoría histórica del paquete base v1.0.1, antes de implementar la Fase 2.**
> Las marcas `[AUSENTE]` de esta sección —incluidas «Booking / reservas» y
> «Disponibilidad / calendario»— describen el **paquete comercial v1.0.1 auditado
> el 2026-10-08**, no el estado actual del árbol. Hoy esas capacidades existen:
> ver §12 de `HANDOFF.md` y `docs/SERVICE_PUBLISHING_UX_PLAN.md`. Se conserva
> como registro de por qué se diseñó la vertical.

### 1.1 Lo que el paquete ya entrega

| Capacidad | Estado | Evidencia |
|---|---|---|
| Separación núcleo/producto | `[EXISTE]` | `creatorhub_core/` (users, payments_core) vs `marketplace/*` en [settings.py:82-89](../core/settings.py#L82-L89) |
| Usuario propio con flags de rol | `[EXISTE]` | [`marketplace/users/models.py:6-18`](../marketplace/users/models.py#L6-L18) (`is_seller`, `is_buyer`, `preferred_city`) sobre [`CreatorHubUser:13-15`](../creatorhub_core/users/models.py#L13-L15) (`email` único, `is_verified`) |
| Auth JWT por email | `[EXISTE]` | [`creatorhub_core/users/auth.py:1-98`](../creatorhub_core/users/auth.py#L1-L98), JWT configurado en [`core/settings.py:155-161`](../core/settings.py#L155-L161); endpoints incluidos en [`core/urls.py:17`](../core/urls.py#L17) |
| Categorías jerárquicas | `[EXISTE]` | [`marketplace/categories/models.py:5-17`](../marketplace/categories/models.py#L5-L17) (`parent`, `slug` autogenerado, `icon`, `order`, `is_active`) |
| Anuncios con máquina de estados | `[EXISTE]` | [`marketplace/listings/models.py:6-21`](../marketplace/listings/models.py#L6-L21): `draft`, `active`, `paused`, `sold`, `expired`; métodos en [líneas 73-86](../marketplace/listings/models.py#L73-L86) |
| Imágenes con portada única | `[EXISTE]` | [`ListingImage` y constraint, marketplace/listings/models.py:90-112](../marketplace/listings/models.py#L90-L112) |
| Favoritos | `[EXISTE]` | [`marketplace/favorites/models.py:5-25`](../marketplace/favorites/models.py#L5-L25): único `(user, listing)` |
| Reseñas 1-5 seller-céntricas | `[EXISTE]` | [`marketplace/reviews/models.py:6-29`](../marketplace/reviews/models.py#L6-L29): `reviewer`, `seller`, `listing` (nullable), `rating`, `comment` |
| Geolocalización básica | `[EXISTE]` | [`marketplace/listings/models.py:34-39`](../marketplace/listings/models.py#L34-L39): latitud/longitud (`DecimalField`), `location` (texto), índice por `location` |
| Feed público con filtros/búsqueda/orden | `[EXISTE]` | `ListingViewSet`: `DjangoFilterBackend` + `SearchFilter` + `OrderingFilter`, paginación 20 ([settings.py:155-169](../core/settings.py#L155-L169)) |
| Pagos genéricos por `payment_type` | `[EXISTE]` | [`payments_core/models.py:5-66`](../creatorhub_core/payments_core/models.py#L5-L66) (`payment_type`, `platform_fee`, `metadata`, `external_reference`) |
| Checkout + webhook + señales | `[EXISTE]` | [`payments_core/urls.py:5-7`](../creatorhub_core/payments_core/urls.py#L5-L7); señales en [`payments_core/signals.py:5-7`](../creatorhub_core/payments_core/signals.py#L5-L7) |
| Extensión por producto vía señal | `[EXISTE]` | [`marketplace/visibility/signals.py:8-17`](../marketplace/visibility/signals.py#L8-L17) filtra `payment_type == 'visibility'` |
| Visibilidad promocionada por ciudad | `[EXISTE]` | [`City`, marketplace/visibility/models.py:6-47`](../marketplace/visibility/models.py#L6-L47) + [`VisibilityPurchase`, líneas 76-137](../marketplace/visibility/models.py#L76-L137) |
| Admin Django completo | `[EXISTE]` | Ejemplos: [`marketplace/listings/admin.py:13-29`](../marketplace/listings/admin.py#L13-L29), [`marketplace/visibility/admin.py:7-29`](../marketplace/visibility/admin.py#L7-L29); `/admin/` en [`core/urls.py:16`](../core/urls.py#L16) |
| Serializer de usuario configurable | `[EXISTE]` | `USER_SERIALIZER` en [settings.py:214](../core/settings.py#L214) |

### 1.2 Lo que el paquete NO tiene (y el plan debe cubrir)

| Ausencia | Consecuencia para la vertical |
|---|---|
| **Booking / reservas** | `[AUSENTE]` No existe ningún modelo, estado ni endpoint. Es el núcleo de la Fase 2. |
| **Disponibilidad / calendario** | `[AUSENTE]` No hay reglas recurrentes, excepciones ni slots. |
| **Organizaciones / cuentas de proveedor** | `[AUSENTE]` `is_seller=True` es todo el modelo de "proveedor". Una empresa con 10 trabajadores no cabe. |
| **Comisión efectiva** | `[AUSENTE]` `PLATFORM_FEE_PERCENT` ([settings.py:193](../core/settings.py#L193)) no se usa en ningún sitio; `[EXISTE]` `Payment.platform_fee` existe, pero nunca se calcula. |
| **Split de pagos** | `[AUSENTE]` El gateway usa un único `access_token`: sin `application_fee`, sin `marketplace`, sin OAuth. Todo el dinero cae en la cuenta de la plataforma. |
| **Reseñas verificadas** | `[AUSENTE]` `Review` no tiene FK a ninguna transacción: cualquiera puede reseñar sin haber contratado. |
| **Tiempo real / notificaciones** | `[EXISTE]` `channels` + `channels-redis` + `CHANNEL_LAYERS`; `[AUSENTE]` **no hay `consumers.py` ni `routing.py`** y `NOTIFICATION_EVENTS` ([settings.py:195](../core/settings.py#L195)) no se usa. |
| **Pruebas automatizadas** | `[EXISTE]` `pytest`, `pytest-django`, `pytest-cov`, `black`, `ruff` están en `requirements.txt`; `[AUSENTE]` **no hay tests, `pytest.ini`, `pyproject.toml` ni `conftest.py`**. |

### 1.3 Hallazgos de auditoría que condicionan el diseño

1. **Redis hoy es peso muerto.** `[EXISTE]` `channels`, `channels-redis` y
   `CHANNEL_LAYERS`; `[AUSENTE]` consumers, `CACHES` propio y uso del channel
   layer, por eso el runtime no contacta Redis. La guía del comprador (§4) aun
   así requiere instalarlo. La decisión de conservarlo y darle un consumer real
   en Fase 3 queda cerrada en **ADR-12**.
2. **La comisión es un campo, no una regla.** `[EXISTE]` `Payment.platform_fee`
   existe; `[AUSENTE]` lógica que lo rellene: había que decidir *cuándo* se
   calcula (en el Booking, en el
   Payment o en ambos) y congelarlo. Decisión en **ADR-08**.
3. **`VisibilityPurchase` apunta a `User`, no a una cuenta de proveedor.** `[EXISTE]`
   ([visibility/models.py](../marketplace/visibility/models.py#L97-L101)).
   Si el proveedor pasa a ser una cuenta con miembros, la visibilidad premium
   quedaría atada al usuario dueño y se perdería al cambiar de dueño. La nueva FK
   requiere primero una migración de datos que cree la correspondencia vendedor →
   cuenta; se conserva la FK histórica `seller` por compatibilidad (ADR-10).
4. **La tabla de nombres es la del `label` de la app** `[EXISTE]`, no la ruta del módulo:
   `creatorhub_core.payments_core` produce `payments_core_payment`. Las apps
   nuevas deben fijar `AppConfig.label` explícito para no depender de esto.
5. **No hay convención de tests que respetar** `[AUSENTE]` (no existe ninguno), así que la
   Fase 2 define la convención; no hay riesgo de romper estilos previos.

---

## 2. Decisiones de arquitectura

Cada ADR sigue el mismo formato: **contexto → decisión → alternativas descartadas
→ consecuencias → coste de revertir**. Si una decisión se cambia más tarde, este
es el único sitio que hay que editar.

### ADR-01 — El proveedor es `ProviderAccount`, y `Organization` va *encima*, no debajo

**Contexto.** Hoy el "proveedor" es un `User` con `is_seller=True`. El caso real
de limpieza es una empresa con varios trabajadores, varias sucursales y un
calendario común, pero también un limpiador independiente. Además hay que decidir
dónde vive el calendario: en la empresa o en la persona/cuadrilla que ejecuta.

**Decisión.**

```
[PROPUESTO]
User ──1:N── ProviderMembership ──N:1── ProviderAccount ──1:N── ProviderResource
                                              │                      │
                                              │                      └── calendario y reservas
                                              └── servicios (Listing + ServiceDetails)
                                                  zonas, verificación, visibilidad, pagos
```

- `ProviderAccount` es **el tenant**: la entidad que vende, factura, aparece en el
  feed, compra visibilidad y recibe reseñas. Un independiente tiene una cuenta
  con un miembro; una empresa, una cuenta con N miembros.
- `ProviderResource` es **quien tiene agenda** (una persona, una cuadrilla, una
  máquina). El invariante de no-solapamiento se define por recurso, no por
  empresa: dos cuadrillas de la misma empresa *sí* pueden trabajar en paralelo.
- `Organization` **no se crea en el MVP**. Si mañana hace falta (una misma razón
  social con dos marcas, o facturación agrupada), se añade **por encima**:
  `Organization 1:N ProviderAccount` con `ProviderAccount.organization` nullable.
  Nunca `ProviderAccount 1:N Organization`.

**Alternativas descartadas.**

- `User → Provider → Services` (tu opción simple): es la más barata hoy y la más
  cara el día que entre una empresa real: habría que migrar cada FK
  (`Booking`, `ServiceDetails`, `ProviderServiceArea`, reseñas, visibilidad) de
  `User` a la nueva entidad y reescribir todos los permisos.
- `User → ProviderAccount → Organization → Services` (tu primer esquema): añade
  una capa sin resolver nada del MVP y con la jerarquía invertida. En la práctica
  la entidad legal/facturable **agrupa** cuentas operativas, no al contrario; si
  se modela al revés, la facturación y las suscripciones de la Fase 5 acaban mal
  colocadas.

**Consecuencias.** Una indirección más desde el primer día (`Booking` nunca
apunta a `User`), a cambio de que el caso "empresa con empleados" no sea una
reingeniería. `User.is_seller`/`is_buyer` quedan como campos heredados: la fuente
de verdad pasa a ser `ProviderMembership.role` (ver ADR-11).

**Coste de revertir.** Alto si se implementa primero con `User`; nulo si se
arranca con `ProviderAccount` aunque el 90 % de las cuentas tengan un solo
miembro.

### ADR-02 — Un servicio es `Listing` + `ServiceDetails`, no un modelo nuevo ni herencia

**Contexto.** `ListingViewSet`, el feed público, favoritos, reseñas, filtros,
orden, paginación y visibilidad ya operan sobre `Listing`.

**Decisión.** `Listing` sigue siendo el objeto publicable y encontrable (título,
descripción, precio, categoría, imágenes, estado, favoritos, ciudad). La
vertical añade una extensión `OneToOne`:

```python
# [EXISTE] verticals/cleaning/services/models.py
class ServiceDetails(models.Model):
    listing          = OneToOneField('marketplace_listings.Listing', on_delete=CASCADE,
                                     related_name='service_details')
    provider_account = ForeignKey(ProviderAccount, on_delete=PROTECT, related_name='services')
    duration_minutes = PositiveSmallIntegerField()
    buffer_minutes   = PositiveSmallIntegerField(default=30)   # traslado entre trabajos
    capacity         = PositiveSmallIntegerField(default=1)    # personas por cuadrilla
    min_notice_hours = PositiveSmallIntegerField(default=12)
    max_horizon_days = PositiveSmallIntegerField(default=30)
    cancellation_hours = PositiveSmallIntegerField(default=24)
    requires_deposit = BooleanField(default=False)
    deposit_amount   = DecimalField(max_digits=10, decimal_places=2, default=0)
    is_active        = BooleanField(default=True)
```

**Alternativas descartadas.**

- Herencia multitable `class CleaningService(Listing)`: `ListingViewSet` y todo
  el feed seguirían devolviendo la fila base sin los campos de servicio, y cada
  listado del vertical necesitaría su propio viewset/serializer duplicando
  filtros, paginación y permisos. Se paga dos veces por lo mismo.
- Modelo independiente: habría que reimplementar imágenes, favoritos, reseñas,
  visibilidad y feed. Renuncia a todo lo `[EXISTE]` de §1.1.

**Consecuencias.** El catálogo sigue siendo uno solo (`/api/listings/`), así que
la vertical **no** crea un catálogo paralelo. `ServiceDetails` se expone como
campo anidado `service_details` en el serializer de detalle, y `Listing` gana un
filtro derivado para "solo servicios de limpieza".

**Coste de revertir.** Bajo: mover los campos a otro modelo es una migración
mecánica.

### ADR-03 — `Booking` es un agregado aparte con su propia máquina de estados

**Contexto.** `Listing.status` significa hoy "¿es ofrecible la oferta?".

**Decisión.** No se toca `Listing.status`. La vertical añade:

- En `Listing`: `draft` (borrador), `active` (ofrecible), `paused` (no ofrecible
  temporalmente). `sold` y `expired` **no se usan** para servicios: un servicio
  no se "vende" y, si algún día caduca, la caducidad es de `ServiceDetails`, no
  del anuncio. Se documenta en el glosario (§4.4) para que nadie interprete
  `listing.status == 'sold'` como "reserva completada".
- En `Booking`: `requested`, `confirmed`, `in_progress`, `completed`,
  `cancelled`, `expired` (ver §4.1).

**Alternativas descartadas.** Reutilizar `Listing.status` con estados de
cumplimiento: mezcla dos ciclos de vida con cardinalidades distintas (un anuncio
tiene N reservas históricas) y rompe el feed público, que filtra por `active`.

**Consecuencias.** Dos máquinas de estados explícitas y un glosario que impide la
confusión que motivó este documento.

**Coste de revertir.** Bajo, pero el desorden de estados contamina todo si se
hace mal desde el principio.

### ADR-04 — La invariante de agenda vive en PostgreSQL, no en Python

**Contexto.** "No dos reservas incompatibles para el mismo proveedor y horario".
El planteamiento `if not Booking.objects.filter(...).exists(): create()` es una
condición de carrera: dos peticiones simultáneas leen "libre", ambas escriben, y
la empresa vende dos veces el mismo tramo.

**Decisión.** Restricción de exclusión parcial en PostgreSQL, sobre el **recurso**
y el rango ocupado (`end_at + buffer`):

```sql
-- SQL equivalente para inspección/prueba directa; la migración usa el ORM de Django
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE cleaning_bookings_booking
  ADD CONSTRAINT booking_no_overlap_per_resource
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_at, occupies_until, '[)') WITH &&
  )
  WHERE (status IN ('requested','confirmed','in_progress'));
```

**Verificado en el PostgreSQL de este despliegue** (no es teoría): con la
restricción creada, insertar 11:00–14:00 sobre una reserva confirmada 10:00–13:00
del mismo recurso produce
`ERROR: conflicting key value violates exclusion constraint`, mientras que
13:00–15:00 (adyacente, semántica `[)`), una reserva `cancelled` solapada y otro
`resource_id` a la misma hora se aceptan correctamente.

Detalles que la implementación debe respetar:

- `btree_gist` está disponible en los binarios (`1.7`). Es una extensión
  *trusted* en PostgreSQL 13+: no requiere superusuario; el usuario de migración
  necesita permiso `CREATE` sobre **la base de datos destino**. La instalación
  es por base de datos: que exista en la base `postgres` no significa que exista
  en `marketplace_starter`. La migración y la prueba de aceptación deben
  ejecutarse contra la base de la aplicación. [Documentación PostgreSQL 16](https://www.postgresql.org/docs/16/contrib.html)
- El `WHERE` deja fuera `completed`, `cancelled` y `expired`: el historial no
  bloquea la agenda futura.
- `occupies_until` es una columna **desnormalizada** (`end_at + buffer_minutes`)
  calculada en `Booking.save()`. Así el buffer de traslado entra en la misma
  restricción y no hay que ampliar el rango en cada consulta. Sin esto, el bug
  clásico es reservar a las 13:00 a alguien que acaba a las 13:00 al otro lado
  de la ciudad.
- Django 5.2 sí ofrece [`ExclusionConstraint`](https://docs.djangoproject.com/en/5.2/ref/contrib/postgres/constraints/#exclusionconstraint).
  La constraint se declara en `Booking.Meta.constraints` para que el estado del
  ORM y las migraciones sigan sincronizados; la migración instala
  `btree_gist` con `BtreeGistExtension`. La validación con SQL crudo sigue siendo
  obligatoria para probar que PostgreSQL protege también escrituras externas al
  ORM.

**Alternativas descartadas.**

- `SELECT ... FOR UPDATE` sobre el recurso + comprobación en Python: serializa
  todas las reservas del recurso (cuello de botella) y **solo protege si todo el
  código pasa por ahí**; el admin, un script o un futuro endpoint lo saltan.
- `unique_together` sobre `(resource, start_at)`: solo detecta colisiones exactas
  de hora de inicio; un servicio de 3 h a las 10:00 y otro de 1 h a las 11:00 no
  colisionan en esa tupla y sí en la realidad.
- Bloqueo por slot materializado por franjas fijas: obliga a que la duración sea
  múltiplo del paso y desperdicia agenda en servicios de duración libre.

**Consecuencias.** La doble reserva es imposible incluso escribiendo por `psql`.
La API debe traducir el error `23P01` a un `409` legible (§5.3), no a un 500.

**Coste de revertir.** Nulo hacia adelante; quitarla después sería un error.

### ADR-05 — Disponibilidad calculada desde reglas; sin slots materializados en el MVP

**Contexto.** Hay que responder "¿qué horarios puede atender este recurso para
este servicio entre el 10 y el 20 de octubre?".

**Decisión.** Dos modelos declarativos y cálculo al vuelo:

- `AvailabilityRule` `[PROPUESTO]`: ventana semanal recurrente
  (`resource`, `weekday` 0-6, `start_time`, `end_time` en hora local,
  `valid_from`/`valid_to` nullable).
- `AvailabilityException` `[PROPUESTO]`: fecha/rango puntual con
  `kind = unavailable | extra_available` (vacaciones, feriado, refuerzo).

El endpoint de disponibilidad genera candidatos sobre una rejilla
(`slot_step_minutes`, por defecto 30), descarta los que solapan con reservas
activas del recurso (usando `occupies_until`), aplica excepciones, `min_notice_hours`
y `max_horizon_days`. Un servicio de 3 h genera candidatos válidos aunque el paso
sea de 30 min: la rejilla solo fija los posibles *inicios*.

**Alternativas descartadas.** Materializar `Slot` filas por recurso y día: hay
que regenerarlas al cambiar una regla, al cambiar la duración del servicio y al
mover una excepción; con 200 recursos y 30 días son ~100 000 filas que
inevitablemente se desincronizan. Se pospone a `[FUTURO]` solo si el cálculo
demuestra ser un cuello de botella (no lo será con los índices del §3.6).

**Consecuencias.** Un cambio de horario es un `UPDATE` de una fila y se refleja
al instante. La disponibilidad es siempre coherente con las reservas reales
porque se calcula contra ellas, no contra una copia.

**Coste de revertir.** Bajo (añadir slots después no rompe el cálculo: lo
alimenta).

### ADR-06 — Los bloqueos temporales (`requested`) caducan solos, sin Celery

**Contexto.** Si el cliente 1 bloquea el slot mientras decide y el cliente 2
consulta, el slot debe aparecer ocupado; pero si el cliente 1 abandona, el slot
no puede quedar secuestrado para siempre. El rango `requested` **debe** entrar en
la restricción (si no, dos clientes pueden recibir "disponible" y solo uno
pagar).

**Decisión.** `Booking` en `requested` lleva `hold_expires_at` (por defecto
`now() + HOLD_TTL_MINUTES`, configurable, 15 min). La expiración se resuelve por
dos vías complementarias:

1. **Expiración perezosa transaccional**: antes de insertar una reserva, el
   servicio marca como `expired` los holds vencidos que puedan competir por los
   recursos de la cuenta; escribe un `BookingEvent` por cada transición y los
   saca del índice parcial de exclusión. No se borran filas: se conserva el
   historial. La operación es idempotente y ocurre dentro de la transacción.
2. **Comando de gestión** `release_expired_holds` para ejecutar por cron/systemd
   timer, y para que el admin pueda verlo.

**Alternativas descartadas.** Celery/Celery Beat: no está en `requirements.txt` y
añadir un worker + broker para un `UPDATE` periódico es desproporcionado en el
MVP. `pg_cron`: no está disponible. Un `setTimeout` en el frontend: no es una
garantía del sistema.

**Consecuencias.** El estado `expired` es terminal y distinto de `cancelled`
(métricas: uno mide abandono, el otro intención).

**Aislamiento asumido.** La transacción se ejecuta con el aislamiento por defecto
de PostgreSQL, `READ COMMITTED`. La serialización de escrituras solapadas la
resuelve la constraint GiST; no se promete que el `UPDATE` de expiración y la
creación concurrente produzcan siempre el mismo error bajo `REPEATABLE READ` o
`SERIALIZABLE`. Si el despliegue cambia el aislamiento, debe definir y probar su
política de reintento para errores de serialización antes de habilitar reservas.

**Coste de revertir.** Bajo.

### ADR-07 — Zona horaria: UTC en base de datos, hora local en las reglas

**Contexto.** `USE_TZ = True` y `TIME_ZONE = 'America/Lima'`
([settings.py:142-145](../core/settings.py#L142-L145)).
Perú no aplica horario de verano.

**Decisión.** `Booking.start_at`/`end_at` en UTC (`timestamptz`). `AvailabilityRule`
guarda hora local de la **zona del recurso** (`ProviderResource.timezone`, por
defecto `America/Lima`) y se convierte en el cálculo. La API expone ISO-8601 con
offset y acepta el mismo formato; el frontend muestra en la zona del recurso.

**Alternativas descartadas.** Guardar hora local "porque Perú no cambia": rompe
en el primer proveedor en otro país y hace ambiguos los rangos en la restricción
de exclusión.

**Consecuencias.** Aunque el MVP sea unimplemente, el campo `timezone` existe
desde el primer día (mismo criterio que ADR-01: la indirección barata hoy evita
la migración cara mañana).

**Coste de revertir.** Medio si se omite el campo; nulo si se incluye.

### ADR-08 — El dinero se congela en el `Booking`; el MVP no mueve dinero real

**Contexto.** `Payment` es genérico (`payment_type`, `platform_fee`, `metadata`)
pero la comisión no se calcula en ninguna parte, y el gateway no puede repartir
dinero (un solo token). El precio de un servicio puede cambiar después de la
reserva y la liquidación al proveedor debe ser auditable años más tarde.

**Decisión.**

- `Booking` congela `price`, `currency`, `platform_fee`, `provider_amount`,
  `deposit_amount`. El cálculo ocurre **una sola vez**, al crear la reserva, con
  `PLATFORM_FEE_PERCENT` (o el override de la cuenta/recurso si existe). No se
  recalcula nunca: cambiar el porcentaje de la plataforma no reescribe el pasado.
- `Booking.payment_status` es independiente de `Booking.status`: `unpaid`,
  `deposit_paid`, `paid`, `refunded`.
- **MVP (`[PROPUESTO]`)**: `payment_status` se marca a mano (efectivo, Yape,
  transferencia) desde la app o el admin. Suficiente para validar el negocio y
  **no** bloquea el diseño de reservas.
- **Fase 4 (`[FASE 4]`)**: el pago entra por
  `POST /api/payments/create-preference/` con `payment_type='booking'` y
  `metadata={'booking_id': ...}`, exactamente el patrón de
  `marketplace/visibility/signals.py`; el receptor de `payment_completed`
  confirma la reserva y escribe `Payment.platform_fee`. El split real exige
  Mercado Pago Marketplace (cuentas conectadas por OAuth + `application_fee`),
  que no existe hoy.
- **Regla de seguridad, ya en el MVP**: el importe **nunca** lo envía el cliente.
  El endpoint de pago calcula `amount` desde `Booking.price` en el servidor. Hoy
  `CreatePreferenceView` acepta `amount` del cliente
  ([payments_core/views.py:225-241](../creatorhub_core/payments_core/views.py#L225-L241)):
  para `payment_type='booking'` eso es un agujero y el plan lo cierra.

**Consecuencias.** Se puede validar todo el flujo de reservas sin tocar dinero, y
la Fase 4 se conecta a un modelo que ya tiene los campos de reparto correctos.

**Coste de revertir.** Bajo en MVP; alto si se deja el cálculo para después,
porque los importes históricos quedarían sin trazabilidad.

### ADR-09 — Reseña verificada: atada a una reserva completada

**Contexto.** Hoy `Review` no tiene FK a ninguna transacción: cualquiera puede
crear una cuenta y publicar 5★ sin haber contratado.

**Decisión.** Migración **aditiva** en `marketplace.reviews`:

- `Review.booking = ForeignKey('cleaning_bookings.Booking', null=True, blank=True,
  on_delete=PROTECT)`: una reserva reseñada no se puede borrar y perder su
  comprobante de verificación.
- `UniqueConstraint(fields=['booking'], condition=Q(booking__isnull=False),
  name='unique_review_per_booking')`.
- `Review.is_verified` (bool, default `False`) se deriva en el servidor: `True`
  solo si la reserva existe y está `completed`. El serializer lo marca
  `read_only` — **nunca** lo decide el cliente.
- Validación en `ReviewSerializer`: sin `booking` completado se puede seguir
  reseñando (compatibilidad con el marketplace de productos), pero con
  `is_verified=False` y sin acceso al agregado verificado.
- `ProviderAccount.rating_avg`/`rating_count` desnormalizados por señal, con el
  mismo patrón que `Listing.favorite_count` `[EXISTE]`.

**Alternativas descartadas.** Un modelo `ProviderReview` paralelo: fragmenta la
reputación y duplica el endpoint `/api/reviews/`. Bloquear toda reseña sin
reserva: rompe el caso de producto del paquete base.

**Consecuencias.** El frontend muestra dos medias (verificada / general) o una
sola con distintivo, decisión de producto, no de esquema.

**Coste de revertir.** Bajo.

### ADR-10 — Empaquetado: apps nuevas aisladas, una sola migración sobre app existente

**Contexto.** El paquete es un producto que se actualiza (`CHANGELOG` 1.0.0 →
1.0.1). Si la vertical edita `marketplace/*`, cada actualización del Starter
genera conflictos y el comprador no puede distinguir qué es núcleo y qué es
vertical.

**Decisión.** Todo lo nuevo vive en un paquete de nivel superior:

```
[PROPUESTO]
verticals/
└── cleaning/
    ├── __init__.py
    ├── apps.py
    ├── providers/     label = cleaning_providers     → cleaning_providers_*
    ├── services/      label = cleaning_services      → cleaning_services_*
    ├── availability/  label = cleaning_availability  → cleaning_availability_*
    └── bookings/      label = cleaning_bookings      → cleaning_bookings_*
```

`label` explícito en cada `AppConfig` (ver §1.3.4). En
[settings.py](../core/settings.py#L61-L90) se añaden las apps y un bloque de
configuración. `CLEANING_VERTICAL_ENABLED` controla el montaje de rutas y
funciones de la vertical; no retira apps de `INSTALLED_APPS` ni revierte
migraciones:

```python
# [EXISTE] core/settings.py
CLEANING_VERTICAL_ENABLED = config('CLEANING_VERTICAL_ENABLED', default=False, cast=bool)
BOOKING_HOLD_TTL_MINUTES = config('BOOKING_HOLD_TTL_MINUTES', default=15, cast=int)
BOOKING_SLOT_STEP_MINUTES = config('BOOKING_SLOT_STEP_MINUTES', default=30, cast=int)
```

Las intervenciones sobre apps existentes son **tres, todas aditivas** (detalle en
§3.5): `Review.booking`/`Review.is_verified`, `VisibilityPurchase.provider_account`
y una data-migration idempotente de categorías. Antes de enlazar compras de
visibilidad, `cleaning_providers` crea una cuenta, membership y recurso principal
para cada vendedor legado que tenga anuncios o compras; así el `seller` histórico
tiene una correspondencia determinista con un `ProviderAccount`. `seller` se
conserva por compatibilidad. La migración de visibilidad solo rellena la nueva FK
desde esa correspondencia; si por cualquier anomalía no existe cuenta, falla
explícitamente en vez de dejar una compra huérfana. Alternativa descartada:
hacerlo vía tabla puente en la vertical (una consulta extra y un JOIN en cada
lectura del feed premium, a cambio de cero cambios en el núcleo). Se elige la
migración aditiva porque el campo es exactamente del mismo dominio y el núcleo ya
la necesita para su propio roadmap multi-usuario.
Ninguna migración borra ni renombra columnas: el paquete base sigue corriendo con
las rutas de la vertical desactivadas y sus apps aún instaladas.

**Consecuencias.** Actualizar el Starter no toca la vertical. La vertical se
puede **desactivar funcionalmente** con la variable de entorno, pero no se pueden
quitar las cuatro apps de `INSTALLED_APPS` mientras `Review.booking` y
`VisibilityPurchase.provider_account` apunten a sus modelos. Una retirada total
requiere una migración de salida coordinada y solo es segura si se archivan o
eliminan explícitamente los datos dependientes. No se promete desinstalación
limpia con datos de reservas.

**Coste de revertir.** Bajo.

### ADR-11 — Roles: la fuente de verdad es `ProviderMembership`, no los flags del `User`

**Contexto.** `User.is_seller`/`is_buyer` `[EXISTE]` son booleanos globales: no
expresan "es dueño de esta cuenta", ni "es staff de esta cuenta", ni "puede
confirmar reservas".

**Decisión.** `ProviderMembership(account, user, role, is_active)` con
`role ∈ {owner, admin, staff}` y `UniqueConstraint(account, user)`. Los permisos
de la vertical se resuelven contra el rol en la cuenta, nunca contra
`user.is_seller`. `ProviderAccount.owner` debe corresponder a una membership
activa con rol `owner`; los cambios de titularidad actualizan ambos dentro de una
transacción. Los flags heredados se mantienen (compatibilidad con el paquete) y
se sincronizan al crear una cuenta de proveedor (`is_seller=True`), documentados
como **vestigiales**.

**Consecuencias.** Un futuro rol `dispatcher` (asignar trabajos sin ver precios)
es una fila en un `choices`, no un rediseño. Matriz completa de permisos en §6.

**Coste de revertir.** Bajo.

### ADR-12 — Redis se conserva en el stack existente; el vertical lo usa desde Fase 3

**Contexto.** §1.3.1: hoy el comprador instala Redis para un runtime que nunca lo
usa.

**Decisión aprobada.** Redis se conserva en el stack de Marketplace Starter para
no alterar la infraestructura base. La Fase 2 de limpieza no depende de Redis y
debe funcionar aunque el servicio no esté disponible. La Fase 3 debe entregar un
consumer real de Channels para notificaciones de reserva; hasta entonces, la
documentación de despliegue debe declarar que Redis es requisito del stack base,
pero no una dependencia funcional del MVP de limpieza.

**Coste de revertir.** Bajo. Si se decide retirar Redis en una versión futura,
habrá que actualizar el stack y la guía del paquete como un cambio independiente.

---

## 3. Modelo de datos completo

Convenciones: `id` es `BigAutoField` `[EXISTE]` (DEFAULT_AUTO_FIELD); todas las
fechas son `timestamptz`; `created_at`/`updated_at` con `auto_now_add`/`auto_now`;
nada de `CASCADE` desde un `Booking` hacia entidades de negocio (se usa `PROTECT`
para que borrar una cuenta no destruya el historial económico); `on_delete` se
especifica en cada FK porque es una decisión de negocio, no un detalle.

### 3.1 `cleaning_providers` — quién vende

```python
# [EXISTE] verticals/cleaning/providers/models.py

class ProviderAccount(models.Model):
    class Kind(models.TextChoices):
        INDIVIDUAL = 'individual', 'Persona independiente'
        COMPANY = 'company', 'Empresa'

    class Verification(models.TextChoices):
        PENDING = 'pending', 'Pendiente'
        VERIFIED = 'verified', 'Verificada'
        REJECTED = 'rejected', 'Rechazada'
        SUSPENDED = 'suspended', 'Suspendida'

    owner = FK(User, on_delete=PROTECT, related_name='owned_provider_accounts')
    display_name = CharField(max_length=120)          # "CleanHome Lima"
    legal_name = CharField(max_length=160, blank=True)
    tax_id = CharField(max_length=20, blank=True)      # RUC/DNI, opcional en MVP
    slug = SlugField(max_length=140, unique=True)      # generado si viene vacío
    kind = CharField(max_length=12, choices=Kind, default=INDIVIDUAL)
    platform_fee_percent = DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    description = TextField(blank=True)
    logo = ImageField(upload_to='providers/logos/%Y/%m/', null=True, blank=True)
    phone = CharField(max_length=20, blank=True)
    contact_email = EmailField(blank=True)
    timezone = CharField(max_length=64, default='America/Lima')   # ADR-07
    verification_status = CharField(max_length=12, choices=Verification, default=PENDING)
    verified_at = DateTimeField(null=True, blank=True)
    is_active = BooleanField(default=True)
    rating_avg = DecimalField(max_digits=3, decimal_places=2, default=0)   # desnormalizado
    rating_count = PositiveIntegerField(default=0)                         # desnormalizado
    created_at, updated_at

    class Meta:
        indexes = [
            Index(fields=['verification_status', 'is_active']),
            Index(fields=['kind', 'is_active']),
            Index(fields=['owner']),
        ]
        constraints = [CheckConstraint(condition=Q(rating_avg__gte=0) & Q(rating_avg__lte=5),
                                       name='provider_rating_avg_range'),
                       CheckConstraint(condition=Q(platform_fee_percent__isnull=True) |
                                                 (Q(platform_fee_percent__gte=0) & Q(platform_fee_percent__lte=100)),
                                       name='provider_fee_percent_range')]
```

Regla de visibilidad `[PROPUESTO]`: solo una cuenta `is_active=True` y
`verification_status='verified'` aparece en el directorio y puede recibir
reservas. Las cuentas `pending`, `rejected` o `suspended` no son reservables;
la revisión del MVP es manual desde Django Admin. La visibilidad premium también
requiere `verified`.

```python
class ProviderMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = 'owner', 'Dueño'
        ADMIN = 'admin', 'Administrador'
        STAFF = 'staff', 'Personal'

    account = FK(ProviderAccount, on_delete=CASCADE, related_name='memberships')
    user = FK(User, on_delete=CASCADE, related_name='provider_memberships')
    role = CharField(max_length=10, choices=Role, default=STAFF)
    is_active = BooleanField(default=True)
    created_at

    class Meta:
        constraints = [
            UniqueConstraint(fields=['account', 'user'], name='unique_membership_account_user'),
            UniqueConstraint(fields=['account'], condition=Q(role='owner', is_active=True),
                             name='unique_active_provider_owner'),
        ]
        indexes = [Index(fields=['user', 'is_active'])]

class ProviderResource(models.Model):
    """Quien tiene agenda: persona, cuadrilla o máquina. ADR-01."""
    class Kind(models.TextChoices):
        HUMAN = 'human', 'Persona'
        CREW = 'crew', 'Cuadrilla'
        MACHINE = 'machine', 'Equipo'

    account = FK(ProviderAccount, on_delete=CASCADE, related_name='resources')
    name = CharField(max_length=80)                    # "María", "Cuadrilla 1"
    kind = CharField(max_length=10, choices=Kind, default=CREW)
    timezone = CharField(max_length=64, blank=True)     # vacío = hereda de la cuenta
    capacity = PositiveSmallIntegerField(default=1)
    members = ManyToManyField(User, blank=True, related_name='cleaning_resources')
    is_active = BooleanField(default=True)
    created_at, updated_at

    class Meta:
        constraints = [UniqueConstraint(fields=['account', 'name'], name='unique_resource_name_per_account')]
        indexes = [Index(fields=['account', 'is_active'])]
```

Al crear una `ProviderAccount` se crea automáticamente un recurso `"Principal"`
(señal `post_save`), de modo que el caso independiente funciona sin que el
usuario sepa que existen los recursos. **No** se ocultan: la UI de empresa los
gestiona, la de independiente los ignora.

En el MVP, `capacity` es descriptivo y no permite reservas simultáneas para un
mismo recurso: la exclusión de ADR-04 reserva la agenda de cada recurso de forma
exclusiva. Una cuadrilla con capacidad operativa debe representarse como un
recurso; trabajo paralelo requiere recursos separados.
Cada usuario de `ProviderResource.members` debe tener una `ProviderMembership`
activa con rol `staff` en la misma cuenta; el servicio/admin valida esta regla al
asignarlo.

```python
class ProviderServiceArea(models.Model):
    """Dónde presta servicio la cuenta. Lima se organiza por distritos, no por ciudad."""
    account = FK(ProviderAccount, on_delete=CASCADE, related_name='service_areas')
    city = FK('marketplace_visibility.City', on_delete=PROTECT, related_name='cleaning_areas')  # [EXISTE]
    district = CharField(max_length=80)                 # "san-borja"
    district_label = CharField(max_length=80)           # "San Borja"
    extra_fee = DecimalField(max_digits=8, decimal_places=2, default=0)   # recargo por zona
    is_active = BooleanField(default=True)

    class Meta:
        constraints = [UniqueConstraint(fields=['account', 'city', 'district'],
                                        name='unique_area_per_account')]
        indexes = [Index(fields=['city', 'district', 'is_active'])]
```

Se reutiliza `City` `[EXISTE]` porque ya trae el inventario de posiciones premium
(`premium_slots_count`, `price`, `duration_days`): eso hace que "empresa
destacada en San Borja" (tu §11) funcione **sin código nuevo de monetización**,
solo enlazando la compra de visibilidad con la cuenta (ADR-10). Los distritos se
modelan como texto con `slug`; `[FUTURO]` un modelo `District` o PostGIS si hace
falta geometría (hoy `Listing` ya usa `DecimalField` para lat/long, se mantiene
el mismo criterio para no introducir una dependencia geoespacial en el MVP).

`ProviderDocument` (`kind ∈ {dni, ruc, license, insurance}`, `file`, `status`,
`reviewed_at`, `reviewed_by`) queda como `[FASE 3]`: la verificación en el MVP es
un cambio de estado que hace el admin tras revisar los datos por fuera.

### 3.2 `cleaning_services` — qué se vende

`ServiceDetails` (definido en ADR-02) se completa con:

```python
    # [PROPUESTO] añadidos a ServiceDetails
    resolves_address = BooleanField(default=True)     # el proveedor va al domicilio
    is_instant = BooleanField(default=False)          # confirmación automática, sin aceptar
    max_per_day = PositiveSmallIntegerField(null=True, blank=True)  # tope de trabajos/día
```

Validaciones `[PROPUESTO]` (en `clean()` y en el serializer):

| Regla | Motivo |
|---|---|
| `1 <= duration_minutes <= 720` | Un servicio de 0 min o de más de 12 h es un error de captura. |
| `0 <= buffer_minutes <= 240` | El buffer es traslado, no una jornada extra. |
| `min_notice_hours <= max_horizon_days * 24` | Coherencia de la ventana de reserva. |
| `deposit_amount <= listing.price` cuando `requires_deposit` | Un depósito mayor que el precio es un abuso. |
| `listing.status != 'sold'` | `sold` no tiene sentido para servicios (ADR-03). |
| En MVP, `requires_deposit=False` y `deposit_amount=0` | D-3 cerrado: no se retiene ni cobra anticipo. |

La taxonomía **no** se duplica: se reutiliza `Category` `[EXISTE]` con una raíz
"Limpieza" y subcategorías (`Limpieza profunda`, `Limpieza regular`,
`Post-construcción`, `Oficinas`, `Vidrios`, `Tapicería`). Así el filtro del feed
`/api/listings/?category=<slug>` funciona sin cambios.

### 3.3 `cleaning_availability` — cuándo se puede

```python
class AvailabilityRule(models.Model):
    """Ventana semanal recurrente, en hora local del recurso. ADR-05/ADR-07."""
    resource = FK(ProviderResource, on_delete=CASCADE, related_name='availability_rules')
    weekday = PositiveSmallIntegerField(validators=[MaxValueValidator(6)])  # 0=lunes
    start_time = TimeField()
    end_time = TimeField()
    valid_from = DateField(null=True, blank=True)
    valid_to = DateField(null=True, blank=True)
    is_active = BooleanField(default=True)

    class Meta:
        constraints = [
            CheckConstraint(condition=Q(end_time__gt=F('start_time')),
                             name='availability_rule_time_order'),
            CheckConstraint(condition=Q(valid_from__isnull=True) | Q(valid_to__isnull=True) |
                                      Q(valid_to__gte=F('valid_from')),
                             name='availability_rule_date_order'),
        ]
        indexes = [Index(fields=['resource', 'weekday', 'is_active'])]
        ordering = ['resource', 'weekday', 'start_time']

class AvailabilityException(models.Model):
    """Vacaciones, feriados, refuerzos puntuales."""
    class Kind(models.TextChoices):
        UNAVAILABLE = 'unavailable', 'No disponible'
        EXTRA = 'extra_available', 'Disponible extra'

    resource = FK(ProviderResource, on_delete=CASCADE, related_name='availability_exceptions')
    kind = CharField(max_length=16, choices=Kind, default=UNAVAILABLE)
    starts_at = DateTimeField()
    ends_at = DateTimeField()
    reason = CharField(max_length=160, blank=True)
    created_by = FK(User, on_delete=SET_NULL, null=True, blank=True)
    created_at

    class Meta:
        constraints = [CheckConstraint(condition=Q(ends_at__gt=F('starts_at')),
                                       name='availability_exception_time_order')]
        indexes = [Index(fields=['resource', 'starts_at']),
                   Index(fields=['resource', 'kind', 'starts_at'])]
```

Las reglas **pueden solaparse** entre sí (p. ej. 08:00–12:00 y 11:00–15:00 los
sábados): el cálculo deduplica con un `set` de inicios candidatos, así que el
solapamiento no genera slots repetidos ni es un error del usuario.

### 3.4 `cleaning_bookings` — la transacción

```python
class TsTzRange(Func):
    function = 'TSTZRANGE'
    output_field = DateTimeRangeField()

class Booking(models.Model):
    class Status(models.TextChoices):
        REQUESTED = 'requested', 'Solicitada'
        CONFIRMED = 'confirmed', 'Confirmada'
        IN_PROGRESS = 'in_progress', 'En ejecución'
        COMPLETED = 'completed', 'Completada'
        CANCELLED = 'cancelled', 'Cancelada'
        EXPIRED = 'expired', 'Expirada'

    class PaymentStatus(models.TextChoices):
        UNPAID = 'unpaid', 'Sin pago'
        DEPOSIT_PAID = 'deposit_paid', 'Depósito pagado'
        PAID = 'paid', 'Pagado'
        REFUNDED = 'refunded', 'Reembolsado'

    code = CharField(max_length=20, unique=True)          # "CL-2026-000123"
    customer = FK(User, on_delete=PROTECT, related_name='bookings_as_customer')
    account = FK(ProviderAccount, on_delete=PROTECT, related_name='bookings')
    resource = FK(ProviderResource, on_delete=PROTECT, related_name='bookings')
    listing = FK('marketplace_listings.Listing', on_delete=PROTECT, related_name='bookings')
    service_title = CharField(max_length=200)             # snapshot histórico

    start_at = DateTimeField()
    end_at = DateTimeField()
    buffer_minutes = PositiveSmallIntegerField(default=0)  # snapshot de ServiceDetails al reservar
    occupies_until = DateTimeField()                      # end_at + buffer (ADR-04)
    status = CharField(max_length=12, choices=Status, default=REQUESTED)
    hold_expires_at = DateTimeField(null=True, blank=True)  # ADR-06

    address = TextField()
    district = CharField(max_length=80)
    city = FK('marketplace_visibility.City', on_delete=PROTECT, null=True, blank=True)
    latitude = DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)

    price = DecimalField(max_digits=10, decimal_places=2)          # congelado
    zone_fee = DecimalField(max_digits=10, decimal_places=2, default=0)  # recargo de ProviderServiceArea
    currency = CharField(max_length=3, default='PEN')
    platform_fee = DecimalField(max_digits=10, decimal_places=2, default=0)
    provider_amount = DecimalField(max_digits=10, decimal_places=2, default=0)
    deposit_amount = DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_status = CharField(max_length=16, choices=PaymentStatus, default=UNPAID)
    payment = FK('payments_core.Payment', on_delete=SET_NULL, null=True, blank=True,
                 related_name='bookings')                          # [EXISTE] payments_core

    idempotency_key = CharField(max_length=128, null=True, blank=True)
    request_fingerprint = CharField(max_length=64, null=True, blank=True)  # hash de la petición normalizada
    customer_notes = TextField(blank=True)
    provider_notes = TextField(blank=True)
    cancelled_by = FK(User, on_delete=SET_NULL, null=True, blank=True, related_name='+')
    cancel_reason = CharField(max_length=20, blank=True)   # choices: customer, provider, no_show, other
    cancel_detail = TextField(blank=True)

    confirmed_at, started_at, completed_at, cancelled_at = DateTimeField(null=True, blank=True)
    created_at, updated_at

    class Meta:
        constraints = [
            CheckConstraint(condition=Q(end_at__gt=F('start_at')), name='booking_time_order'),
            CheckConstraint(condition=Q(occupies_until__gte=F('end_at')),
                             name='booking_occupies_until_after_end'),
            CheckConstraint(condition=(Q(status='requested', hold_expires_at__isnull=False) |
                                             (~Q(status='requested') & Q(hold_expires_at__isnull=True))),
                             name='booking_hold_matches_status'),
            CheckConstraint(condition=Q(price__gte=0) & Q(platform_fee__gte=0)
                            & Q(provider_amount__gte=0), name='booking_amounts_non_negative'),
            CheckConstraint(condition=Q(price=F('platform_fee') + F('provider_amount')),
                             name='booking_amounts_sum_to_price'),
            UniqueConstraint(fields=['customer', 'idempotency_key'],
                             condition=Q(idempotency_key__isnull=False),
                             name='unique_booking_idempotency_per_customer'),
            ExclusionConstraint(
                name='booking_no_overlap_per_resource',
                expressions=[
                    (TsTzRange('start_at', 'occupies_until', RangeBoundary()),
                     RangeOperators.OVERLAPS),
                    ('resource', RangeOperators.EQUAL),
                ],
                condition=Q(status__in=['requested', 'confirmed', 'in_progress']),
            ),
        ]
        indexes = [
            Index(fields=['resource', 'start_at']),
            Index(fields=['account', 'status', 'start_at']),
            Index(fields=['customer', '-start_at']),
            Index(fields=['listing', 'start_at']),
            Index(fields=['status', 'hold_expires_at']),   # comando global de holds (ADR-06)
            Index(fields=['account', 'status', 'hold_expires_at']),  # expiración perezosa por cuenta
        ]

class BookingEvent(models.Model):
    """Auditoría de transiciones: quién, cuándo, de qué estado a cuál y por qué."""
    booking = FK(Booking, on_delete=CASCADE, related_name='events')
    from_status = CharField(max_length=12, blank=True)
    to_status = CharField(max_length=12)
    actor = FK(User, on_delete=SET_NULL, null=True, blank=True)
    event_type = CharField(max_length=12, choices=[('status', 'Estado'), ('payment', 'Pago')], default='status')
    actor_role = CharField(max_length=20, blank=True)   # customer|provider_owner|provider_admin|provider_staff|system
    reason = CharField(max_length=160, blank=True)
    created_at

    class Meta:
        ordering = ['created_at']
        indexes = [Index(fields=['booking', 'created_at'])]
```

Cálculo de importes, **una sola vez** al crear la reserva (ADR-08):

```python
# [EXISTE] verticals/cleaning/bookings/services.py
def snapshot_prices(*, listing, account, service_area):
    zone_fee = service_area.extra_fee
    price = (listing.price or Decimal('0')) + zone_fee
    fee_percent = account.platform_fee_percent
    if fee_percent is None:
        fee_percent = settings.CLEANING_PLATFORM_FEE_PERCENT
    if fee_percent is None:
        fee_percent = settings.PLATFORM_FEE_PERCENT
    platform_fee = (price * fee_percent / 100).quantize(Decimal('0.01'), ROUND_HALF_UP)
    return {
        'price': price,
        'zone_fee': zone_fee,
        'currency': listing.currency,
        'platform_fee': platform_fee,
        'provider_amount': price - platform_fee,
    }
```

`BookingCodeSequence(year, next_value)` es una tabla de `cleaning_bookings` con
`year` como clave única. La fila del año se crea bajo manejo de conflicto único;
se bloquea con `select_for_update()` solo para incrementar el contador y el
incremento ocurre en la transacción de la reserva. Este bloqueo protege
únicamente la generación del código; no se usa para proteger la agenda. El
formato es `CL-2026-000123`, el identificador visible al cliente y al proveedor
(los `id` numéricos no se exponen en la UI).

```python
class BookingCodeSequence(models.Model):
    year = PositiveSmallIntegerField(unique=True)
    next_value = PositiveIntegerField(default=1)
```

### 3.5 Migraciones aditivas sobre apps existentes

| App | Cambio | Motivo | Reversibilidad |
|---|---|---|---|
| `marketplace.reviews` | `Review.booking` (FK nullable, `PROTECT`) + `Review.is_verified` (bool) + `UniqueConstraint(booking)` parcial | Reseña verificada (ADR-09) | Total: columnas nuevas, nullable |
| `marketplace.visibility` | `VisibilityPurchase.provider_account` (FK nullable) + data-migration desde la cuenta creada para el `seller` legado | Que el premium pertenezca a la cuenta (ADR-10, §1.3.3) | Total: columna nueva; el reverse restaura `provider_account=NULL` y conserva `seller` |
| `marketplace.categories` | Data-migration de la taxonomía "Limpieza" (idempotente, `get_or_create` por slug) | Catálogo listo sin tocar el modelo | Reverse sin-op: las categorías compartidas permanecen para no borrar filas preexistentes ni referencias |

Ninguna migración borra ni renombra columnas existentes: el marketplace base
sigue funcionando con las rutas de limpieza desactivadas, manteniendo instaladas
las apps necesarias para resolver las FKs compartidas (ADR-10).

### 3.6 Índices y las consultas que deben servir

| Consulta crítica | Índice que la sirve |
|---|---|
| Reservas de un recurso en un rango (cálculo de disponibilidad) | `(resource, start_at)` — además, la `EXCLUDE` crea un índice GiST sobre `(resource_id, tstzrange(start_at, occupies_until))` que sirve directamente la consulta de solapamiento con `&&` |
| Purga de holds vencidos | `(status, hold_expires_at)` |
| "Hoy" del proveedor y agenda del panel | `(account, status, start_at)` |
| "Mis reservas" del cliente | `(customer, -start_at)` |
| Historial de un servicio | `(listing, start_at)` |
| Proveedores que cubren un distrito | `(city, district, is_active)` en `ProviderServiceArea` + `(verification_status, is_active)` en `ProviderAccount` |
| Feed premium por ciudad | reutiliza `VisibilityPurchaseManager.active_for_city` `[EXISTE]` |

---

## 4. Estados, transiciones y glosario

### 4.1 Máquina de estados de `Booking`

| Estado | Significado | Quién lo origina | Terminal |
|---|---|---|---|
| `requested` | Solicitud creada; **bloquea el recurso** hasta `hold_expires_at` | Cliente | No |
| `confirmed` | Aceptada por el proveedor (o automática si `is_instant`); el bloqueo pasa a definitivo | Proveedor / sistema | No |
| `in_progress` | El trabajo está en curso | Proveedor | No |
| `completed` | Servicio ejecutado; habilita reseña verificada y liquidación | Proveedor | Sí |
| `cancelled` | Cancelada o rechazada, con autor y motivo | Cliente, proveedor o admin | Sí |
| `expired` | El bloqueo venció sin confirmar | Sistema | Sí |

Transiciones permitidas (todo lo demás devuelve `409 invalid_transition`):

| # | De → a | Actor autorizado | Precondición | Efectos |
|---|---|---|---|---|
| 1 | `requested → confirmed` | Miembro con rol `owner`/`admin`/`staff` de la cuenta, o sistema si `ServiceDetails.is_instant` | `hold_expires_at` no vencido; si `requires_deposit`, `payment_status ∈ {deposit_paid, paid}` en Fase 4 (en MVP basta `unpaid`) | `confirmed_at`, `hold_expires_at=NULL`, `BookingEvent` |
| 2 | `requested → cancelled` | Cliente (desiste) o proveedor (rechaza) | — | `hold_expires_at=NULL`, `cancelled_at`, `cancelled_by`, `cancel_reason`, libera el recurso |
| 3 | `requested → expired` | Sistema (expiración perezosa o comando) | `hold_expires_at < now()` | `hold_expires_at=NULL`; `BookingEvent` con `actor=NULL` |
| 4 | `confirmed → in_progress` | Proveedor | `now() >= start_at - 60 min` | `started_at` |
| 5 | `confirmed → cancelled` | Cliente o proveedor | Política de `cancellation_hours` (MVP: se registra, no se cobra; Fase 3 aplica penalidad) | `cancelled_at`, libera el recurso |
| 6 | `in_progress → completed` | Proveedor | — | `completed_at`; habilita reseña verificada; Fase 4 dispara liquidación |
| 7 | `in_progress → cancelled` | **Solo `is_staff`** (incidencia) | — | Permite cerrar un trabajo que nunca terminó sin perder historial |
| 8 | `confirmed → in_progress` con `no_show` | `[FASE 3]` | Requiere política y evidencia | Se pospone: sin política de cobro, `no_show` es un estado que nadie sabe usar |

Notas de integridad:

- **Ningún estado terminal tiene salida.** Corregir un `completed` es una
  operación administrativa con `BookingEvent` manual, no una transición.
- `status` **no** cambia por el pago: un `Payment` completado confirma la reserva
  (transición 1 desde el sistema), pero un reembolso no la des-confirma; se
  registra en `payment_status` y, si procede, se cancela explícitamente.
- El estado se modifica **solo** a través de los métodos de servicio
  (`confirm_booking()`, `cancel_booking()`, …) que envuelven `transaction.atomic()`
  y escriben `BookingEvent`. Ninguna vista escribe `booking.status` a mano.

### 4.2 Estados de `ProviderAccount.verification_status`

`pending` (alta) → `verified` (admin aprueba) | `rejected` (admin rechaza, con
motivo). `verified → suspended` por incumplimiento; `suspended → verified` al
levantar la suspensión. Solo `verified` accede a visibilidad premium y (Fase 4) a
cobros con depósito. Una cuenta `suspended` mantiene su historial pero sus
servicios salen del feed.

### 4.3 Correspondencia de estados de dinero

| `Booking.payment_status` | `Payment.status` `[EXISTE]` | Cuándo |
|---|---|---|
| `unpaid` | — (no hay `Payment`) o `pending` | Reserva creada, sin cobro |
| `deposit_paid` | `completed` (importe = `deposit_amount`) | Depósito cobrado (Fase 4) |
| `paid` | `completed` (importe = `price`) | Cobro total; en MVP se marca a mano |
| `refunded` | `refunded` | Reembolso total (parciales: `[FUTURO]`) |

`platform_fee` se escribe en **ambos**: en `Booking` (congelado al reservar) y en
`Payment` (lo que realmente cobró la pasarela). Si algún día discrepan, el
`Booking` manda para el negocio y el `Payment` para la conciliación bancaria.

### 4.4 Glosario anti-ambigüedad

| Término | Qué es | Qué **no** es |
|---|---|---|
| Servicio | `Listing` + `ServiceDetails` (la oferta publicada) | Una reserva, ni un trabajo ejecutado |
| `Listing.status` | ¿Es ofrecible la oferta? (`draft`/`active`/`paused`) | El estado del trabajo |
| `Booking.status` | Ciclo de vida del trabajo contratado | El estado del pago |
| `Booking.payment_status` | Estado del dinero de esa reserva | El estado del trabajo |
| `ProviderAccount` | Quien vende y factura (tenant) | Quien ejecuta el trabajo |
| `ProviderResource` | Quien tiene agenda y ejecuta | La empresa |
| `ProviderMembership` | Quién puede operar la cuenta y con qué rol | El rol dentro de un trabajo concreto |
| Recurso bloqueado | Rango `[start_at, occupies_until)` con estado activo | El rango `[start_at, end_at)` del servicio |
| Visibilidad premium | Compra de posición en una ciudad (`VisibilityPurchase` `[EXISTE]`) | Promoción de un servicio concreto |
| `Review.is_verified` | Hay una reserva **completada** detrás | Reseña "buena" o "útil" |

Regla para la documentación futura: **`sold` nunca describe un servicio en esta
vertical**; si aparece `listing.status == 'sold'` sobre un servicio, es un bug.

---

## 5. Contrato de API

Prefijo nuevo: `/api/cleaning/`. Todo lo demás se reutiliza. **La vertical añade
tres recursos (proveedores, disponibilidad, reservas), no un catálogo paralelo**
(ADR-02).

### 5.1 Endpoints

| Método | Ruta | Auth | Permiso | Para qué |
|---|---|---|---|---|
| `GET` | `/api/listings/?category=<slug>` | — | `[EXISTE]` | Buscar servicios (catálogo único) |
| `GET` | `/api/listings/{id}/` | — | `[EXISTE]` + campo anidado `service_details` `[EXISTE]` | Ver un servicio |
| `POST` | `/api/cleaning/services/` | Sí | usuario con cuenta de proveedor activa | Crear `Listing` + `ServiceDetails` en una transacción |
| `PATCH` | `/api/cleaning/services/{listing_id}/` | Sí | miembro `owner`/`admin` de la cuenta | Editar atributos operativos del servicio |
| `GET` | `/api/cleaning/providers/` | — | `AllowAny` | Directorio: filtros `city`, `district`, `category`, `min_rating`, `kind`, `ordering` |
| `POST` | `/api/cleaning/providers/` | Sí | cualquier autenticado | Darse de alta como proveedor (crea cuenta + membership `owner` + recurso `Principal`) |
| `GET` | `/api/cleaning/providers/{id}/` | — | `AllowAny` | Perfil público: datos, zonas, rating, servicios |
| `PATCH` | `/api/cleaning/providers/{id}/` | Sí | miembro `owner`/`admin` | Editar perfil |
| `GET` | `/api/cleaning/providers/{id}/services/` | — | `AllowAny` | Servicios de la cuenta (mismo serializer que el feed) |
| `GET` | `/api/cleaning/providers/{id}/availability/` | — | `AllowAny` | **Slots disponibles**: `?service={listing_id}&from=YYYY-MM-DD&to=YYYY-MM-DD` |
| `GET`/`PUT` | `/api/cleaning/providers/{id}/resources/{rid}/schedule/` | Sí | miembro `owner`/`admin`/`staff` | Reglas semanales + excepciones de un recurso |
| `POST` | `/api/cleaning/providers/{id}/resources/` | Sí | `owner`/`admin` | Añadir recurso (cuadrilla, persona) |
| `POST`/`DELETE` | `/api/cleaning/providers/{id}/members/` | Sí | `owner`/`admin` | Gestionar miembros y roles |
| `GET` | `/api/cleaning/providers/{id}/bookings/` | Sí | miembro de la cuenta | Agenda: `?from=&to=&status=&resource=` |
| `POST` | `/api/cleaning/bookings/` | Sí | cualquier autenticado | **Crear reserva** (el corazón del sistema) |
| `GET` | `/api/cleaning/bookings/` | Sí | — | Mis reservas: como cliente, o `?as=provider&account={id}` si soy miembro |
| `GET` | `/api/cleaning/bookings/{code}/` | Sí | participante | Detalle + historial de eventos |
| `POST` | `/api/cleaning/bookings/{code}/confirm/` | Sí | miembro de la cuenta | Transición 1 (§4.1) |
| `POST` | `/api/cleaning/bookings/{code}/decline/` | Sí | miembro de la cuenta | Transición 2 con `cancel_reason=provider` |
| `POST` | `/api/cleaning/bookings/{code}/start/` | Sí | miembro de la cuenta | Transición 4 |
| `POST` | `/api/cleaning/bookings/{code}/complete/` | Sí | miembro de la cuenta | Transición 6 |
| `POST` | `/api/cleaning/bookings/{code}/cancel/` | Sí | cliente o miembro de la cuenta | Transiciones 2 y 5, con motivo |
| `POST` | `/api/cleaning/bookings/{code}/mark-paid/` | Sí | miembro `owner`/`admin` o `is_staff` | MVP: en una reserva `completed`, marca el cobro manual total sin aceptar importe; escribe `BookingEvent(event_type='payment')` (ADR-08, D-3) |
| `POST` | `/api/cleaning/bookings/{code}/payment/` | Sí | cliente dueño de la reserva | `[FASE 4]` Crea el `Payment` y devuelve el `init_point` |
| `POST` | `/api/reviews/` | Sí | `[EXISTE]` + `booking` opcional `[EXISTE]` | Reseñar (verificada solo con reserva completada) |

### 5.2 Formas de petición y respuesta

**`POST /api/cleaning/bookings/`** — el importe **no** viaja en la petición (ADR-08):

```json
// request
{ "listing": 42, "resource": 7, "start_at": "2026-10-10T15:00:00Z",
  "city": 1, "address": "Av. Arequipa 1234, dpto 501", "district": "san-borja",
  "customer_notes": "Llamar al llegar, hay portero" }

// 201 Created
{ "code": "CL-2026-000123", "status": "requested",
  "hold_expires_at": "2026-10-08T22:15:00Z",
  "start_at": "2026-10-10T15:00:00Z", "end_at": "2026-10-10T18:00:00Z",
  "occupies_until": "2026-10-10T18:30:00Z",
  "service": { "listing": 42, "title": "Limpieza profunda de departamento",
               "duration_minutes": 180, "buffer_minutes": 30 },
  "account": { "id": 3, "display_name": "CleanHome Lima" },
  "resource": { "id": 7, "name": "Cuadrilla 1" },
  "price": "120.00", "zone_fee": "0.00", "currency": "PEN",
  "platform_fee": "12.00", "provider_amount": "108.00", "deposit_amount": "0.00",
  "payment_status": "unpaid" }
```

`resource` es **opcional**: si se omite, el servidor elige el primer recurso libre
del rango (obligatorio para que una empresa de 5 cuadrillas no obligue al cliente
a elegir). Si el cliente lo envía, se valida que pertenezca a la cuenta y esté
libre.

**`GET /api/cleaning/providers/{id}/availability/?service=42&from=2026-10-10&to=2026-10-12`**

```json
{ "service": 42, "duration_minutes": 180, "timezone": "America/Lima",
  "days": [
    { "date": "2026-10-10", "weekday": 4,
      "slots": [ { "start": "2026-10-10T15:00:00Z", "end": "2026-10-10T18:00:00Z",
                   "resource_id": 7, "resource_name": "Cuadrilla 1" },
                 { "start": "2026-10-10T15:30:00Z", "end": "2026-10-10T18:30:00Z",
                   "resource_id": 8, "resource_name": "Cuadrilla 2" } ] },
    { "date": "2026-10-11", "weekday": 5, "slots": [], "reason": "fuera_de_horario" },
    { "date": "2026-10-12", "weekday": 6, "slots": [], "reason": "excepcion_no_disponible" }
  ],
  "generated_at": "2026-10-08T22:00:00Z" }
```

`reason` es informativo para la UI (nunca un error HTTP). Los `start` van en UTC
con offset; el frontend renderiza en `timezone`.

**`POST /api/cleaning/services/`** — creación atómica (evita `Listing` huérfano sin
`ServiceDetails`):

```json
{ "title": "Limpieza profunda de departamento", "description": "...",
  "price": "120.00", "currency": "PEN", "category": 12,
  "location": "Lima", "latitude": "-12.1021", "longitude": "-77.0012",
  "duration_minutes": 180, "buffer_minutes": 30, "min_notice_hours": 12 }
```

**Respuesta de error uniforme** (todos los endpoints de la vertical):

```json
{ "code": "slot_unavailable",
  "detail": "El horario 2026-10-10T15:00:00Z ya no está disponible.",
  "extra": { "resource_id": 7, "conflicting_start": "2026-10-10T14:00:00Z" } }
```

Se implementa con una excepción propia `CleaningAPIError(code, detail, extra,
status)` y un `exception_handler` de DRF en la app de la vertical, para no
depender del formato por defecto de DRF (que no tiene `code` estable) ni ensuciar
el núcleo.

### 5.3 Semántica de errores y el caso 409

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `validation_error` | Campos inválidos, formato de fecha, `end_at <= start_at` |
| 401 | `not_authenticated` | Falta token |
| 403 | `forbidden_role` | Autenticado pero sin rol suficiente (p. ej. `staff` editando el perfil) |
| 403 | `not_participant` | Intentar ver una reserva ajena |
| 404 | `not_found` | Reserva/servicio inexistente o no visible |
| 409 | `slot_unavailable` | **La restricción de exclusión rechazó el solapamiento** (ADR-04) |
| 409 | `hold_expired` | Se intenta confirmar una reserva cuyo hold venció |
| 409 | `idempotency_key_reused` | Se repite una clave de idempotencia con un payload distinto |
| 409 | `invalid_transition` | Transición no permitida por §4.1 |
| 422 | `outside_service_area` | El distrito no está en `ProviderServiceArea` |
| 422 | `too_soon` / `beyond_horizon` | Fuera de `min_notice_hours` / `max_horizon_days` |
| 422 | `provider_not_verified` | Cuenta no `verified` en un flujo que la exige |
| 422 | `already_reviewed` | Segunda reseña para la misma reserva (ADR-09) |

Implementación obligatoria del 409: el `IntegrityError` de PostgreSQL llega con
SQLSTATE **`23P01`** (`exclusion_violation`). Se captura, se comprueba
`e.__cause__.pgcode == '23P01'` y se traduce a `slot_unavailable`; cualquier otro
`IntegrityError` **no** debe convertirse en 409 (sería ocultar un bug real).
Mensaje al usuario: "ese horario se acaba de ocupar, elige otro", nunca un 500.

La cabecera opcional `Idempotency-Key` evita duplicados por reintento. Una
repetición con la misma huella devuelve la reserva existente (HTTP 200); la misma
clave con otra huella devuelve `idempotency_key_reused`. Si dos peticiones con la
misma clave compiten, la violación de `unique_booking_idempotency_per_customer`
se resuelve después del rollback consultando la reserva ganadora y comparando la
huella. No se convierte ese error en `slot_unavailable`.

### 5.4 Reutilización deliberada

- Paginación, filtros y orden: `PageNumberPagination` (20) y
  `DjangoFilterBackend`+`SearchFilter`+`OrderingFilter` `[EXISTE]`. La vertical los
  configura igual, no inventa otro estilo.
- Favoritos sobre servicios: `Favorite` apunta a `Listing` `[EXISTE]`, así que
  "guardar un proveedor/servicio" funciona sin código nuevo.
- Permisos: se siguen el estilo de `marketplace/listings/permissions.py`
  (`IsOwnerOrReadOnly`, `IsListingImageOwner`).
- Errores de negocio con `code` estable: nuevo, y solo en la vertical.

---

## 6. Permisos

### 6.1 Matriz rol × acción

Roles: `anon`, `customer` (autenticado sin membership), `staff`, `admin_` y
`owner` (miembro de la cuenta con ese rol), `platform` (`is_staff=True`).

| Acción | anon | customer | staff | admin_ | owner | platform |
|---|---|---|---|---|---|---|
| Ver directorio, perfil, disponibilidad | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear reserva | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver reserva | ❌ | solo propias | solo de recursos asignados | solo de su cuenta | solo de su cuenta | todas |
| Confirmar / rechazar reserva | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Iniciar / completar trabajo | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Cancelar reserva | ❌ | solo propias | ✅ | ✅ | ✅ | ✅ |
| Crear/editar servicios | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Gestionar agenda y recursos | ❌ | ❌ | solo su propia agenda | ✅ | ✅ | ✅ |
| Gestionar miembros y roles | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Editar perfil y zonas de la cuenta | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Verificar/suspender cuentas | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Marcar cobro manual | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Reseñar | ❌ | ✅ (verificada solo con reserva `completed`) | ✅ | ✅ | ✅ | ✅ |

Decisión explícita: **`staff` no edita el perfil ni los precios** (puede ejecutar
trabajos y administrar la agenda solo de los `ProviderResource` a los que está
asignado mediante `ProviderResource.members`), porque el caso de uso es "la empresa
tiene limpiadores que usan la app sin acceso comercial".

### 6.2 Clases de permiso a implementar

```python
# [EXISTE] verticals/cleaning/providers/permissions.py
class IsProviderMember(BasePermission):        # object-level: account
    """owner/admin ven la cuenta; staff solo sus recursos asignados."""

class IsProviderManager(BasePermission):       # object-level: account
    """rol en {owner, admin}, o is_staff."""

class IsProviderOwner(BasePermission):         # object-level: account
    """rol == owner, o is_staff. Para cambios de titularidad y borrado."""

# [EXISTE] verticals/cleaning/bookings/permissions.py
class IsBookingParticipant(BasePermission):    # object-level: booking
    """booking.customer == user o IsProviderMember(booking.account)."""

class IsBookingProviderSide(BasePermission):   # object-level: booking
    """owner/admin de booking.account o staff asignado a booking.resource."""

class IsBookingCustomer(BasePermission):       # object-level: booking
    """booking.customer == user (pagar, cancelar como cliente)."""
```

### 6.3 Invariante de propiedad (detalle que un implementador olvidaría)

`Listing.seller` es una FK a `User` `[EXISTE]` y el paquete ya trae
`IsOwnerOrReadOnly` para editar anuncios. Para que un servicio pertenezca a la
**cuenta** y no a la persona que lo creó (ADR-01), se fija esta invariante:

> Para cualquier `Listing` con `service_details`, se cumple
> `listing.seller_id == listing.service_details.provider_account.owner_id`.

Se mantiene con:

1. Al crear el servicio, `seller = account.owner`.
2. Una señal `post_save` de `ProviderAccount` que, al cambiar `owner`, reasigna
   `seller` de todos sus `Listing` (transferencia de titularidad).
3. Un chequeo en `manage.py check`-style (`django.core.checks`) o test que falla
   si la invariante se rompe, para que no se degrade en silencio.

Así el feed (`seller_username`), `IsOwnerOrReadOnly` y los filtros existentes
siguen funcionando sin tocar el núcleo, y la autorización "de verdad" de la
vertical se resuelve contra `ProviderMembership`, no contra `Listing.seller`.

### 6.4 Regla de aislamiento de datos

Todo queryset de reservas se filtra **en el `get_queryset()`** por participación:
reservas propias como cliente; todas las reservas de cuentas donde el usuario es
owner/admin; y solo reservas de recursos asignados cuando es staff. Nunca se
confía en el filtro del frontend. Un `GET /api/cleaning/bookings/` sin filtros
devuelve esa unión, paginada. Es el punto donde una vertical filtra datos de
negocio entre empresas competidoras y entre trabajadores de una misma empresa,
así que lleva test propio (§11.4).

---

## 7. Cálculo de disponibilidad

Objetivo de rendimiento explícito: **número de consultas constante**, sin importar
cuántos días, recursos o reglas haya (nada de N+1 por día).

### 7.1 Entrada y validaciones

```
GET /api/cleaning/providers/{account_id}/availability/?service={listing_id}&from&to[&resource]
```

| Validación | Respuesta si falla |
|---|---|
| `service` existe, tiene `service_details`, `is_active=True`, `listing.status != 'paused'` | `404` / `422 service_inactive` |
| `from <= to` y `(to - from) <= max_horizon_days` | `400 validation_error` / `422 beyond_horizon` |
| La cuenta está activa y no `rejected` | `404 not_found` |
| `resource`, si viene, pertenece a la cuenta y está activo | `400 validation_error` |

### 7.2 Algoritmo (pseudocódigo normativo)

```python
# [EXISTE] verticals/cleaning/availability/services.py
ACTIVE = (Booking.Status.REQUESTED, Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS)

def available_slots(*, account, listing, date_from, date_to, resource=None):
    sd = listing.service_details
    resources = [resource] if resource else list(account.resources.filter(is_active=True))
    STEP = timedelta(minutes=settings.BOOKING_SLOT_STEP_MINUTES)
    local_range_start_utc, local_range_end_utc = utc_bounds_for_resource_days(
        date_from, date_to, resources, account.timezone)
    now = timezone.now()
    duration = timedelta(minutes=sd.duration_minutes)
    occupied_len = duration + timedelta(minutes=sd.buffer_minutes)   # ← rango OCUPADO

    # 4 consultas constantes: recursos, reglas, excepciones y reservas activas.
    rules = list(AvailabilityRule.objects.filter(resource__in=resources, is_active=True))
    exceptions = list(AvailabilityException.objects.filter(
        resource__in=resources,
        starts_at__lt=local_range_end_utc, ends_at__gt=local_range_start_utc))
    bookings = list(Booking.objects.filter(
        resource__in=resources,
        start_at__lt=local_range_end_utc,
        occupies_until__gt=local_range_start_utc).filter(
            Q(status__in=[Booking.Status.CONFIRMED, Booking.Status.IN_PROGRESS]) |
            Q(status=Booking.Status.REQUESTED, hold_expires_at__gte=now)))
    active_counts = count_bookings_by_service_resource_local_day(bookings, resources, listing)

    out = {}
    for day in date_range(date_from, date_to):
        for r in resources:
            windows = []
            for rule in rules_of_day(rules, r, day):          # weekday + valid_from/to
                resource_tz = ZoneInfo(r.timezone or account.timezone)
                windows.append(to_utc(day, rule.start_time, rule.end_time, resource_tz))
            for extra in extra_exceptions(exceptions, r, day): # kind == extra_available
                windows.append((extra.starts_at, extra.ends_at))
            windows = subtract(windows, unavailable_exceptions(exceptions, r, day))
            for (w_start, w_end) in windows:
                k = 0
                while w_start + k*STEP + duration <= w_end:    # STEP = slot_step_minutes
                    s = w_start + k*STEP
                    k += 1
                    if s < now + timedelta(hours=sd.min_notice_hours):   # demasiado pronto
                        continue
                    if (sd.max_per_day is not None and
                            active_counts.get((listing.id, r.id, day), 0) >= sd.max_per_day):
                        continue
                    if overlaps_any(bookings, r.id, s, s + occupied_len):  # mismo criterio que la constraint
                        continue
                    out.setdefault(day, []).append(Slot(s, s + duration, r))
        dedupe(out[day])                                      # reglas solapadas → set
        sort_by_start(out[day])
        out[day] = out[day][:50]                             # límite determinista de respuesta
    return out
```

Cuatro decisiones dentro del pseudocódigo que no son obvias y hay que respetar:

1. **El test de solapamiento usa el rango ocupado del candidato**
   (`s … s + duration + buffer`), no su duración. Es exactamente el mismo criterio
   que la restricción de exclusión de ADR-04: si el cálculo y la restricción usan
   rangos distintos, la API ofrecerá huecos que la base luego rechazará con 409, y
   el usuario verá un error inexplicable.
2. **Una lectura nunca purga** (ADR-06). El `GET` **ignora** los holds con
   `hold_expires_at < now()` al calcular, pero no los cambia: un `GET` que escribe
   no es cacheable y provoca carreras. La expiración real ocurre dentro de la
   transacción de creación (§8), donde el `UPDATE status='expired'` corre antes
   del `INSERT`.
3. **`max_per_day` cuenta reservas activas de ese servicio por recurso y día
   local** (no UTC): el tope comercial es "3 limpiezas profundas el lunes", y el
   lunes es local.
4. **La respuesta se acota** (máx. 50 slots por día) para que un recurso con
   jornada de 12 h y `STEP=30` no devuelva cientos de entradas: el frontend
   muestra un select, no una lista infinita.

### 7.3 Casos de borde que el algoritmo debe cubrir (y sus tests)

| Caso | Comportamiento esperado |
|---|---|
| Reglas solapadas el mismo día (08–12 y 11–15) | Slots deduplicados, sin repetidos |
| Servicio que no cabe en la ventana (180 min en ventana de 120) | Día sin slots, `reason: "sin_espacio"` |
| Reserva `cancelled` o `completed` en el rango | **No** bloquea |
| Reserva `requested` con hold vigente | Bloquea |
| Reserva `requested` con hold vencido | No bloquea (y se purgará al reservar) |
| Excepción `unavailable` de 3 días | Esos días sin slots, `reason: "excepcion_no_disponible"` |
| Excepción `extra_available` en un día sin regla | Genera slots |
| Cambio de zona horaria del recurso | Slots correctos; `America/Lima` sin DST |
| `min_notice_hours=12` y consulta para hoy | Solo horarios a más de 12 h |
| Reserva que termina 13:00 con `buffer=30` y candidato 13:00 | **Rechazado** (ocupa hasta 13:30) |

---

## 8. Concurrencia y transacción de creación

### 8.1 La transacción exacta de `POST /api/cleaning/bookings/`

```python
# [EXISTE] verticals/cleaning/bookings/services.py
def create_booking(*, customer, listing, start_at, city, address, district,
                   resource=None, notes='', idempotency_key=None):
    with transaction.atomic():
        account = listing.service_details.provider_account
        # 1. Validaciones que no escriben: existencia/pertenencia/estado del
        #    servicio, zona cubierta, aviso mínimo y horizonte.
        service_area = validate_booking_request(
            listing=listing, city=city, district=district, start_at=start_at,
            resource=resource)  # devuelve la zona activa que fija el recargo
        duration = timedelta(minutes=listing.service_details.duration_minutes)
        buffer = timedelta(minutes=listing.service_details.buffer_minutes)

        # 2. Idempotencia: misma clave + misma petición devuelve la reserva.
        fingerprint = fingerprint_request(listing, start_at, address, district, resource, notes)
        if idempotency_key:
            existing = Booking.objects.filter(customer=customer,
                                              idempotency_key=idempotency_key).first()
            if existing:
                if existing.request_fingerprint != fingerprint:
                    raise CleaningAPIError('idempotency_key_reused', ..., status=409)
                return existing, False

        # 3. Expirar holds vencidos de la cuenta y registrar sus eventos.
        #    UPDATE status saca las filas del índice EXCLUDE; no se borra historial.
        expire_holds(account=account, now=timezone.now())

        # 4. Resolver recurso (si no viene) y calcular importes congelados (ADR-08).
        resource = resource or pick_first_free_resource(...)
        validate_resource_capacity(resource, listing.service_details.capacity)
        amounts = snapshot_prices(listing=listing, account=account,
                                  service_area=service_area)

        # 5. INSERT. Aquí es donde PostgreSQL decide: si solapa, lanza 23P01.
        booking = Booking.objects.create(
            code=next_booking_code(), customer=customer, account=account,
            resource=resource, listing=listing, status=Booking.Status.REQUESTED,
            start_at=start_at, end_at=start_at + duration,
            buffer_minutes=listing.service_details.buffer_minutes,
            occupies_until=start_at + duration + buffer,     # snapshot; invariante de ADR-04
            hold_expires_at=timezone.now() + timedelta(minutes=settings.BOOKING_HOLD_TTL_MINUTES),
            city=city, address=address, district=district, idempotency_key=idempotency_key,
            request_fingerprint=fingerprint,
            payment_status=Booking.PaymentStatus.UNPAID, **amounts)

        # 6. Auditoría.
        BookingEvent.objects.create(booking=booking, from_status='', to_status=booking.status,
                                   actor=customer, actor_role='customer')
        return booking, True
```

El `IntegrityError` de PostgreSQL en el paso 5 se deja propagar hasta la vista, que
lo traduce según §5.3. **No se captura dentro de la transacción para reintentar**:
un reintento automático escondería que el hueco se ocupó.

### 8.2 Qué NO hacer (y por qué)

| Anti-patrón | Por qué se descarta |
|---|---|
| `if not Booking.objects.filter(...).exists(): create()` | Condición de carrera clásica: dos peticiones simultáneas leen "libre" y ambas reservan. Es el bug que este plan existe para evitar. |
| `select_for_update()` sobre `ProviderResource` | Serializa **todas** las reservas del recurso, incluso las de días distintos, y solo protege el código que pasa por ahí. |
| Bloqueo consultivo (`pg_advisory_lock`) | Funciona, pero hay que recordar tomarlo en cada camino de escritura (incluido el admin). La restricción no se olvida. |
| Reintentar el `INSERT` ante 23P01 | Convertiría un conflicto real en una reserva en otro horario sin que el cliente lo sepa. |
| `get_or_create` sobre `(resource, start_at)` | No detecta solapamientos parciales (ADR-04). |

### 8.3 Garantía real bajo concurrencia

Con la restricción de exclusión, dos transacciones concurrentes que insertan rangos
solapados para el mismo recurso se serializan en el índice GiST: la segunda
espera a que la primera confirme y, si confirma, falla con `23P01`; si la primera
hace rollback, la segunda entra. El resultado neto es **exactamente una reserva
confirmada**, sin locks de aplicación y sin ventana de carrera.

### 8.4 Pruebas de concurrencia obligatorias (Fase 2)

- Dos hilos con `threading.Barrier`, cada uno abriendo su propia conexión
  (`connection.close()` al empezar), insertando el mismo rango contra el mismo
  recurso: **1 éxito y 1 `409 slot_unavailable`**.
- `TransactionTestCase` (o `@pytest.mark.django_db(transaction=True)`): con
  `TestCase` normal cada test corre en una transacción y los hilos no ven los
  datos del otro, con lo que la prueba pasaría siempre y no probaría nada.
- Variante con tiempos distintos: 10:00–13:00 vs 11:00–14:00 → 1 y 1.
- Variante adyacente: 10:00–13:00 vs 13:00–16:00 con `buffer=0` → **2 éxitos**.
- Variante con `buffer=30`: 10:00–13:00 vs 13:00–16:00 → **1 éxito y 1 conflicto**.

---

## 9. Integración con el núcleo existente

### 9.1 Pagos (Fase 4, diseñado ahora para no rediseñar después)

- La reserva se crea **sin** pago (ADR-08). El cobro es un paso posterior:

  ```
  POST /api/cleaning/bookings/{code}/payment/
    1. valida que el usuario sea el customer y la reserva esté 'requested'/'confirmed'
    2. Payment.objects.create(payer=user, amount=booking.price, currency=booking.currency,
                              payment_type='booking', status=PENDING,
                              external_reference=booking.code,          # ← indexed [EXISTE]
                              platform_fee=booking.platform_fee,
                              metadata={'booking_code': booking.code})
    3. gateway.create_preference(...)  → init_point
  ```

  Se usa `external_reference` (que ya tiene `db_index=True`
  [payments_core/models.py:56-61](../creatorhub_core/payments_core/models.py#L56-L61))
  para enlazar pago y reserva, **no** `metadata` (JSON sin índice): el webhook debe
  resolver la reserva con una consulta indexada.
- El receptor vive en la vertical y sigue el patrón exacto de
  `marketplace/visibility/signals.py` `[EXISTE]`:

  ```python
  @receiver(payment_completed)
  def on_booking_payment_completed(sender, payment, **kwargs):
      if payment.payment_type != 'booking':
          return
      confirm_paid_booking(payment.external_reference, payment)
  ```

- El webhook (`/api/payments/webhook/mercadopago/`) **no se toca**: ya despacha
  las señales y ya valida la firma.
- La acción de pago de la vertical crea el `Payment` directamente en vez de usar
  `CreatePreferenceView` `[EXISTE]` por dos motivos: (a) el importe se calcula en
  el servidor desde la reserva, y (b) el `external_reference` debe ser el código
  de la reserva, y esa vista lo genera con su propio formato.

### 9.2 Reseñas

- Migración aditiva (ADR-09): `Review.booking`, `Review.is_verified`.
- `ProviderAccount.rating_avg`/`rating_count` se recalculan por señal
  (`post_save`/`post_delete` de `Review`), con el mismo patrón desnormalizado que
  `Listing.favorite_count` `[EXISTE]`. Solo cuentan para la reputación de cuenta
  las reseñas con `booking` completado; las reseñas genéricas de productos
  mantienen su agregación seller-céntrica. En una reseña de reserva, `reviewer`
  debe ser `booking.customer` y el `seller` legado se fija a
  `booking.account.owner` para conservar compatibilidad con el modelo existente.
- El endpoint sigue siendo `/api/reviews/` `[EXISTE]`; el serializer gana
  `booking` (opcional) y `is_verified` (read-only).

### 9.3 Visibilidad promocionada — "empresa destacada en San Borja"

Aquí hay un hallazgo que condiciona el trabajo: la promoción **no** está inyectada
en el feed de anuncios. `FeaturedSellersView` sirve una lista aparte en
`/api/visibility/featured/` y su propio docstring lo admite:

> *"No devuelve listings: todavía no está definida la relación entre una
> VisibilityPurchase y un listing específico."*
> — [visibility/views.py:363-373](../marketplace/visibility/views.py#L363-L373)

Consecuencias para la vertical, con decisiones:

1. La unidad promocionada hoy es **ciudad + vendedor (`User`)**, no distrito ni
   cuenta. Para limpieza se necesita distrito y cuenta ⇒ migración aditiva
   `VisibilityPurchase.provider_account` (ADR-10) y un endpoint propio
   `GET /api/cleaning/featured/?city=&district=` que reutiliza
   `VisibilityPurchaseManager.active_for_city` y `occupied_positions` `[EXISTE]`.
2. **Reutilización que sale gratis**: el inventario de posiciones, el modo
   promoción gratuita (`is_promo_mode`), el reclamo de slot libre y la compra
   (`/api/visibility/cities/{slug}/claim|buy/`) funcionan tal cual; solo cambia a
   quién pertenece la compra.
3. Decisión aprobada (D-1, §12): la posición destacada se vende por **ciudad**,
   usando el inventario actual. El distrito es un filtro del directorio mediante
   `ProviderServiceArea`, no una dimensión del inventario premium del MVP.

### 9.4 Categorías y datos iniciales

Data-migration idempotente (§3.5) con la raíz "Limpieza" y seis subcategorías, más
2-3 `City` de ejemplo si la tabla está vacía (`[EXISTE]`, la creación de ciudades
hoy es manual por admin).

### 9.5 Admin

- `ProviderAccountAdmin` con inlines de `ProviderMembership`, `ProviderResource`,
  `ProviderServiceArea` y un enlace a sus servicios.
- `BookingAdmin`: `list_display` (code, start_at, account, resource, status,
  payment_status, price), `list_filter` (status, payment_status, account),
  `search_fields` (code, customer email, address), `date_hierarchy`.
- **Los estados no se editan a mano en el admin**: `status` y `payment_status` son
  `readonly_fields` y los cambios se hacen con acciones que llaman a las funciones
  de §4.1 (confirmar, cancelar, completar). Es la única forma de que
  `BookingEvent` sea una auditoría fiable.
- Acción `release_expired_holds` (ADR-06) expuesta también como comando de gestión.
- `AvailabilityRule` con `list_filter` por recurso y un chequeo de solapamiento
  *informativo* (no bloqueante, ADR-05).

### 9.6 Frontend (React 19 + Vite 8 + react-query + zustand)

Rutas nuevas (react-router 7 `[EXISTE]`), reutilizando el shell y Tailwind:

| Ruta | Pantalla | Reutiliza |
|---|---|---|
| `/cleaning/providers` | Directorio con filtros (distrito, categoría, rating) | Grilla de `HomePage` + `ListingCard` |
| `/cleaning/providers/:id` | Perfil, zonas, reseñas y sus servicios | `ListingCard`, sección de reseñas de `ListingDetailPage` |
| `/cleaning/book/:listingId` | Asistente: fecha → horario → dirección → confirmar | nuevo; estado del wizard en zustand, datos en react-query |
| `/my-bookings` | Reservas como cliente + estado | patrón de `MyListingsPage` |
| `/provider/dashboard` | Agenda de hoy/semana por recurso | nuevo |
| `/provider/services` | CRUD de servicios (usa `POST /api/cleaning/services/`) | patrón de `CreateListingPage`/`EditListingPage` |
| `/provider/schedule` | Reglas semanales y excepciones | nuevo |
| `/provider/bookings/:code` | Confirmar/rechazar/iniciar/completar | nuevo |

- `ListingDetailPage` `[EXISTE]` gana un CTA **"Reservar"** cuando la respuesta
  trae `service_details`; si no lo trae, la página se comporta como hoy. Es la
  única modificación de una pantalla existente.
- Tipos: extender `frontend/src/types/api.ts` `[EXISTE]` con `Provider`,
  `ServiceDetails`, `AvailabilitySlot`, `Booking`.
- El proxy de Vite ya enruta `/api`, `/admin`, `/media` y `/static` al backend
  `[EXISTE]`: no hay que tocar `vite.config.ts`.
- No-goal del MVP: diseño visual nuevo, mapas, pago en línea, notificaciones
  push, app móvil.

---

## 10. Plan por fases, con criterios de aceptación

| Fase | Objetivo | Estado |
|---|---|---|
| **0** | Auditoría del paquete base | ✅ Hecha (§1) |
| **1** | Este plan técnico | ✅ Entregado |
| **1.5** | Documento oficial, separando estado actual / propuesto / MVP / futuro | ✅ Cerrada en esta revisión |
| **2** | MVP: servicios, agenda y reservas sin dinero real | Implementado y probado (backend, admin y frontend); pendiente el pase manual de aceptación |
| **3** | Experiencia ampliada de reputación, estados finos, notificaciones y operación | Diseñado en líneas generales |
| **4** | Dinero real: comisión y split con Mercado Pago | Especificado como integración, no como diseño |
| **5** | SaaS: organizaciones, planes, facturación, multi-sucursal | Solo acotado |

### Fase 2 — MVP (lo que hay que construir)

**Entregables**

1. Paquete `verticals/cleaning/` con 4 apps y sus `AppConfig.label` (ADR-10).
2. Modelos de §3 con migraciones, incluida la restricción de exclusión (Apéndice A).
3. Migraciones aditivas de §3.5 + data-migration de categorías "Limpieza".
4. Endpoints de §5.1 (los marcados hasta `mark-paid`; `payment` es Fase 4).
5. Permisos de §6.2 y filtrado de §6.4.
6. Admin de §9.5 + comando `release_expired_holds`.
7. Configuración de pruebas (`pytest.ini` + `conftest.py`) y los tests de §11.3-§11.4.
8. Frontend mínimo: `/cleaning/providers`, `/cleaning/providers/:id`,
   `/cleaning/book/:listingId`, `/my-bookings`, `/provider/dashboard`,
   `/provider/services`, `/provider/schedule`, y el CTA "Reservar" en
   `ListingDetailPage`.

**Criterios de aceptación (verificables, no opinables)**

- [ ] `POST /api/cleaning/bookings/` sobre un hueco libre devuelve `201` con `code`, `price`, `platform_fee`, `provider_amount` y `hold_expires_at`.
- [ ] Dos peticiones concurrentes del mismo rango devuelven **una 201 y una 409 `slot_unavailable`** (test de §8.4, no una prueba manual).
- [ ] `psql` rechaza un `INSERT` solapado hecho a mano: la garantía no depende de Django.
- [ ] `GET availability` nunca ofrece un hueco que el `POST` rechace: test paramétrico que cruza ambos (10 combinaciones de buffers/duraciones).
- [ ] Una reserva `cancelled` libera el hueco (se puede volver a reservar el mismo rango).
- [ ] Un hold vencido **no** bloquea: se puede reservar sin intervención manual.
- [ ] Una cuenta B no ve ninguna reserva de la cuenta A en ningún endpoint (test de §11.4).
- [ ] `staff` no puede editar precios ni el perfil (403 `forbidden_role`).
- [ ] Ninguna transición ilegal es posible por API **ni** por admin (los estados son `readonly` allí).
- [ ] `manage.py check` limpio y la invariante de propiedad de §6.3 verificada por test.
- [ ] `pytest` verde con la cobertura de los casos obligatorios de §11.

**Fuera de alcance de la Fase 2 (explícito, para no confundir el estado del código)**

Pago en línea y split · geolocalización con mapas · notificaciones y tiempo real ·
asignación automática de trabajadores (dispatch) · reservas recurrentes ·
cotización variable por m²/habitaciones · facturación · multi-sucursal formal ·
app móvil.

### Fase 3 — Operación y confianza

UI de reputación y agregados verificados en el perfil (la vinculación/verificación
de reseñas y su endpoint ya forman parte de la Fase 2, ADR-09); `no_show` con
política de cobro; penalidades de cancelación (`cancellation_hours`) efectivas;
verificación de proveedores con documentos (`ProviderDocument`); notificaciones
con un consumer real de Channels (ADR-12); incidencias y notas internas;
exportación de agenda.

### Fase 4 — Dinero real

Alta de proveedores como cuentas conectadas de Mercado Pago (OAuth), pago con
`application_fee` por reserva, reembolsos, conciliación (`Payment` ↔ `Booking` ↔
extracto bancario), liquidación periódica al proveedor y reporte de comisiones.
Aquí `PLATFORM_FEE_PERCENT` `[EXISTE]` deja de ser un campo muerto.

### Fase 5 — SaaS

`Organization` **por encima** de `ProviderAccount` (ADR-01), planes y suscripciones,
facturación, panel de operaciones multi-sucursal, analítica (ocupación, ingresos por
distrito, cancelaciones), configuración por tenant. Es el punto donde el producto
deja de ser un marketplace y pasa a ser un SaaS vertical.

---

## 11. Estrategia de pruebas

### 11.1 Punto de partida incómodo

El paquete **no tiene ni un test** y ninguna configuración de pytest (§1.2), así que
la Fase 2 los crea desde cero:

```ini
# [EXISTE] pytest.ini
[pytest]
DJANGO_SETTINGS_MODULE = core.settings
python_files = test_*.py
addopts = -q --ds=core.settings
```

```python
# [EXISTE] conftest.py
@pytest.fixture
def provider_account(db): ...        # cuenta + owner + recurso "Principal"
@pytest.fixture
def service(db, provider_account): ...  # Listing + ServiceDetails
@pytest.fixture
def booked_slot(db, service): ...       # reserva confirmada 10:00-13:00
```

Ubicación: `tests/` por app de la vertical (`verticals/cleaning/bookings/tests/`),
con `factory`-helpers propios (no se añade `factory_boy` en el MVP para no ampliar
dependencias).

### 11.2 Matriz de pruebas obligatorias

| Capa | Casos |
|---|---|
| Modelo | `occupies_until = end_at + buffer` se recalcula al mover la reserva; validaciones de `ServiceDetails`; `code` único por año |
| Restricción (SQL crudo) | Solapamiento rechazado por PostgreSQL; adyacente aceptado; `cancelled`/`completed` no bloquean; otro recurso no bloquea; **el test inserta por `cursor.execute`, no por ORM**, para probar la garantía de base de datos |
| Algoritmo de disponibilidad | La tabla de §7.3 completa, parametrizada |
| API | Crear/listar/detalle de reservas; las 8 transiciones válidas y 6 inválidas; `409` por carrera; `422` por distrito no cubierto, horizonte y aviso mínimo; replay idempotente igual y `409` si la clave se reutiliza con otro payload |
| Permisos | Matriz de §6.1 en un test por rol (parametrizado), incluido el `staff` sin acceso comercial |
| Aislamiento | §11.4 |
| Señales | `payment_completed` con `payment_type='booking'` confirma la reserva; con `'visibility'` **no** toca ninguna reserva |
| Dinero | `snapshot_prices` con `PLATFORM_FEE_PERCENT`, override de cuenta y recargo de zona; redondeo a 2 decimales; coherencia `platform_fee + provider_amount == price` |
| Reseñas | Sin reserva → `is_verified=False`; con reserva `completed` → `True`; segunda reseña de la misma reserva → `422 already_reviewed` |

### 11.3 El test que más importa

```python
@pytest.mark.django_db(transaction=True)
def test_no_double_booking_under_concurrency(service, customer_a, customer_b):
    barrier = threading.Barrier(2)
    results = []
    def attempt(customer):
        connection.close()
        barrier.wait()
        try:
            create_booking(customer=customer, listing=service, start_at=SLOT, ...)
            results.append('ok')
        except CleaningAPIError as e:
            results.append(e.code)
    # ... 2 hilos, join ...
    assert sorted(results) == ['ok', 'slot_unavailable']
```

Sin `transaction=True` este test **pasa siempre** y no prueba nada: es el error más
común al testear concurrencia en Django y conviene dejarlo escrito en el propio
test como comentario.

### 11.4 Aislamiento entre cuentas

- Cuenta A y cuenta B, cada una con reservas. Como miembro de B, todos los
  endpoints devuelven 404/403 sobre recursos de A, y el listado **no** incluye
  ninguna fila de A.
- Un cliente X solo ve sus reservas; el token de X no accede a las de Y.
- Un `staff` asignado al recurso 1 no ve ni administra reservas del recurso 2,
  aunque ambos recursos pertenezcan a su cuenta.
- Un `provider_account` de otra ciudad no aparece en el filtro por distrito.

### 11.5 Lo que no se prueba en el MVP

Carga (k6/Locust) más allá del test de concurrencia; integración real con Mercado
Pago (Fase 4, con sandbox y credenciales propias); navegadores (no hay Playwright
instalado); correos. Se documenta como deuda explícita en vez de fingir cobertura.

---

## 12. Riesgos y decisiones abiertas

### 12.1 Decisiones cerradas para la Fase 2

| # | Decisión aprobada | Valor de Fase 2 | Razón / límite |
|---|---|---|---|
| D-1 | Inventario premium por ciudad o distrito | **Ciudad**, reutilizando el inventario actual. El directorio filtra proveedores por distrito mediante `ProviderServiceArea`; no se vende inventario premium por distrito en el MVP. | Cambiar luego el inventario implica una migración y una decisión de producto. |
| D-2 | Confirmación automática | `is_instant=False`: el proveedor acepta la solicitud. | Es coherente con el estado inicial `requested`; la confirmación automática queda fuera del MVP. |
| D-3 | Depósito / anticipo | **No** en el MVP. Las reservas nacen `unpaid`; el proveedor registra el cobro manual al completar o fuera de la plataforma. | `requires_deposit` y `deposit_amount` quedan desactivados y deben ser cero en el MVP. |
| D-4 | Redis / ADR-12 | **Se conserva** en la infraestructura existente; notificaciones reales y un consumer quedan para Fase 3. La Fase 2 no depende de Redis para crear reservas. | La decisión evita cambiar el stack base mientras reconoce que el vertical aún no lo consume. Fase 3 debe entregar el consumer para justificar su uso. |
| D-5 | Modelo de precio | **Precio fijo por servicio**, congelado en la reserva; sin cotización por hora, m² ni habitaciones. | El producto debe comunicar límites de tamaño en nombre/descripción de subcategorías; cotización variable es futuro. |
| D-6 | Asignación del recurso | El servidor asigna un `ProviderResource` al crear la reserva. El cliente puede omitirlo; si lo especifica, se valida. | La reserva necesita un recurso concreto para que la restricción de exclusión garantice la agenda. Dispatch posterior queda fuera del MVP. |

La decisión técnica D-5 está cerrada para implementar: **precio fijo por
servicio**. Sigue abierto el riesgo de validación comercial: la limpieza suele
depender de m² y habitaciones, por lo que el catálogo debe indicar claramente
el tamaño cubierto (por ejemplo, "Limpieza profunda — departamento hasta
100 m²"). Antes del lanzamiento se debe validar que compradores y proveedores
aceptan ese alcance fijo; si el negocio necesita cotización variable, se diseña
como trabajo posterior (`QuoteRequest` con `m2`, `rooms`, `bathrooms`), no se
presenta como capacidad del MVP.

### 12.2 Riesgos técnicos

| Riesgo | Mitigación |
|---|---|
| `btree_gist` no disponible o sin permisos en un hosting gestionado | El arranque falla ruidosamente y se documenta en el manual; alternativa de emergencia: columna `slot_key` con `unique_together` por franjas, que **reduce** (no elimina) la garantía — se acepta solo si el proveedor de BD lo impone |
| Holds abandonados que bloquean agenda | Purga perezosa en cada creación + comando periódico (ADR-06) + test explícito |
| El cálculo de disponibilidad se desincroniza de la restricción | Test paramétrico cruzado (§11.2): todo slot ofrecido debe poder reservarse |
| Crecimiento de `Booking` (histórico) | Índices de §3.6 y particionado por año `[FUTURO]` si supera decenas de millones de filas |
| Complejidad de estados en el frontend | Una sola fuente: `GET /bookings/{code}/` devuelve `status` + `allowed_transitions` calculadas en el servidor, para que la UI no replique la máquina de estados |
| Fuga de datos entre cuentas competidoras | §6.4 + §11.4, con test por endpoint |

### 12.3 Riesgo comercial (del que ya hablamos, y que este plan no resuelve)

La licencia del paquete concede **una** aplicación/dominio por compra
([LICENSE:13-14](../LICENSE#L13-L14)) mientras la estrategia
plantea siete verticales sobre la misma base. Es coherente si la vertical se vende
como producto con licencia propia o si se ofrece licencia extendida (el propio
LICENSE ya menciona "extended licensing, multisite usage"). Lo que no es coherente
es vender "el motor para múltiples productos" con una licencia de un solo producto
sin decirlo. La revisión de licencia queda como **gate comercial antes de vender o
distribuir verticales derivadas**; no cambia el diseño ni bloquea la implementación
interna del MVP de limpieza. La interpretación legal/comercial debe confirmarse
con el titular de la licencia antes de esa distribución.

---

## Apéndice A — Orden de migraciones

| # | Migración | Contenido |
|---|---|---|
| 1 | `cleaning_providers.0001_initial` | `ProviderAccount`, `ProviderMembership`, `ProviderResource`, `ProviderServiceArea` |
| 2 | `cleaning_services.0001_initial` | `ServiceDetails` (FK a `marketplace_listings.Listing`) |
| 3 | `cleaning_availability.0001_initial` | `AvailabilityRule`, `AvailabilityException` |
| 4 | `cleaning_bookings.0001_initial` | `Booking`, `BookingEvent` (con `CheckConstraint` de tiempo e importes) |
| 5 | `cleaning_bookings.0002_booking_exclusion_constraint` | `BtreeGistExtension()` + `AddConstraint(ExclusionConstraint)` |
| 6 | `marketplace_reviews.0002_review_booking_verified` | `Review.booking`, `Review.is_verified`, unique parcial |
| 7 | `cleaning_providers.0002_bootstrap_legacy_accounts` | Cuenta, membership y recurso principal para cada vendedor legado con anuncios o compras |
| 8 | `marketplace_visibility.0003_visibilitypurchase_provider_account` | Columna nullable + `RunPython` desde la cuenta asociada al `seller` |
| 9 | `marketplace_categories.0002_seed_cleaning_categories` | Taxonomía "Limpieza" idempotente; reverse sin-op porque `Category` es compartida |

```python
# [PROPUESTO] cleaning_bookings/migrations/0002_booking_exclusion_constraint.py
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeBoundary, RangeOperators
from django.contrib.postgres.operations import BtreeGistExtension
from django.db import migrations
from django.db.models import Func, Q

class TsTzRange(Func):
    function = 'TSTZRANGE'
    output_field = DateTimeRangeField()

constraint = ExclusionConstraint(
    name='booking_no_overlap_per_resource',
    expressions=[
        (TsTzRange('start_at', 'occupies_until', RangeBoundary()), RangeOperators.OVERLAPS),
        ('resource', RangeOperators.EQUAL),
    ],
    condition=Q(status__in=['requested', 'confirmed', 'in_progress']),
)

class Migration(migrations.Migration):
    dependencies = [('cleaning_bookings', '0001_initial')]
    operations = [
        BtreeGistExtension(),
        migrations.AddConstraint(model_name='booking', constraint=constraint),
    ]
```

La migración mantiene declarada la constraint en el estado del ORM. Para evitar
una migración inicial duplicada, el flujo de autoría es explícito: primero se
crea `0001_initial` con los modelos y **sin** `ExclusionConstraint`; después se
añade la constraint al modelo y se crea `0002_booking_exclusion_constraint` con
`BtreeGistExtension()` antes de `AddConstraint`. Antes de cerrar el cambio se
verifica que `makemigrations --check` no proponga operaciones pendientes y que
`sqlmigrate cleaning_bookings 0002` muestre la instalación de la extensión y la
constraint una sola vez. No se debe generar `0001` con la constraint y luego
volver a añadirla en `0002`.

En hosting gestionado, los archivos de la extensión deben estar instalados en el
servidor y el usuario de migración necesita `CREATE` en la base destino (o el
proveedor debe instalar `btree_gist` allí). La prueba de aceptación inserta datos
con `psql`/cursor en esa misma base para confirmar el comportamiento real de
PostgreSQL.

Al inspeccionar la definición desde Django 5.2, `constraint_sql()` puede devolver
un objeto `Statement`; las pruebas no deben asumir que es una cadena. Para
comparar SQL se puede usar `str(constraint_sql(...))`, pero la verificación
portable de integración debe consultar `pg_get_constraintdef()` en PostgreSQL y
ejecutar inserciones de solape/adyacencia. `sqlmigrate` también sirve para revisar
el SQL que Django ejecutará.

## Apéndice B — Configuración nueva (por entorno)

| Variable | Tipo | Defecto | Para qué |
|---|---|---|---|
| `CLEANING_VERTICAL_ENABLED` | bool | `False` | Activar/desactivar las rutas API de la vertical sin editar código; no desinstala apps ni revierte migraciones |
| `VITE_CLEANING_VERTICAL_ENABLED` | bool | `false` | Mostrar/ocultar rutas y navegación de limpieza en el frontend |
| `BOOKING_HOLD_TTL_MINUTES` | int | `15` | Duración del bloqueo `requested` (ADR-06) |
| `BOOKING_SLOT_STEP_MINUTES` | int | `30` | Paso de la rejilla de candidatos (ADR-05) |
| `BOOKING_MIN_NOTICE_HOURS` | int | `12` | Aviso mínimo por defecto (override en `ServiceDetails`) |
| `BOOKING_MAX_HORIZON_DAYS` | int | `30` | Horizonte de reserva por defecto |
| `CLEANING_PLATFORM_FEE_PERCENT` | decimal | — | Override de `PLATFORM_FEE_PERCENT` `[EXISTE]` para la vertical |

Las seis se leen con `python-decouple` `[EXISTE]`, igual que el resto de
[settings.py](../core/settings.py#L20-L59), y se documentan
en `docs/ENVIRONMENT_VARIABLES.md` y `.env.example` **solo si la vertical se
distribuye** (si no, quedan fuera del artefacto, §12.3).

## Apéndice C — Definición de terminado de la Fase 2

1. Las 9 migraciones del Apéndice A aplican sobre una base vacía y sobre la base
   local existente. El ciclo de reversión se comprueba en una base desechable
   sin datos de la vertical; revertir después de crear reservas es destructivo
   y requiere backup y un plan explícito de retención.
2. `manage.py check` sin incidencias; `pytest` verde.
3. El test de concurrencia de §11.3 falla si se comenta la restricción de
   exclusión (prueba de que el test prueba algo).
4. `psql` rechaza el `INSERT` solapado manual (garantía de base de datos).
5. El flujo completo del MVP se recorre a mano una vez y queda en capturas:
   proveedor crea servicio → define agenda → cliente consulta disponibilidad →
   reserva → proveedor confirma → completa → cliente deja reseña.
6. Desactivar la vertical oculta sus rutas sin interrumpir el marketplace base.
   Las apps siguen instaladas para satisfacer las FKs compartidas (ADR-10).
7. Este documento se actualiza: cada `[PROPUESTO]` que pase a `[EXISTE]` cambia de
   etiqueta y gana su referencia a archivo y línea, como en §1.1.

---

## Resumen en una página

- El paquete base **ya** tiene la separación núcleo/vertical, pagos genéricos por
  `payment_type`, reseñas seller-céntricas, visibilidad por ciudad y un feed con
  filtros: la vertical reutiliza todo eso y añade **tres** recursos, no un producto
  paralelo.
- La decisión estructural que no se puede posponer es **ADR-01**: el proveedor es
  `ProviderAccount` (con `ProviderResource` para la agenda), no `User`.
- La decisión técnica que no se puede posponer es **ADR-04**: la doble reserva se
  impide en PostgreSQL con una restricción de exclusión parcial, y ya está probada
  en este despliegue.
- El dinero se diseña ahora (`price`/`platform_fee`/`provider_amount` congelados en
  la reserva) y se cobra en la Fase 4: **el pago no debe condicionar el diseño de
  las reservas**, que es exactamente tu criterio.
- El riesgo de producto más serio no es técnico: **la limpieza se cotiza por m²**.
  El MVP debe declarar precio fijo y no prometer cotización variable.
- El riesgo comercial sigue abierto: la licencia de un solo dominio frente a la
  estrategia de siete verticales hay que alinearla antes de vender la primera.
