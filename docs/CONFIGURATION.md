# Configuración

## Archivos de entorno

El backend usa `.env` para desarrollo y un archivo de entorno separado para
producción. El frontend usa `frontend/.env`.

- No versionar archivos `.env`.
- Usar secretos únicos por entorno.
- Mantener separados la base de datos, Redis y credenciales de cada entorno.
- Reiniciar el proceso backend después de cambiar variables de Django.
- Reiniciar Vite o reconstruir el frontend después de cambiar `VITE_*`.

## Valores de producción

Antes de publicar, confirmar:

- `DEBUG=False`.
- `SECRET_KEY` único y privado.
- `ALLOWED_HOSTS` y `CORS_ALLOWED_ORIGINS` explícitos.
- URLs públicas HTTPS correctas.
- Credenciales de pago propias del entorno.

La lista completa está en [Environment Variables](ENVIRONMENT_VARIABLES.md).
