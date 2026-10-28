# ERP Starter Kit

Demo estática de CIEM para un pequeño negocio ficticio. Sin API, autenticación, base de datos, sincronización ni operaciones reales. Los documentos son internos de ejemplo y no incluyen impuestos ni facturación electrónica.

## Recorridos
1. Crear cotización con cliente, productos/servicios y cantidades.
2. Convertir en pedido, sin cambiar stock.
3. Registrar venta, descontar existencias y generar saldo por cobrar.
4. Registrar abonos parciales y consultar vencimientos.
5. Crear compra, recibir productos y generar saldo por pagar.
6. Registrar ajustes de stock con motivo y gestionar contactos.
7. Filtrar reportes de ventas y exportar ventas o stock a CSV.

Los importes se calculan como enteros en céntimos. No se permiten sobrepagos, ventas sin existencias, conversiones o recepciones duplicadas. Los servicios no registran movimientos de inventario. Las funciones del motor son inmutables: un error no modifica parcialmente los registros anteriores.

Datos guardados en localStorage con la clave ciem-erp-starter-v1. Restablecer demo recupera únicamente los ejemplos de este producto. No introducir datos reales.

model.js contiene reglas y validación; app.js controla la interfaz; style.css utiliza la identidad de CIEM; index.html es autónomo y usa fuentes Lato locales de /fonts/.

Pruebas: node --test catalog-tools/test_erp_starter.mjs. Se verificó en Chrome el recorrido de ventas y compras, abonos, stock, contactos, reportes y restablecimiento.
