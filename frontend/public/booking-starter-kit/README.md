# Booking Starter Kit

Demo estática de CIEM inspirada en MasterClean Connect.

Incluye catálogo, filtro por categoría y texto, profesionales, asistente de reserva en cuatro pasos, disponibilidad por recurso, vistas de cliente y agenda. Las reservas se guardan en localStorage con la clave ciem-booking-starter-kit-v1. Se pueden restablecer desde el panel.

No hay backend, autenticación, pagos, correos ni operaciones reales. No solicita datos de pago. Usa datos ficticios. Horario de ejemplo: America/Lima, lunes a sábado de 09:00 a 18:00, con pausa de 13:00 a 14:00 y horizonte de 90 días.

model.js contiene disponibilidad y validación. app.js controla la interfaz. style.css reproduce la familia visual de MasterClean Connect con fuentes Lato locales. index.html es la página autónoma.

Pruebas: node --test catalog-tools/test_booking_starter.mjs desde la raíz de marketplace-ciem.
