# Band Studio Starter Kit

Demo interactiva de CIEM para una web pública de banda y un workspace musical de muestra. La banda, integrantes, shows, títulos y material son ficticios.

La página de banda presenta lanzamientos, historia, galería, agenda de ejemplo y contacto. La selección de fotos, videos y audio permite previsualizar archivos en el mismo navegador durante la sesión; no hay subida ni almacenamiento de los binarios.

El workspace permite crear canciones e ideas, añadir revisiones sucesivas de letras/arreglos/notas de producción, comparar las dos versiones más recientes, comentar una versión y marcarla como borrador, en revisión o aprobada. Las revisiones y comentarios se guardan en localStorage con la clave `ciem-band-studio-v1`.

No hay autenticación, permisos, privacidad, colaboración en tiempo real, archivos compartidos ni sincronización entre personas o dispositivos. El workspace no es privado: no ingresar material confidencial o protegido. No se prestan servicios musicales ni se publican canciones reales.

Para producción se requiere evaluar cuentas por integrante, autorización, almacenamiento de medios, historial compartido, respaldo y seguridad. Esta demo es una propuesta por encargo, no un producto multiusuario terminado.

Pruebas de lógica: `node --test catalog-tools/test_band_studio_starter.mjs`.
