# MasterClean Connect

Repositorio privado del tenant **MasterClean Connect**, plataforma para conectar
clientes con proveedores de servicios de limpieza. La instancia publicada está en
[mastercleanconnect.ciem.pe](https://mastercleanconnect.ciem.pe).

## Alcance

- Directorio de proveedores y servicios de limpieza.
- Registro, autenticación y perfiles de cliente o proveedor.
- Publicación y moderación de anuncios.
- Disponibilidad, solicitudes de reserva y agenda del proveedor.
- Favoritos, reseñas y visibilidad por ciudad.
- Interfaz bilingüe español/inglés con detección del idioma del navegador.

## Arquitectura

- Backend: Django y Django REST Framework.
- Frontend: React, TypeScript, Vite y Tailwind CSS.
- Datos: PostgreSQL; Redis para servicios auxiliares.
- Producción: Gunicorn detrás de nginx, con TLS en el dominio público.

## Desarrollo local

Consulta primero [la guía de instalación](docs/INSTALL.md),
[configuración](docs/CONFIGURATION.md) y las
[variables de entorno](docs/ENVIRONMENT_VARIABLES.md). Nunca versionar archivos
`.env`, credenciales, volcados de base de datos ni datos de clientes.

Para el frontend:

```bash
cd frontend
npm ci
npm run dev
```

Para construir los estáticos:

```bash
cd frontend
npm run build
```

## Operación de producción

El tenant se ejecuta desde `/home/carlos/masterclean-connect` mediante la unidad
`mastercleanconnect.service`. Gunicorn escucha solo en `127.0.0.1:8017`; nginx
publica el dominio HTTPS.

Comprobaciones habituales:

```bash
systemctl status mastercleanconnect.service
curl -I https://mastercleanconnect.ciem.pe/
```

Antes de recompilar el frontend en producción, confirma que el árbol está limpio y
que la configuración de entorno corresponde al tenant:

```bash
git status --short
cd frontend && npm run build
```

## Repositorio y despliegue

El remoto canónico del tenant es
`git@github.com:Cbuenobust7/mastercleanconnect.git`.

Para crear otro entorno, clona este repositorio y sigue la documentación de
instalación; no copies el árbol desplegado ni sus archivos de entorno. El producto
reutilizable **Booking Starter** y el paquete de distribución saneado se mantienen
por separado de este tenant.

## Documentación

- [Instalación](docs/INSTALL.md)
- [Configuración](docs/CONFIGURATION.md)
- [Despliegue](docs/DEPLOYMENT.md)
- [Resolución de problemas](docs/TROUBLESHOOTING.md)
- [Mapa de documentación](docs/DOCUMENTATION_MAP.md)
- [Soporte](docs/SUPPORT.md)

## Seguridad

No almacenes secretos ni activos de clientes en Git. Las credenciales deben ser
propias de cada entorno y el acceso a producción debe limitarse a las personas y
servicios que lo necesitan.
