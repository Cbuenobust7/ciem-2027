# Changelog

## [Unreleased] — Fase 2: directorio público

- `ProviderAccount` incorpora `participation_status` (`directory`, `claimed`,
  `partner`, `verified_partner`, `suspended`, `removed`), publicación
  (`is_published`), datos comerciales, procedencia/revisión y aceptación de
  condiciones. `owner` pasa a ser opcional para las fichas sin cuenta.
- Nuevos modelos `ProviderClaim`, `DirectoryCorrectionRequest` y
  `ProviderStatusEvent` (auditoría administrativa).
- El directorio público busca por nombre, filtra por modalidad y categoría de
  servicio, y distingue fichas informativas de proveedores asociados. Una ficha
  de directorio no puede crear servicios, zonas, recursos, agenda ni reservas.
- Endpoints nuevos: reclamación de ficha, corrección/retirada y bandejas
  administrativas (proveedores, reclamaciones, correcciones y auditoría).
- Migraciones aditivas `0002` (esquema) y `0003` (backfill del estado actual).
- Frontend: ficha informativa con contacto directo, formularios de reclamación y
  corrección, y directorio con búsqueda/modalidad; textos en español e inglés.

## [1.0.1] — Buyer documentation update

- Added a complete English Buyer Setup Guide covering environment
  configuration, PostgreSQL and Redis, backend and frontend startup, basic
  usage, production deployment, and troubleshooting.
- Updated the main README to direct buyers to the English setup guide.
- Aligned the local frontend public URL default with port 5190.

## [1.0.0] — Marketplace Starter

### Initial commercial release

- Reusable marketplace foundation with authentication, listings, categories,
  images, favorites and reviews.
- Promoted visibility flow and configurable payment integration.
- Docker Compose services for PostgreSQL and Redis.
- Buyer documentation for installation, configuration, deployment and support.

This release is intended for one end product or domain under the commercial
license included with the package.
