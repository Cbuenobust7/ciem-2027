# Catálogo digital CIEM

18 fichas: 4 templates HTML, 3 plugins WordPress propios, 3 componentes HTML y 8 propuestas por encargo (5 plataformas, 2 soluciones de comercio y 1 desarrollo desde cero).

Los 10 recursos descargables básicos son gratuitos y tienen licencia MIT. Se generaron archivos ZIP originales con instrucciones. Los plugins pasaron `php -l`; no se ha verificado integración real en WordPress, compatibilidad universal ni versiones específicas.

Las plataformas por encargo no se presentan como software terminado y no tienen archivos de descarga ni precios inventados. Las consultas llevan a WhatsApp con el nombre del producto; también existe una llamada permanente a desarrollo a medida en portada.

- `build_catalog.py`: genera archivos, vistas ilustrativas y `catalog.json`.
- `seed_catalog.py`: añade las nuevas categorías y fichas a la base utilizada por CreatorHub en producción. No modifica registros antiguos; es idempotente por propietario y título.
- `frontend/src/data/ciemCatalog.ts`: metadatos que habilitan las descargas, vistas previas y CTA en las fichas.

Con aprobación explícita del propietario, se pausaron los anuncios antiguos 1, 4, 5, 9 y 10 y se desactivaron las categorías antiguas 1 a 6. No se eliminaron registros. Los estados previos están respaldados en catalog-tools/backups/.

Compilar en una carpeta nueva evita los archivos de `dist/ciem-chat` que fueron instalados como root:

```sh
cd /home/carlos/marketplace-ciem/frontend
npx tsc -b && npx vite build --outDir dist-next
```

Publicar conservando `dist` anterior como respaldo. Nunca borrar el catálogo antiguo de la base para cambiar la temática; si se aprueba, pausar anuncios concretos y desactivar categorías concretas con respaldo previo.

## Demos interactivas

`frontend/public/demos/` contiene CRM, inventario y reservas. Son demostraciones con datos ficticios y almacenamiento local en el navegador, sin API, autenticación, operaciones reales ni sincronización. Todas incluyen restablecer datos y cotización de adaptación por WhatsApp. El motor valida importes, SKU únicos, existencias y horarios de reserva.

Pruebas: `node --test catalog-tools/test_demos.mjs`. También se verificó en Chrome el flujo de creación, búsqueda, avance, guardado y reinicio de CRM. La compilación TypeScript y Vite pasó. Los módulos públicos usan extensión .js para el MIME de Nginx.

## Catálogo exclusivo de CIEM

En los dos backends se habilitó `CIEM_CATALOG_ONLY=True` y `CIEM_CATALOG_OWNER=ciem-admin` en sus configuraciones de producción. Los clientes pueden consultar y usar favoritos, pero las operaciones sobre anuncios e imágenes exigen administrador. Los productos creados desde la API se asignan a la cuenta oficial; la lectura pública se limita a ese propietario y lo muestra como CIEM.

El frontend usa el atributo de solo lectura `is_ciem_manager` para habilitar la administración. Se retiraron invitaciones de venta, alta y paneles de proveedores; sus rutas redirigen al catálogo. La vertical de proveedores no se monta en el backend aislado mientras el modo exclusivo esté activo.

Pruebas de permisos: `tests/test_ciem_catalog_exclusive.py` en el backend CreatorHub. Se verificaron 7 casos sin modificar datos reales. La compilación TypeScript y Vite pasó.

## Marketplace Starter comercial

Añadido el producto Marketplace Starter — Django y React, con demo en https://demo.ciem.pe/ y compra en https://www.codester.com/items/72042/marketplace-starter-django-and-react. Metadatos permanentes en commercial_products.json; el generador los incorpora sin convertirlos en descarga gratuita. El precio y los términos se consultan en Codester. La personalización se cotiza por separado.

## Booking Starter Kit

Réplica estática del flujo de MasterClean Connect adaptada a reservas de citas, publicada en /booking-starter-kit/. Incluye seis servicios de ejemplo, tres profesionales, selección de día y horario, datos, confirmación, Mis citas y panel de agenda. Los cambios son locales al navegador. No depende del backend de MasterClean ni realiza cobros o envíos.

Sus fuentes están en frontend/public/booking-starter-kit y su ficha se conserva en additional_products.json, incorporado por el generador del catálogo. La personalización se ofrece por encargo, sin presentar la demo como plataforma productiva terminada.

Pruebas: node --test catalog-tools/test_booking_starter.mjs. Se verificó en Chrome el recorrido completo, errores de correo, guardado, cancelación y restablecimiento, y se revisaron capturas de portada y asistente.

## Creator Platform Starter Kit

Demo estática en /creator-platform-starter-kit/, inspirada en Fanely y los documentos de productización de CreatorHub. Cuatro perfiles ficticios, publicaciones públicas y por membresía, seguimiento, reacciones, guardados, selección/cancelación de niveles y Creator Studio con borradores, publicación y archivo. Datos e importes de ejemplo, sin autenticación ni protección de archivos o pagos reales.

Alcance y fuentes revisadas: creator-platform-scope.md. La ficha se conserva en additional_products.json y se ofrece por encargo, sin ampliar los compromisos de Marketplace Starter v1.0. Pruebas: node --test catalog-tools/test_creator_platform.mjs. También se verificó el recorrido de fan y creador en Chrome y se revisaron capturas de portada, perfil y pantalla estrecha.

## ERP Starter Kit

Demo estática en /erp-starter-kit/ para un pequeño negocio ficticio. Ventas conecta cotización, pedido, venta, salida de stock y cuenta por cobrar. Compras conecta solicitud, recepción, entrada de stock y cuenta por pagar. Incluye contactos, productos y servicios, ajustes con motivo, vencimientos, abonos parciales y reportes CSV por período.

Se calculan importes en céntimos y se evitan stock negativo, duplicados de conversión/recepción y abonos superiores al saldo. La exportación CSV neutraliza texto interpretable como fórmula. Datos guardados solo en localStorage; sin usuarios reales, bancos, pagos, impuestos, planillas o facturación electrónica. Documentos internos de ejemplo.

Fuentes: frontend/public/erp-starter-kit. Alcance: erp-starter-scope.md. Pruebas: node --test catalog-tools/test_erp_starter.mjs (9 casos). Verificado en Chrome el recorrido comercial, recepción de compras, abonos, ajustes, contactos, reportes y reinicio. La ficha se conserva en additional_products.json como propuesta por encargo.

## LMS Starter Kit

Demo estática en /lms-starter-kit/ con tres cursos, nueve lecciones de texto y cuestionarios. Inscripción, navegación secuencial, progreso, resultados, reintentos y logro de demostración sin validez académica. El panel instructor crea borradores y publica lecciones; el progreso se recalcula y la evaluación se invalida al cambiar el contenido publicado.

Datos locales en localStorage; sin usuarios, pagos, video, SCORM, acreditaciones o control de acceso reales. Fuente: frontend/public/lms-starter-kit. Alcance: lms-starter-scope.md. Pruebas: node --test catalog-tools/test_lms_starter.mjs (7 casos), más recorrido de alumno e instructor en Chrome y revisión visual de escritorio, aula y pantalla estrecha. Ficha en additional_products.json, por encargo.

## Magazine Starter Kit

Revista estática en /magazine-starter-kit/. Edición ficticia MARGEN con seis artículos originales, autores ficticios e ilustraciones SVG propias. Incluye portada destacada, categorías, búsqueda, lector, guardados, marcado de lectura, enlace compartible, impresión y panel editorial para crear, editar, publicar, archivar y destacar historias.

Newsletter simulada sin envío ni almacenamiento de direcciones. Datos locales con la clave ciem-magazine-starter-v1, sin CMS privado, cuentas, uploads o paywall. Alcance: magazine-starter-scope.md. Pruebas: node --test catalog-tools/test_magazine_starter.mjs (6 casos), más recorrido editorial y de lectura completo en Chrome y revisión visual de portada, lector y pantalla estrecha. Ficha en additional_products.json, por encargo.

### Revista: fotografías de archivo
Se sustituyeron las seis ilustraciones por fotografías Pexels locales optimizadas en WebP. Créditos visibles en el lector y en /magazine-starter-kit/creditos.html; fuentes en photo-sources.json. Autores y artículos siguen siendo ficticios. TypeScript/Vite y comprobación de carga de siete imágenes en Chrome correctos.

### Ticketing Starter Kit · PULSO
Demo publicada en /ticketing-starter-kit/: seis eventos ficticios, categorías/búsqueda, entradas generales/preferenciales, selección hasta seis, importes en céntimos y cargo de servicio demo, compra sin pago, pases por código, anulación antes del acceso y devolución al inventario local. Panel público simulado para pausar ventas y registrar accesos únicos. Datos locales y fotografías de archivo Pexels con créditos. Sin pagos, cuentas, QR real, cámara ni validación productiva. Siete pruebas de lógica, recorrido completo en Chrome, revisión visual de escritorio/móvil/detalle y TypeScript/Vite correctos. Fuentes y alcance: ticketing-starter-scope.md.

### CIEM Gov — Gobierno Digital
Demo en /ciem-gov/: seis servicios, fichas con orientación y requisitos ficticios, registro de solicitudes, código de seguimiento, historial, subsanación y gestión simulada. Atención ciudadana con agenda local de cuatro turnos; anulación libera turno. Transparencia con seis documentos, filtros, impresión y CSV de cuatro partidas presupuestales ficticias. Controles de texto y contraste, foco visible, salto al contenido y movimiento reducido; sin certificación de accesibilidad. Fotografía Pexels con créditos. Sin entidad real, validez administrativa, DNI, archivos, firma, pagos ni integraciones estatales. Datos solo en navegador. Ocho pruebas de lógica y recorrido completo en Chrome correctos; revisión visual escritorio/móvil/transparencia y TypeScript/Vite correctos. Alcance: ciem-gov-scope.md.

### CIEM Participa — Gobernanza Colaborativa
Demo en /ciem-participa/: propuestas comunitarias ficticias, estados de deliberación, aportes, reconocimientos, apoyo local único, decisión colectiva simulada y acuerdos con tareas y avance local. Inspiración conceptual en gobernanza colaborativa; no hay participación, votos, moderación ni acuerdos vinculantes reales. Datos solo en navegador. Seis pruebas de lógica correctas. Alcance: ciem-participa-scope.md.
