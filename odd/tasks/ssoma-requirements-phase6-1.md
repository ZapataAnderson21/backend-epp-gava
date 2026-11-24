# Fase 6.1 — Requerimientos SSOMA integrales

## Objetivo

Completar el ciclo de creación, detalle, planificación de trabajadores,
incorporaciones posteriores, correo versionado y seguimiento de Requerimientos
SSOMA, preservando el flujo transaccional de Ropa de Trabajo de Fase 6.

## Alcance autorizado

- Formulario único para `projectStart` y `duringExecution`.
- Persistencia transaccional de líneas y trabajadores previstos.
- Incorporaciones auditadas sin sobrescribir la solicitud original.
- Registro inmutable de cada intento de correo, sin envíos reales en pruebas.
- Administración de tallas desde el catálogo autorizado.
- Detalle agrupado por familia y seguimiento de despachos existentes.

## Restricciones

- Sin worktrees, clones, cambios de rama, reset, clean, commits ni push.
- Sin aplicar migraciones, `db push` o acceso a `requestsgava`.
- Sin movimientos de inventario por crear, complementar, enviar o consultar un requerimiento.
- Sin reinterpretar registros históricos.

## Tareas

- [x] **BE-P61-01 — Auditar contratos actuales y diseñar extensión aditiva**
- [x] **BE-P61-02 — Crear migración y modelos de incorporaciones/correos**
- [x] **BE-P61-03 — Implementar creación SSOMA transaccional e idempotente**
- [x] **BE-P61-04 — Ampliar detalle, trabajadores previstos y seguimiento**
- [x] **BE-P61-05 — Implementar incorporaciones posteriores auditadas**
- [x] **BE-P61-06 — Implementar tallas autorizadas e historial protegido**
- [x] **BE-P61-07 — Implementar correo HTML versionado y PDF compatible**
- [x] **BE-P61-08 — Pruebas, build, lint y auditoría final**

## Criterios de aceptación

- El alta completa se confirma o revierte como una sola transacción.
- Los trabajadores previstos solo se asocian a Ropa de Trabajo.
- Las incorporaciones conservan autor, fecha, origen y cantidades independientes.
- Los correos guardan una representación inmutable y un resultado verificable.
- Ninguna operación de requerimiento modifica stock o custodia.

## Estrategia

- Ruta directa: la política del runtime prohíbe subagentes sin solicitud explícita.
- Entrega `exception-ok`: el usuario prohíbe commits.
- Pronóstico: 1,200–1,800 líneas autoradas por el ciclo backend completo.

## Verificación prevista

- Prisma format/validate/generate sin aplicar migraciones.
- Jest focalizado y regresiones de Fase 6.
- Build NestJS, ESLint focalizado y `git diff --check`.

## Evidencia observada

- `npx prisma validate`: correcto.
- `npm run build`: correcto.
- Jest focalizado: 5 suites y 51 pruebas correctas; comprobación final de correo y creación SSOMA: 2 suites y 21 pruebas correctas.
- ESLint focalizado: correcto.
- `git diff --check` de fuentes autoradas, excluyendo el cliente Prisma generado: correcto.
- No se ejecutó PostgreSQL aislado ni se aplicó la migración.
- No se enviaron correos reales.

## Estado

Implementación y validaciones estáticas completadas. La migración queda creada y
sin aplicar; su ejecución en PostgreSQL aislado y posteriormente en el entorno
real requiere el procedimiento de despliegue autorizado, incluyendo la
dependencia conocida `prisma/sql/20260427_inventory_schema_sync.sql` cuando el
entorno todavía no tenga esas estructuras.
