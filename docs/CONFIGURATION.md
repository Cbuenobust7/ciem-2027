# Configuración

## Archivos de entorno

El backend usa `.env` para desarrollo y un archivo de entorno separado para
producción. El frontend usa `frontend/.env`.

- No versionar archivos `.env`.
- Usar secretos únicos por entorno.
- Mantener separados la base de datos, Redis y credenciales de cada entorno.
- Reiniciar el proceso backend después de cambiar variables de Django.
- Reiniciar Vite o reconstruir el frontend después de cambiar `VITE_*`.

## Analítica del frontend

El frontend acepta estos identificadores públicos opcionales en `frontend/.env`:

- `VITE_GA_MEASUREMENT_ID`: ID de medición GA4 con formato `G-...`.
- `VITE_CLARITY_PROJECT_ID`: ID de 10 caracteres alfanuméricos del proyecto Clarity.

Vite incorpora estos valores al bundle; no son secretos. Si están vacíos, la
integración correspondiente no carga. El instalador conserva valores existentes
o acepta variables de entorno y valida su formato antes de compilar.

GA4 envía pageviews de rutas normalizadas y eventos estáticos de interacción,
sin valores de campos ni parámetros de URL. Clarity requiere un ID configurado,
se limita a rutas públicas seleccionadas y no se habilita en páginas de cuenta,
reservas ni detalle de anuncios. Los contenidos marcados se enmascaran.

### Eventos para campañas

Los clics que abren WhatsApp envían un único evento GA4 `whatsapp_click` con
`contact_method=whatsapp` y un `placement` fijo:

| `placement` | Ubicación |
| --- | --- |
| `header` | Contacto del encabezado, escritorio y menú móvil |
| `home_hero` | CTA principal de la portada |
| `catalog` | CTA de cotización del catálogo |
| `clients_bar` | CTA de la sección de clientes |
| `platform_banner` | CTA de la sección de plataforma |
| `listing_detail` | CTA de contacto de la ficha del producto |
| `info_contact` | CTA de contacto de páginas informativas |
| `footer` | WhatsApp del pie de página |
| `assistant_message` | Enlace de WhatsApp dentro de una respuesta del chat |

Abrir el chat interno envía `assistant_chat_open` con
`placement=floating_launcher`; no se considera conversión de WhatsApp. Ninguno
de estos eventos incluye el número, el texto del mensaje ni parámetros de URL.
`whatsapp_click` mide la apertura del enlace, no confirma que se envió un
mensaje o que se obtuvo un cliente.

Antes de una campaña, marca `whatsapp_click` como evento clave en GA4 y vincula
la propiedad con Google Ads para importar esa acción como conversión. Si se
requieren informes desglosados por ubicación, registra `placement` como una
dimensión personalizada de ámbito de evento en GA4. `assistant_chat_open` se
mantiene como evento de interacción separado y no debe importarse como la
conversión de WhatsApp.

La implementación envía eventos directamente a GA4 mediante `gtag.js`; no
requiere Google Tag Manager. No configures además en GTM otra etiqueta que
dispare `whatsapp_click` para los mismos botones, porque duplicaría la
conversión.

Para desplegar la rama de analítica en producción, ejecuta
`deploy/deploy-analytics.sh` desde un checkout limpio de `main` o
`ciem-pe-analitica-ciem`. El script compila desde el commit remoto publicado,
verifica GA4 y Clarity si está configurado, conserva un backup y hace rollback
automático si falla la publicación.

## Valores de producción

Antes de publicar, confirmar:

- `DEBUG=False`.
- `SECRET_KEY` único y privado.
- `ALLOWED_HOSTS` y `CORS_ALLOWED_ORIGINS` explícitos.
- URLs públicas HTTPS correctas.
- Credenciales de pago propias del entorno.

La lista completa está en [Environment Variables](ENVIRONMENT_VARIABLES.md).
