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
