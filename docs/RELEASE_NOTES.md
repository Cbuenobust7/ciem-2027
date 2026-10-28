# Release Notes

## Marketplace Starter v1.0

El artefacto final debe incluir únicamente código, configuración de ejemplo y
los documentos de este directorio que sean aplicables al comprador.

La especificación interna `CLEANING_VERTICAL_TECHNICAL_PLAN.md` se conserva en
el árbol fuente del proyecto, pero se excluye del ZIP para compradores. Contiene
arquitectura propuesta, trabajo futuro y brechas del producto base; no forma
parte de la entrega comercial del Starter.

Antes de distribuir:

- Incluir una licencia definitiva.
- Excluir `.env`, secretos, bases de datos, backups y archivos generados.
- Ejecutar la auditoría sobre el contenido real del artefacto.
- Verificar instalación limpia en un proyecto Compose aislado.
- Revisar que no existan referencias a otros clientes, productos o dominios.
