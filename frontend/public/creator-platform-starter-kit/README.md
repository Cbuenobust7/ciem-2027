# Creator Platform Starter Kit

Demo estática de CIEM inspirada en Fanely. Perfiles y contenido ficticios con ilustraciones SVG originales.

## Funciones demostrables
- Cuatro perfiles, búsqueda y filtro por categoría.
- Seguimiento, feed por seguidos y guardados, reacciones.
- Contenido público y dos niveles de membresía simulada.
- Activación, cambio de nivel, cancelación y reactivación locales.
- Creator Studio para borradores, publicación y archivo de texto.
- Persistencia y restablecimiento con localStorage (ciem-creator-platform-v1).

## Límites
No hay backend, autenticación ni control de acceso real. El texto de ejemplo está en el código público. El desbloqueo es una simulación de interfaz. No hay archivos privados, pagos, renovaciones, comisiones, wallet, payouts, chat, correos ni API de Fanely. Los importes son ficticios y no se cobra nada.

## Fuentes de alcance
CreatorHub docs/FANELY_INVENTORY.md, docs/CreatorHub_Estrategia_Monetizacion_Incremental.md y docs/CreatorHub_Brief_Actualizado_Septiembre_2026_v3_7.md. No se modificaron los compromisos del producto Marketplace Starter v1.0. Esta demo es una propuesta por encargo, no un paquete full-stack listo para vender con funcionalidades financieras.

Pruebas: node --test catalog-tools/test_creator_platform.mjs. La prueba de navegador verifica perfiles, seguimiento, desbloqueo simulado, guardados, borradores, publicación, cancelación y restablecimiento.
