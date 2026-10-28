# CIEM Gov — Gobierno Digital
Demo estática en /ciem-gov/. Portal institucional ficticio con seis servicios, búsqueda y temas, fichas de orientación, registro de solicitud, seguimiento y subsanación, agenda de cuatro turnos de ejemplo, seis documentos de transparencia imprimibles y descarga CSV presupuestal ficticia. Panel de gestión simulado con cambios de estado y restablecimiento.

Solicitudes: recibida → revisión → observada → subsanación → revisión → finalizada. Se puede anular una solicitud abierta; los estados finales no cambian. Citas: reserva local, sin duplicar turno activo, anulación libera turno. Sin DNI, usuarios reales, archivos, firmas, pagos, notificaciones, expedientes ni trámites administrativos reales. Todos los datos se guardan en localStorage (ciem-gov-demo-v1), visibles en un panel público de demostración. No introducir información personal. Entidad, procedimientos, documentos, presupuesto, jornadas y publicaciones ficticios; no se anuncian requisitos, tasas ni plazos legales.

Incluye enlace para saltar contenido, formularios etiquetados, navegación por teclado, foco visible, contraste alternativo, ampliación de texto y preferencia de movimiento reducido. Esto no acredita cumplimiento normativo ni certifica accesibilidad.

Fotografía: Pexels / Zachary DeBottis; creditos.html y photo-sources.json. No representa una sede pública. Sin símbolos oficiales.

Pruebas: node --test /home/carlos/marketplace-ciem/catalog-tools/test_ciem_gov.mjs. Para producción se evalúan permisos, seguridad, datos personales, integraciones, accesibilidad, contenidos y operación institucional en el alcance acordado.
