# Plan — publicación de servicios y calendario de disponibilidad

> **Documento interno de planificación.** No forma parte del índice ni del ZIP de
> compradores, por la misma regla que `CLEANING_VERTICAL_TECHNICAL_PLAN.md`
> (ver el cierre de `DOCUMENTATION_MAP.md`). No debe añadirse a ese índice.
>
> **Estado: implementación en curso — entregas A y B escritas y desplegadas
> desde el árbol de trabajo, sin commitear y sin confirmar todavía en Git.**
> La verificación automática pasó (`tsc -b`, `npm run build`, `manage.py check`);
> falta el recorrido manual de aceptación del dueño. Ver §12.
>
> Verificado contra el árbol el **2026-10-10**, con el commit `ba28031` como
> referencia. Fuente arquitectónica: `docs/CLEANING_VERTICAL_TECHNICAL_PLAN.md`
> (ADR-02, ADR-05, ADR-07, ADR-10, ADR-11) y `HANDOFF.md` §9–§13.
>
> **Revisión 2 (2026-10-10).** Incorpora las observaciones y decisiones del dueño
> del producto: no hay anuncios simples para proveedores de limpieza; una sola
> «Agenda de la empresa»; calendario mensual con franjas de 30 min; solicitud de
> verificación manual; y cuatro validaciones obligatorias antes de «Enviar a
> revisión». Ver §11.
>
> **Revisión 3 (2026-10-10).** Entregas A y B **implementadas y publicadas**. Se
> aparta del plan en cuatro puntos, documentados en §12: el alta de anuncio no
> se conserva para el staff de plataforma (el serializer no expone `is_staff`);
> las zonas de cobertura no tenían cliente API ni UI y se añadieron; la agenda
> del asistente usa un editor nuevo (`CompanyAgendaEditor`) en lugar de extraer
> el de `/provider/schedule`; y las cuatro validaciones son bloqueo duro.

## 1. Qué se quiere y qué pasa hoy

**Lo que se espera** (requisito del dueño del producto): cuando una empresa crea
un anuncio, debe indicar **cuánto tarda el servicio** y marcar en un
**calendario** qué días está disponible, como en Airbnb. El cliente debe ver ese
calendario en la ficha del anuncio.

**Lo que ocurre hoy**, con datos reales de producción (`marketplace_starter`,
2026-10-10):

| Hecho | Valor |
|---|---|
| Anuncio «lavado de colchones» (id 3, de `EMPRESA1`) | `status = active`, 2222.00, categoría «Limpieza regular» |
| `GET /api/listings/3/` → `service_details` | **`null`** |
| `cleaning_services_servicedetails` | **0 filas** |
| `cleaning_availability_availabilityrule` | **0 filas** |
| `cleaning_providers_providerservicearea` | **0 filas** |
| Cuenta de proveedor 5 (`EMPRESA1`) | `verification_status = pending` |
| Recursos de la cuenta | 1 («Principal», `timezone` nulo → hereda `America/Lima`) |

Consecuencia visible: el anuncio **no muestra «Reservar» ni calendario**, y no
es un fallo de la interfaz sino el resultado del diseño actual.

## 2. Por qué pasa (mecánica verificada)

1. El botón existe **solo si la respuesta del anuncio trae `service_details`**
   (`frontend/src/pages/listings/ListingDetailPage.tsx:234`), y el serializer
   devuelve `null` cuando no hay `ServiceDetails`
   (`marketplace/listings/serializers.py:55-59`).
2. El alta de anuncio (`/listings/new` → `CreateListingPage` →
   `ListingForm`) **no pregunta duración ni disponibilidad**. La duración solo se
   pregunta en `/provider/services`, que es otro camino.
3. `POST /api/cleaning/services/` **no convierte un anuncio existente: crea un
   `Listing` nuevo en `draft`** y luego el `ServiceDetails`
   (`verticals/cleaning/services/serializers.py:78-99`). Por eso un anuncio
   creado con «Publicar anuncio» nunca podrá ser reservable.
4. El calendario **no vive en la ficha**: está dentro del asistente de reserva
   (`/cleaning/book/{listingId}`, pasos 1 fecha · 2 horario · 3 dirección ·
   4 confirmar) y se alimenta de
   `GET /api/cleaning/providers/{pk}/availability/?service=&from=&to=`, que es
   disponibilidad **por servicio**.
5. Existen **cuatro bloqueos encadenados**. Los dos primeros explican lo que se
   ve; los dos últimos impedirían reservar incluso después de arreglarlos:

| # | Bloqueo | Dónde se manifiesta |
|---|---|---|
| 1 | Sin `ServiceDetails` → sin botón | `ListingDetailPage.tsx:234` |
| 2 | Sin `AvailabilityRule` → calendario sin días | `availability/services.py::available_slots` |
| 3 | Cuenta `pending` → `ProviderNotVerified` al confirmar | `bookings/services.py:201` |
| 4 | Sin `ProviderServiceArea` → `OutsideServiceArea` (el distrito es obligatorio) | `bookings/services.py:211-227` |

## 3. Principios de la propuesta

- **P1 · Una sola puerta.** Un proveedor de limpieza **no elige** entre un
  anuncio que se reserva y uno que no: publica servicios.
- **P2 · Nada publicable que parezca reservable y no lo sea.** El asistente no
  deja enviar a revisión un servicio incompleto (§4.1).
- **P3 · Duración y agenda pertenecen al servicio**, no al anuncio genérico.
- **P4 · La agenda es del recurso; el calendario del cliente muestra la unión**
  de los recursos activos de la cuenta.
- **P5 · La moderación por servicio se mantiene** (`draft → pending_review →
  active`, §12 del HANDOFF). No se propone debilitarla.

## 4. Nivel 1 — una sola puerta de publicación

Objetivo: que un proveedor de limpieza **no pueda** publicar por el camino
genérico, y que al crear su servicio se le pidan duración y agenda.
**Sin cambios de backend en esta entrega** (la imposición en servidor es la
Entrega E, §10).

**Decisión de producto (2026-10-10):** se elimina el anuncio simple del flujo de
una empresa de limpieza. El botón «+ Publicar anuncio» pasa a ser
«+ Crear servicio», y el alta de anuncio genérico queda reservada a `is_staff`
de plataforma y a futuras verticales.

| Archivo | Cambio | Criterio de aceptación |
|---|---|---|
| `frontend/src/components/layout/Header.tsx` | «+ Publicar anuncio» → **«+ Crear servicio»**, apuntando a `/provider/services/new` | Un `can_publish` de limpieza nunca ve el alta de anuncio genérico |
| `frontend/src/pages/listings/CreateListingPage.tsx` | Deja de estar en la navegación; solo alcanzable por `is_staff` de plataforma | Un proveedor que entre por URL a `/listings/new` es reconducido al asistente |
| ruta nueva `/provider/services/new` | Asistente de **3 pasos**: 1) datos + duración · 2) agenda de la empresa · 3) enviar a revisión | Al terminar existen `Listing` (draft) + `ServiceDetails` + reglas de agenda, y el anuncio queda en `pending_review` |
| `frontend/src/components/listings/ServiceFormFields.tsx` (nuevo) | Extraer el bloque de campos operativos hoy embebido en `ProviderServicesPage.tsx` (duración, buffer, capacidad, aviso, horizonte, cancelación, depósito) | `ProviderServicesPage` y el asistente usan el mismo componente; una sola fuente de verdad |
| `frontend/src/components/provider/CompanyAgendaEditor.tsx` (nuevo) | Editor de la **Agenda de la empresa**: patrón semanal, presets y conservación de las excepciones al guardar. Sustituye a la extracción de `ResourceScheduleEditor`, que queda para la Entrega D | El asistente guarda la agenda del recurso «Principal» sin tocar `/provider/schedule` |

Encadenado técnico del paso 2: `cleaningApi.providerResources(accountId)` para
obtener el recurso «Principal» (lo crea `/unete`) y
`cleaningApi.replaceResourceSchedule(accountId, resourceId, {rules, exceptions})`.

### 4.1 Validaciones obligatorias antes de «Enviar a revisión»

El paso 3 queda deshabilitado, con el motivo visible, hasta que se cumplan las
cuatro condiciones:

| # | Condición | Por qué |
|---|---|---|
| 1 | **Duración válida** (1–720 min) | El backend la valida con `full_clean()`; mejor no llegar al 400 |
| 2 | **Al menos una regla de disponibilidad** | Sin `AvailabilityRule` el calendario del cliente sale vacío |
| 3 | **Al menos una zona de cobertura** (`ProviderServiceArea` activa) | Sin cobertura, el cliente vería días libres y la reserva fallaría **al final** con `OutsideServiceArea` |
| 4 | **Cuenta en proceso de verificación o verificada** (`pending` o `verified`) | Con `rejected` la reserva nunca podrá confirmarse |

La condición 3 nace de una observación del dueño y evita el peor caso de
experiencia: enseñar disponibilidad real y fallar en el último paso.

Si la cuenta está `rejected`, el paso 2 **avisa** (no bloquea): el proveedor
puede preparar todo y solicitar la verificación.

## 5. Nivel 2 — experiencia Airbnb

### 5.1 Calendario del cliente en la ficha del anuncio

Componente nuevo `AvailabilityMonthCalendar`, alimentado por
`cleaningApi.availability({ service: listingId, from, to })`.

**Decisión (2026-10-10): calendario mensual con franjas de 30 minutos**, no un
simple selector de fecha/hora. Encaja con el motor actual
(`BOOKING_SLOT_STEP_MINUTES = 30`).

Reglas que impone el backend y que la UI debe respetar:

- `from` y `to` son **obligatorios** (`YYYY-MM-DD`) y `from <= to`.
- El rango no puede superar `service_details.max_horizon_days` (por defecto 30)
  o responde `BeyondHorizon`. → El calendario pagina por meses; no pide un año de
  golpe.
- Días sin hueco: `slots.length === 0`, con `reason` informativo para el tooltip.
- `timezone` viene en la respuesta: es la de la cuenta (`America/Lima`).
- Los huecos demasiado próximos ya los excluye el backend (`min_notice_hours`).

Sustituye el uso actual implícito de «elegir día» dentro del asistente para el
primer paso, pero **no elimina el asistente**: la ficha gana el calendario y el
paso 1 queda precargado. El paso 3 (dirección) sigue siendo obligatorio porque la
reserva exige distrito cubierto.

El calendario se consulta **solo en el detalle de un servicio**, así que no hay
N+1 (observación del dueño). Por eso §5.3 queda fuera.

### 5.2 Agenda del proveedor: una sola «Agenda de la empresa»

**Decisión (2026-10-10):** la UI expone **una única «Agenda de la empresa»**,
respaldada por el recurso `Principal`. El concepto de varios recursos se
introduce cuando la empresa incorpore cuadrillas o personal; el backend ya lo
soporta (`ProviderResource` + agenda por recurso) y no hay que cambiarlo.

En `/provider/schedule` (y en el paso 2 del asistente), un mes donde se pueda:

- pintar el **patrón semanal** (ya existe como `AvailabilityRule`, día 0 = lunes);
- **bloquear días** concretos → `AvailabilityException` con
  `kind = unavailable`; y reforzar con `extra_available`.

Se guarda con el `PUT` que ya existe (`replaceResourceSchedule`).

**Riesgo conocido:** el `PUT` es un **reemplazo completo** — borra todas las
reglas y excepciones del recurso y las recrea
(`verticals/cleaning/providers/views.py:263-272`). Para esta primera entrega se
asume el reemplazo completo, con el estado cargado en pantalla y el botón de
guardado bloqueado mientras hay una petición en vuelo (observación del dueño).
El endpoint incremental del §7 se difiere hasta que haya edición frecuente o
varios administradores.

### 5.3 Señal en la tarjeta del anuncio — descartado

«Próximos días con huecos» en cada tarjeta del catálogo implicaría una petición
de disponibilidad por anuncio. **No se hace**: el calendario vive en el detalle.

## 6. Nivel 3 — fuera de alcance

Precios por fecha o temporada, reserva instantánea configurable por día,
vista de ocupación multi-recurso, sincronización iCal con calendarios externos.
El modelo actual es *ventana semanal recurrente + excepciones*, que cubre bien
el caso de una empresa de limpieza, pero no esos escenarios.

## 7. Cambios de backend

- **Entrega A y B: ninguno.**
- **Entrega C — solicitud de verificación** (decisión 4):

  ```text
  POST /api/cleaning/providers/{pk}/request-verification/
  ```

  Permiso: `owner`/`admin` de la cuenta (`can_manage_provider`). El modelo tiene
  **cuatro** estados (`pending`, `verified`, `rejected`, `suspended`; **no existe
  `unverified`**), y la respuesta depende del actual:

  | Estado actual | Respuesta del endpoint |
  |---|---|
  | `rejected` | pasa a `pending`: el proveedor vuelve a solicitar revisión |
  | `pending` o `verified` | 200 idempotente, sin cambio |
  | `suspended` | 403: solo un administrador puede reactivar la cuenta |

  El administrador sigue aprobando a mano desde `/admin/`. Mientras esté
  `pending`, el panel muestra: **«Puedes preparar servicios y agenda; aún no
  recibirás reservas»**.

- **Entrega E — imposición en servidor de la regla de negocio** (observación del
  dueño): hoy un `can_publish` puede seguir creando un anuncio genérico con
  `POST /api/listings/`, porque el selector es solo frontend. En esta entrega,
  `CanPublishListing` (o el `perform_create` del `ListingViewSet`) debe rechazar
  la creación de un `Listing` sin `ServiceDetails` cuando el autor es
  `owner`/`admin` de una cuenta de una vertical activa. Contrato propuesto:
  403 con `{'detail': 'provider_must_create_service'}` y el `account` afectado.
  Requiere pruebas de rol nuevas y una decisión sobre qué hacer con los anuncios
  genéricos ya existentes de proveedores (migración de datos o gran
  parentesco: se recomienda **no** tocarlos y solo bloquear los nuevos).

- **Diferido:** endpoint incremental de excepciones
  (`POST/DELETE .../resources/{rid}/exceptions/`) para evitar el reemplazo
  completo de la agenda. No se implementa ahora.

Nota de coherencia (P2): `POST /api/listings/{id}/submit-review/` ya responde
400 con «Solo los servicios de limpieza se moderan» cuando el anuncio no tiene
`ServiceDetails` (`marketplace/listings/views.py:126-143`). Ese comportamiento
es correcto y no se toca.

## 8. Plan de pruebas

**Backend.** Ya existe cobertura amplia de disponibilidad y reservas
(`verticals/cleaning/availability/tests/`, `bookings/tests/`). Si se añade el
endpoint de la Entrega C: pruebas de owner 200, `staff` 403, idempotencia y
transición desde `rejected`. Si se añade la Entrega E: cliente 201,
proveedor de limpieza 403, `is_staff` de plataforma 201, vertical apagada 201.

**Frontend.** No hay tests automatizados en el proyecto; la verificación es
`tsc -b && vite build` más recorrido manual. Casos E2E a comprobar:

1. Un `can_publish` de limpieza ve «+ Crear servicio» y **no** «Publicar anuncio».
2. `/listings/new` por URL directa reconduce al asistente.
3. El paso 1 exige duración válida (1–720).
4. El paso 3 está bloqueado sin regla de agenda, sin zona de cobertura o con
   cuenta rechazada, y explica cuál falta.
5. Con las cuatro condiciones, «Enviar a revisión» deja el anuncio en
   `pending_review` y visible en `/my-listings`.
6. `admin` lo aprueba desde `/admin/` → `active`.
7. La ficha del anuncio muestra el calendario con días y huecos reales.
8. Un día sin huecos sale deshabilitado y con motivo.
9. Pedir más allá del horizonte no rompe la UI (debe limitar el rango).
10. `cliente1` reserva un día con huecos y el distrito cubierto.
11. Con la cuenta `pending`, la reserva falla con `ProviderNotVerified` y la UI
    lo explica.
12. Con el distrito fuera de cobertura, falla con `OutsideServiceArea` y la UI
    lo explica.
13. Editar un servicio `active` avisa de que vuelve a `draft` y a revisión.
14. `CLEANING_VERTICAL_ENABLED=False` deja el paquete base intacto (ADR-10).

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El `PUT` de agenda reemplaza todo y puede pisar cambios de otra sesión | Estado completo en pantalla + guardado bloqueado; endpoint incremental diferido (§7) |
| `verification_status` y `service_areas` bloquean la reserva **sin avisar** | Las 4 validaciones de §4.1 en el asistente + chequeo de pasos pendientes en el panel |
| El selector frontend no impide el alta genérica por API | Entrega E: validación en `CanPublishListing` |
| Reescribir un servicio `active` lo devuelve a `draft` (`services/serializers.py:111-116`) | Aviso explícito antes de guardar, con el texto de que requiere nueva aprobación |
| El calendario pide un rango mayor al horizonte | Limitar en el componente al `max_horizon_days` del servicio |
| Recurso sin `timezone` | Ya resuelto: `effective_timezone` cae a la de la cuenta (ADR-07) |
| Duplicar la lógica del formulario de servicio | Componente compartido `ServiceFormFields` (Entrega A) |
| Anuncios genéricos de proveedores ya existentes | No migrarlos automáticamente; bloquear solo los nuevos (Entrega E) |

## 10. Orden de implementación

1. **Entrega A — `ServiceFormFields` compartido.**
   Refactor sin cambio visible. Verificable con `npm run build` y un recorrido
   por `/provider/services` y `/provider/schedule`.
2. **Entrega B — «+ Crear servicio» y asistente de 3 pasos** con las 4
   validaciones de §4.1. **Es la entrega que resuelve el problema reportado.**
3. **Entrega C — verificación y avisos:** botón «Solicitar verificación»
   (backend del §7), banner «Puedes preparar servicios y agenda; aún no
   recibirás reservas» y avisos al dueño en la ficha y en «Mis anuncios».
4. **Entrega D — calendario mensual** del cliente (franjas de 30 min) y agenda
   visual del proveedor con bloqueo de días.
5. **Entrega E — imposición en backend** de «proveedor de limpieza publica
   servicios», con pruebas de rol.
6. **Diferido** — endpoint incremental de excepciones.

Cada entrega es verificable sola: `manage.py check`, suite de backend (si toca
backend), `npm run build`, y comprobación de que nginx sirve el hash nuevo desde
`frontend/dist`. **El frontend no requiere reiniciar el servicio**; sí lo
requiere cualquier cambio de `.env.production`.

## 11. Decisiones tomadas (2026-10-10)

| # | Pregunta | Decisión |
|---|---|---|
| 1 | ¿Mantener anuncios simples para proveedores de limpieza? | **No.** «+ Publicar anuncio» → «+ Crear servicio». El anuncio simple subsiste solo para futuras verticales o administradores, nunca en el flujo de una empresa de limpieza. |
| 2 | ¿Agenda por recurso o «por empresa»? | **Una sola «Agenda de la empresa»**, respaldada por el recurso `Principal`. Multi-recurso cuando haya cuadrillas o personal. |
| 3 | ¿Selector de fecha/hora o rejilla? | **Calendario mensual + franjas de 30 minutos.** |
| 4 | ¿Verificación manual o solicitud desde el panel? | **Botón «Solicitar verificación»** en el panel; la aprobación sigue siendo manual por administrador. Mientras esté `pending`: «Puedes preparar servicios y agenda; aún no recibirás reservas». |

Observaciones incorporadas: validaciones obligatorias antes de enviar a revisión
(§4.1), reemplazo completo del `PUT` asumido en la primera entrega (§5.2),
calendario fuera de las tarjetas del catálogo (§5.3) y validación en backend
diferida a la Entrega E (§7).

## 12. Estado de implementación (2026-10-10)

**Entregas A y B: implementadas y publicadas.**

### Qué se hizo

| Entrega | Archivos | Estado |
|---|---|---|
| A | `frontend/src/components/provider/ServiceFormFields.tsx` (nuevo); `ProviderServicesPage.tsx` de 637 → 240 líneas | build verde |
| B | `pages/provider/CreateServiceWizardPage.tsx` (nuevo), `components/provider/CompanyAgendaEditor.tsx` (nuevo), `api/cleaning.ts` (+`serviceAreas`, `createServiceArea`, `deleteServiceArea`), `App.tsx` (ruta `/provider/services/new`), `Header.tsx` («+ Crear servicio»), `CreateListingPage.tsx` (reconducción), `ProviderServicesPage.tsx` (el alta embebida se elimina) | build verde |

### Verificación

- `tsc -b` y `npm run build`: exit 0.
- Bundle servido por nginx: `index-BPCN-svf.js` + `index-BJPa5p8f.css`; chunk del
  asistente `CreateServiceWizardPage-DKlEUCDl.js`.
- `/provider/services/new`, `/provider/services`, `/listings/new` y
  `/api/listings/`: 200. `https://mastercleanconnect.ciem.pe/`: 200.
- `ProviderServicesPage` bajó de 11,84 kB a 4,79 kB al desaparecer el alta
  embebida.

### Desviaciones respecto al plan, con motivo

1. **El alta de anuncio no se conserva para el staff de plataforma en la UI.**
   El serializer de usuario (`marketplace/users/serializers.py`) **no expone
   `is_staff`**, así que el frontend no puede distinguirlo: la reconducción
   aplica a todo `can_publish`. El staff conserva el alta por el admin de
   Django. Habilitarlo en la UI exige añadir `is_staff` al serializer
   (Entrega E).
2. **Las zonas de cobertura no tenían cliente API ni UI.** El endpoint existía
   (`providers/{pk}/service-areas/`) pero el frontend no lo consumía: se
   añadieron tres métodos en `api/cleaning.ts` y un formulario (ciudad +
   distrito) en el paso 2 del asistente. `deleteServiceArea` está implementado
   en el cliente pero **sin botón** todavía.
3. **La agenda del asistente usa `CompanyAgendaEditor` (nuevo)** en lugar de
   extraer `ResourceScheduleEditor` de `/provider/schedule`. Ese editor son 372
   líneas con excepciones; extraerlo a mitad de la Entrega B añadía riesgo al
   camino crítico. El nuevo editor cubre el patrón semanal, **conserva las
   excepciones existentes** al guardar (el `PUT` reemplaza todo) y trae dos
   presets. La unificación con la agenda visual queda para la Entrega D.
4. **Las cuatro validaciones son bloqueo duro**, verificación incluida: las
   cuentas nacen en `pending` (valor por defecto del modelo), así que no hay
   callejón sin salida mientras no exista el botón «Solicitar verificación» de
   la Entrega C.

### Lo que aún no se ve

El botón «Reservar» aparecerá en el anuncio en cuanto un administrador apruebe
el servicio, porque entonces existen `ServiceDetails` y `Listing` en `active`.
El **calendario en la ficha del anuncio es la Entrega D**: hoy sigue dentro del
asistente de reserva (`/cleaning/book/{id}`).

## Anexo A — Contratos verificados que el plan reutiliza

| Endpoint | Método | Permiso | Notas |
|---|---|---|---|
| `/api/cleaning/services/` | POST | Autenticado + `can_manage_provider` | Crea `Listing` en `draft` + `ServiceDetails` |
| `/api/cleaning/services/{listing_id}/` | PATCH | Autenticado + `can_manage_provider` | Editar un servicio `active`/`rejected` lo devuelve a `draft` |
| `/api/cleaning/providers/{pk}/availability/` | GET | **AllowAny** | Exige `service`, `from`, `to`; opcional `resource`; `BeyondHorizon` si el rango excede el horizonte |
| `/api/cleaning/providers/{pk}/resources/{rid}/schedule/` | GET/PUT | Autenticado + `can_manage_resource` | El `PUT` **reemplaza** reglas y excepciones |
| `/api/cleaning/providers/{pk}/services/` | GET | AllowAny | Solo `active` (catálogo público) |
| `/api/cleaning/providers/{pk}/services/manage/` | GET | `owner`/`admin` | Incluye borradores, pendientes y rechazados |
| `/api/cleaning/providers/{pk}/service-areas/` | GET/POST | Autenticado | Zonas de cobertura; sin ninguna, la reserva falla |
| `/api/listings/{id}/submit-review/` | POST | Autor del anuncio o `is_staff` | 400 si el anuncio no es de la vertical |
| `/admin/` → acción «Aprobar servicios seleccionados» | — | `is_staff` | `pending_review` → `active`, con auditoría |

Parámetros del sistema: `BOOKING_SLOT_STEP_MINUTES = 30`,
`BOOKING_HOLD_TTL_MINUTES = 15`.

## Anexo B — Estado de la base el 2026-10-10 (origen del informe)

```text
usuarios                 4   (admin, test1, EMPRESA1, cliente1)
provider_accounts        1   (id 5, owner EMPRESA1, verification_status=pending)
memberships              1   (EMPRESA1 → cuenta 5, rol owner)
listings                 2   (id 1 «tedt» de test1; id 3 «lavado de colchones» de EMPRESA1, active)
service_details          0   ← sin esto no hay botón «Reservar»
resources                1   («Principal», tz nula → America/Lima)
availability_rules       0   ← sin esto no hay fechas en el calendario
service_areas            0   ← sin esto la reserva falla con OutsideServiceArea
bookings                 0
```

Categorías válidas para un servicio (raíz `limpieza`): `limpieza-profunda`,
`limpieza-regular`, `post-construccion`, `oficinas`, `vidrios`, `tapiceria`.
