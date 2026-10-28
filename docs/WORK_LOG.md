# Registro de trabajo — Master Clean Connect

> **Documento interno de operación.** Fuera del índice y del ZIP de compradores
> (misma regla que `PRODUCTIZATION_GATE.md`, `ENVIRONMENTS.md` y `ROADMAP.md`).
>
> Recoge **qué se hizo, con qué evidencia y qué queda**, en el periodo que va del
> 2026-10-09 al 2026-10-11. Ordenado por áreas, no por fecha: cada sección se puede
> leer por separado.

## 1. Repositorios

La separación tenant / producto / paquete es reciente y conviene tenerla presente,
porque antes todo vivía en un único repositorio.

| Repositorio | Papel | Rama | Historia |
|---|---|---|---|
| `Cbuenobust7/mastercleanconnect` (privado) | **Tenant** desplegado en `mastercleanconnect.ciem.pe` | `main` @ `9017a34` | Propia, 16 commits |
| `Cbuenobust7/booking-starter` | **Producto** en desarrollo | `main` @ `55463fd` | 13 commits |
| `ciem-marketplace-starter-release` (local) | **Paquete saneado** para compradores | `main` @ `c9ef158` | Propia, 6 commits · **sin remoto** |

- El árbol desplegado resuelve su Git con un **archivo `.git`** que contiene
  `gitdir: /home/carlos/masterclean-connect-tenant/.git`. Funciona desde el host y a
  través de los binds, **pero falla dentro de cualquier chroot** (esa ruta no existe
  ahí) y **cualquier copia o `tar` del árbol pierde el vínculo** (ver §7).
- El `.git` del producto está apartado en `/tmp/masterclean-connect-product-git-backup-20261011`
  (coincide con GitHub, así que es recuperable clonando).
- **El historial del producto conserva el manual de identidad del cliente** (añadido en
  `8dc6b5d`, borrado en `55463fd`). Por eso la entrega a compradores sale **siempre del
  paquete saneado**, nunca de `booking-starter`.

## 2. Entornos

| Entorno | Ruta | Base de datos | Puerto | Estado |
|---|---|---|---|---|
| Tenant | `/home/carlos/masterclean-connect` | `marketplace_starter` | 8017 | **operativo**, HTTPS 200 |
| Producto dev | `/srv/chroot-devuser/home/devuser/booking-starter-dev` | `booking_starter_dev` | 8021 | **sirviendo** (gunicorn manual) |
| Producto prod | `/srv/chroot-produser/home/produser/marketplace-starter` | `booking_starter` | 8022 | instalado y verificado, sin unidad systemd |

**Instalación reproducible** (lo que faltaba para el criterio E del Gate):

- `deploy/instalar-entorno.sh <dev|prod> [APP_DIR]` — idempotente: reutiliza el `venv`,
  conserva `SECRET_KEY` y contraseña salvo que se pidan nuevos, escribe `.env` y
  `.env.production`, crea la base si se le pide, migra, recoge estáticos, comprueba y
  **limpia las variables del proceso** (la trampa que hizo que una copia apuntara a la
  base de producción).
- `deploy/verificar-entorno.sh <dev|prod> [APP_DIR]` — 10 comprobaciones con PASS/FAIL,
  incluida la de que la base no sea la del otro entorno y un smoke HTTP.
- **Evidencia: 10 PASS · 0 FAIL** en un clon limpio, con base y puerto de prueba
  (2026-10-11). Los guiones viven **también en el paquete saneado** (`c9ef158`), saneados
  —0 referencias al tenant o a `booking_starter`— y documentados en su
  `docs/DEPLOYMENT.md`.

## 3. Identidad corporativa

Fuente: `Manual_Identidad_Corporativa_Master_Clean_Connect.pdf` (v1.0, 17 páginas). El
PDF es **un activo del cliente**: vive en `~/Documentos/Manual_Identidad_MasterClean.pdf`
(104.901 bytes) y **no está versionado** en ningún repositorio.

- **Paleta (manual §06)**, integrada como tokens en `tailwind.config.js`: MASTER NAVY
  `#202A33`, MASTER CYAN `#19B6E6`, CYAN DARK `#087EA4`, PERU RED `#E21E2B`, LIGHT
  `#F2F5F7`. Nomenclatura `master.*` con la trazabilidad del manual en un comentario.
- **Tipografía Lato auto-alojada** (300/400/700, subconjunto latino, ~23 KB por peso) en
  `frontend/public/fonts/`. Se eliminó la dependencia de Google Fonts (0 referencias).
  Los pesos `font-medium` (500) y `font-semibold` (600) están remapeados a 400 y 700
  porque **Lato no tiene 500 ni 600**: antes el navegador los falsificaba.
- **Logotipo oficial** en `BrandLogo.tsx`, en línea (no `<img>`: un SVG con `<text>`
  cargado desde `<img>` no puede usar la fuente web y la composición se desarma). El
  `viewBox` recorta el lienzo vacío del original; el trazado es el del cliente.
- **Favicon** construido con el símbolo de conexión del logotipo (`favicon.svg` + PNG
  32/180/192).
- Superficies y textos alineados: fondo `#F2F5F7` (estaba tapado por un `bg-gray-50` en
  `MainLayout`), 93 textos oscuros unificados al navy de marca y alertas en PERU RED.

## 4. Internacionalización (es/en)

**Fórmula adoptada** (la misma del demo del producto): módulo propio `src/i18n/`, **sin
librerías externas**, con `LanguageProvider` + `useLanguage()` → `{ language, setLanguage, t }`,
claves **tipadas** desde el diccionario base `es`, interpolación `{{marcador}}`,
persistencia en `localStorage` (`mcc_language`) y sincronización de `<html lang>`.
Además, **detección del idioma del navegador** (un visitante peruano ve español; uno
anglófono, inglés) y `LanguageSelector` en la cabecera.

**Estado: de 197 cadenas sin traducir a 4.** Diccionario de **396 claves en cada idioma**,
con paridad verificada, usado por **42 archivos**.

| Lote | Cadenas | Contenido |
|---|---|---|
1 | ~45 | Armazón (cabecera, pie, 404, portada), filtros, tarjetas y formulario de anuncio |
2 | ~99 | Panel del proveedor: asistente de servicio, agenda de empresa, agenda de recursos, asistente de reserva |
3 | 49 | Registro y acceso: `JoinPage`, `RegisterPage`, `LoginPage`, `LoginForm`, `LoginModal` |
Escondidas | 16 | Mensajes de validación y avisos que vivían en literales dentro de funciones |
4 | 49 | Anuncios: detalle, mis anuncios, formulario, favoritos, edición, creación, subida de imágenes |
5a | 35 | Directorio y detalle de proveedor, reseñas |
5b | 28 | Pagos y visibilidad |
5c | 38 | Panel, reservas, tarjeta de servicio y resto de pagos |

**Herramientas** (commiteadas en `frontend/scripts/`, con atajos `npm run i18n:check` e
`npm run i18n:selftest`):

- `i18n-check.mjs` — puerta de aceptación: exige que toda clave usada exista, que `es` y
  `en` tengan las mismas claves, y cuenta dos categorías de pendientes (texto visible y
  cadenas en constantes). **Sale con código 1 si queda trabajo.**
- `i18n_patch.py` — ayudantes de parcheo (`add_hook` idempotente, `set_attr`, `set_text`,
  `add_dictionary_keys`, `dedupe_dictionary`) con `--selftest`.

**Tres puntos ciegos descubiertos** y su arreglo sistemático:

1. **Textos en constantes de módulo** (p. ej. `BENEFICIOS`, 8 cadenas en `JoinPage`).
2. **Arrays de opciones** (`KIND_OPTIONS`, `RATING_OPTIONS`, `ORDERING_OPTIONS` en el
   directorio): etiquetas sin acentos, invisibles para la heurística.
3. **Funciones que devuelven etiquetas** (`statusLabel(status)`), y **textos después de
   una expresión JSX** (`{pending} por confirmar`).

El arreglo en los tres casos es el mismo y ya es **regla del proyecto**: *si una constante
o función devuelve texto de interfaz, devuelve `TranslationKey`*, y así **el compilador**
impide que se cuele un texto sin traducir. Es más fiable que cualquier escáner.

**Pendiente (4 cadenas + 2 casos):** `ErrorBoundary` (es un componente de clase: `t` debe
entrar por prop desde un envoltorio funcional), `{pending} por confirmar` y
`statusLabel()`.

## 5. Gate de productización

`docs/PRODUCTIZATION_GATE.md` (estado **`OPEN`**) quedó actualizado con:

- **§1.2 Repositorios** y **§3.5 E** con la instalación reproducible verificada (10/10).
- **§7.3**: la instalación reproducible pasa a **resuelta**; los bloqueos mínimos que
  quedan son los **roles de base independientes** y el **acceso compartido a secretos**
  (ambos requieren root).
- **§7.4 Paquete saneado y entrega**: historial del producto con el manual del cliente,
  7 documentos internos versionados en el producto y el paquete saneado **sin remoto**.
- **§9 Historial** con las filas del 2026-10-11.

`docs/ENVIRONMENTS.md` incorporó la **trampa 8** (el `.git` del tenant como archivo con
ruta absoluta) y el clonado por repositorio correspondiente.

**Lo que sigue bloqueando el `PASSED`**: roles PostgreSQL por instancia (con
`REASSIGN OWNED`), corte del acceso compartido a secretos en el host, y el **Scope v1.0
sin aprobar**. Además, la entrega debe salir del paquete saneado y este no tiene remoto.

## 6. Lecciones operativas

- **ACL de aprovisionamiento**: un árbol recién creado por otro usuario (o por root) **no
  es escribible** hasta que se le concede la ACL. Añadir el usuario al grupo no sirve si
  la sesión ya está iniciada. Pasó con `booking-starter-dev` y con el paquete saneado.
- **`safe.directory`**: clonar un repositorio de otro usuario exige `git config --global
  --add safe.directory '*'` (el `-c` no se propaga al proceso hijo del clon).
- **El `.git` con `gitdir` absoluto**: git funciona desde el host y los binds, pero **no
  dentro de un chroot**, y una copia del árbol pierde el repositorio. Para replicar,
  clonar; nunca copiar.
- **No escribir el índice de git ajeno**: en el árbol del tenant, `git checkout` falla
  (`index.lock: Permission denied`) pero **`git show HEAD:archivo` funciona** porque solo
  lee objetos. Así se restauró el diccionario tras el incidente del bloque inglés.
- **`pgrep`/`pkill -f` con patrones que aparecen en tu propia línea de comandos te mata el
  shell.** Ocurrió dos veces. Filtrar por PID leído de `ss -ltnp`, o leer `/proc`
  excluyendo el propio PID.
- **`python-decouple` da prioridad al entorno del proceso sobre el `.env`**: toda
  ejecución manual debe limpiar las variables o una copia apunta a la base equivocada.
- **Fallos del parcheo que costaron errores reales** (todos detectados por el build o el
  escáner, ninguno llegó a producción):
  - `}}` de más por una f-string (26 ocurrencias de JSX roto).
  - Un regex de `actionsFor(` que tocó la definición.
  - `.replace(' {','')` deformando firmas con `}: { accountId }`.
  - Una clave con punto (`e.gHolidays`) rompiendo el objeto de traducciones.
  - Un deduplicador con **un solo conjunto de claves para los dos idiomas** que **vació el
    bloque inglés**; el build no lo detecta porque los *casts* de tipo lo ocultan y en
    inglés todo caía al español. Los dos últimos se corrigieron en `i18n_patch.py`.

## 7. Pendientes consolidados

**Requieren root (tú):**

1. Roles de base independientes por instancia + `REASSIGN OWNED` (Gate §7.1).
2. Cortar el acceso compartido a secretos en el host (Gate §7.2).
3. Unidades systemd `booking-dev.service` (8021) y `booking-prod.service` (8022).
4. Decidir el destino del `.git` del producto en `/tmp` (mover o borrar).

**Decisión de producto:**

5. **Remoto del paquete saneado** y, con él, la estrategia de entrega.
6. Destino de los 7 documentos internos que siguen versionados en el repositorio del
   producto.
7. Valores de Zona Premium de Lima (`premium_slots_count`, `price`, `is_promo_mode`).

**Internacionalización:**

8. Las 4 cadenas de `ErrorBoundary` y los dos casos de §4.
9. Convertir `statusLabel()` a claves tipadas.

**Higiene:**

10. Retirar la copia cruda de 755 M y reapuntar las líneas 17 y 19 de `fstab` (las 18 y 20
    apuntan al árbol de producción limpio y están bien).

**Resuelto el 2026-10-11:**

- **`venv` del tenant**: 21 archivos con el prefijo viejo corregidos. `pip` 26.2.1,
  `django-admin` 5.2.10, `pytest` 8.3.4 y `gunicorn` 26.2.0 vuelven a funcionar; quedan
  0 rutas rotas. No hizo falta reconstruirlo: `marketplace-starter` y
  `masterclean-connect` tienen la misma longitud y el shebang no se desborda.
- **Catálogo de producción limpio**: borrada la reserva de prueba `CL-2026-000001`
  (estaba `unpaid` y sin objetos relacionados) y los anuncios `1 · tedt` y
  `5 · [PRUEBA] Limpieza de sillones`. El catálogo queda con el servicio real
  `3 · lavado de colchones`.
