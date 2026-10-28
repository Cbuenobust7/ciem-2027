# Roadmap — MasterClean Connect

**Documento interno del tenant.** No forma parte de la documentación para
compradores ni del paquete distribuible.

**Última actualización:** 2026-10-11  
**Estado general:** tenant operativo; producto Booking Starter todavía en
productización.

## Propósito y fuentes de verdad

Este documento ordena prioridades y dependencias. No sustituye los documentos
especializados:

- El [Productization Gate](PRODUCTIZATION_GATE.md) decide si el producto puede
  distribuirse.
- El [plan técnico de limpieza](CLEANING_VERTICAL_TECHNICAL_PLAN.md) define la
  arquitectura y los criterios de aceptación de la vertical.
- El [plan de publicación UX](SERVICE_PUBLISHING_UX_PLAN.md) define la
  experiencia de publicación, agenda y disponibilidad.
- [HANDOFF.md](../HANDOFF.md) conserva el historial técnico y operativo de lo
  ejecutado.
- [Release Notes](RELEASE_NOTES.md) registra las versiones publicadas.

## Situación actual

| Frente | Estado | Siguiente resultado |
|---|---|---|
| Tenant MasterClean Connect | Operativo en HTTPS | Mantener estabilidad y completar los flujos pendientes de proveedor |
| Vertical de limpieza — Fase 2 | Implementada y probada | Pase manual de aceptación y ajustes que resulten de esa revisión |
| Internacionalización | Interfaz pública y primera tanda del panel proveedor traducidas | Completar los textos restantes del área proveedor y verificar ambos idiomas |
| Publicación y disponibilidad | Flujo base implementado | Completar la experiencia prevista de agenda y calendario según el plan UX |
| Paquete saneado | Separado del tenant; scripts de entorno incorporados | Asignar remoto y usarlo como única fuente de entrega |
| Productization Gate | `OPEN` | Cerrar aislamiento, auditoría, scope y documentación de producto |

## Ahora

### 1. Completar internacionalización del proveedor

- Traducir los textos restantes de asistentes de servicios y reservas, agenda,
  panel de reservas y formularios de servicio.
- Probar los recorridos de cliente y proveedor en español e inglés.
- Mantener las claves y textos de dominio centralizados en
  `frontend/src/i18n/`.

**Terminado cuando:** los flujos principales de proveedor no muestran textos
hardcodeados en el idioma contrario al seleccionado.

### 2. Pase manual de aceptación de la Fase 2

- Ejecutar los recorridos descritos en el Apéndice C del plan técnico.
- Verificar alta de proveedor, publicación, moderación, disponibilidad, reserva,
  cancelación y separación de datos entre cuentas.
- Registrar hallazgos y decisiones en el documento técnico o en `HANDOFF.md`.

**Terminado cuando:** el MVP de limpieza tenga aceptación manual documentada,
además de las pruebas automatizadas existentes.

### 3. Publicación y agenda

- Cerrar los elementos visibles que continúan pendientes en el plan UX:
  calendario de cliente, agenda unificada de proveedor y validaciones previas a
  enviar un servicio a revisión.
- Conservar fuera de alcance los elementos definidos en el nivel 3 hasta una
  decisión explícita.

**Fuente:** [Plan de publicación UX](SERVICE_PUBLISHING_UX_PLAN.md).

## Siguiente

### 4. Operación del tenant

- Decidir si MasterClean venderá Zona Premium.
- Si aplica, definir la oferta, condiciones operativas y, solo entonces,
  credenciales y pruebas de pago propias.
- Mantener los runbooks, soporte y notas de versión alineados con el entorno
  desplegado.

### 5. Producto distribuible

- Asignar un remoto al paquete saneado
  `ciem-marketplace-starter-release`.
- Entregar a compradores únicamente desde ese paquete, nunca desde el repositorio
  del tenant ni desde el historial de `booking-starter`.
- Resolver los documentos internos que todavía viven en el repositorio de
  producto antes de su distribución.

## Bloqueantes para cerrar el Productization Gate

Estos puntos pertenecen al producto y al host; no impiden la operación actual
del tenant, pero sí la certificación de Booking Starter como paquete vendible.

1. Asignar roles y credenciales PostgreSQL independientes a tenant, producto
   prod y producto dev.
2. Cortar el acceso cruzado a secretos en el host compartido.
3. Aprobar y versionar el Scope v1.0.
4. Crear y ejecutar la auditoría de paquete; documentar sus hallazgos.
5. Completar la documentación de comprador y sanear referencias operativas.
6. Publicar el remoto del paquete saneado y verificar su entrega reproducible.

El detalle, evidencia y criterio binario de cada punto están en el
[Productization Gate](PRODUCTIZATION_GATE.md).

## Después del MVP

| Horizonte | Resultado esperado |
|---|---|
| Fase 3 | Operación y confianza: notificaciones, políticas de cancelación, `no_show` y uso justificado de Redis |
| Fase 4 | Dinero real: depósitos, pagos, webhooks y liquidación |
| Fase 5 | SaaS: organizaciones, suscripciones y capacidades multiempresa |

No se inicia una fase posterior sin una decisión de producto y un criterio de
aceptación documentado.
