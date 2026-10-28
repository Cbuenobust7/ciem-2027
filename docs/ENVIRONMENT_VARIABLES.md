# Variables de entorno

Las variables del backend no deben contener valores de otro cliente o entorno.
Las variables `VITE_*` son públicas porque se incluyen en el navegador.

## Backend

| Variable | Tipo | Secreta | Uso |
|---|---|---:|---|
| `DJANGO_ENV` | string | No | Entorno de ejecución. |
| `SECRET_KEY` | string | Sí | Firma de Django; única por entorno. |
| `DEBUG` | bool | No | Debe ser `False` en producción. |
| `ALLOWED_HOSTS` | CSV | No | Hosts permitidos por Django. |
| `CORS_ALLOWED_ORIGINS` | CSV | No | Orígenes permitidos por CORS. |
| `BACKEND_URL` | URL | No | URL pública del backend. |
| `FRONTEND_URL` | URL | No | URL pública del frontend. |
| `DB_HOST` | string | No | Host PostgreSQL. |
| `DB_PORT` | int | No | Puerto PostgreSQL. |
| `DB_NAME` | string | No | Base lógica del entorno. |
| `DB_USER` | string | Sí | Usuario PostgreSQL. |
| `DB_PASSWORD` | string | Sí | Contraseña PostgreSQL. |
| `REDIS_HOST` | string | No | Host Redis. |
| `REDIS_PORT` | int | No | Puerto Redis. |
| `MERCADOPAGO_PRO_ACCESS_TOKEN` | string | Sí | Token de pago del entorno. |
| `MERCADOPAGO_PRO_WEBHOOK_SECRET` | string | Sí | Secreto HMAC del webhook. |

## Frontend

| Variable | Tipo | Secreta | Uso |
|---|---|---:|---|
| `VITE_API_URL` | URL | No | Base de las llamadas API. |
| `VITE_MP_BRICKS_PUBLIC_KEY` | string | No | Clave pública para el flujo Bricks, si se habilita. |

Ejemplo de desarrollo aislado:

```dotenv
DB_HOST=localhost
DB_PORT=5433
DB_NAME=marketplace_starter_dev
REDIS_HOST=localhost
REDIS_PORT=6380
```

Nunca copie tokens o secretos de un entorno a otro.
