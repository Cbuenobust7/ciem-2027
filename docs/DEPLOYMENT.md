# Deployment

## Modelo de referencia

El modelo inicial es híbrido: PostgreSQL y Redis se ejecutan con Docker Compose;
Django/Gunicorn y el frontend compilado se ejecutan en el host. Puede adoptar
un despliegue full-stack posteriormente, siempre que se pruebe de forma aislada.

## Checklist previo

1. Crear un backup verificable de la base del entorno destino.
2. Confirmar commit objetivo, secretos, `DEBUG=False`, hosts y CORS.
3. Ejecutar migraciones antes de exponer cambios dependientes de esquema.
4. Compilar el frontend con sus variables públicas correctas.
5. Confirmar que los endpoints de pago y webhooks apuntan al entorno correcto.

## Procedimiento

```bash
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
cd frontend
npm ci
npm run build
```

Reinicie el servicio de aplicación mediante el gestor de procesos de su
infraestructura. Si modifica Nginx, valide primero su configuración y recárguelo
solo después de una prueba satisfactoria.

## Verificación posterior

- HTTP(S), login, API, admin, listings y estáticos.
- Logs de aplicación y de proxy.
- Salud de PostgreSQL y Redis.
- Flujo de pago controlado cuando cambie esa integración.

## Rollback

Vuelva al último commit conocido, reconstruya el frontend y restaure datos solo
desde un backup verificado y compatible con las migraciones aplicadas.
