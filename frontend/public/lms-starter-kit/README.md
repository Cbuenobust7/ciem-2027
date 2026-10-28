# LMS Starter Kit

Demo estática de CIEM con catálogo de tres cursos, nueve lecciones de texto, inscripción de ejemplo, aula, avance secuencial, progreso y cuestionarios. El panel instructor permite crear borradores y publicar o retirar lecciones conservando al menos una visible. Cambiar el temario reinicia la evaluación; publicar una lección nueva actualiza el porcentaje de progreso.

Los datos se guardan en localStorage (ciem-lms-starter-v1). No hay backend, cuentas, pagos, video, SCORM ni acreditaciones reales. Las respuestas están en el código público. El logro se marca como constancia demo sin validez académica. No introducir datos reales.

model.js contiene las reglas y valida las referencias guardadas. app.js controla las vistas; style.css usa fuentes Lato locales.

Pruebas: node --test catalog-tools/test_lms_starter.mjs (7 casos). En Chrome se verificaron inscripción, lecciones, validación de respuestas, evaluación, logro, publicación de nuevo contenido, invalidación del resultado y reinicio.
