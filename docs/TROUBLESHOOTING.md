# Troubleshooting

## El frontend no es accesible desde otra máquina

Inicie Vite escuchando en todas las interfaces:

```bash
npm run dev -- --port 5190 --host 0.0.0.0
```

El parámetro `--host 0.0.0.0` permite conexiones externas al servidor. El
puerto de referencia es `5190`.

## No hay conexión a PostgreSQL o Redis

1. Ejecute `docker compose ps`.
2. Compare host, puerto, base y credenciales con `.env`.
3. Confirme que la instalación no comparte puertos o volúmenes con otro proyecto.

## Las variables frontend no cambian

Vite incorpora `VITE_*` al arrancar o compilar. Reinicie `npm run dev` o ejecute
un build nuevo.

## Error de CORS o CSRF

Revise `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, la URL del frontend y el
protocolo HTTPS. Los orígenes deben ser exactos y estar separados por comas.

## El webhook de pago no se procesa

Compruebe la URL HTTPS, el secreto HMAC del entorno, los logs del backend y que
las credenciales correspondan al mismo entorno.
