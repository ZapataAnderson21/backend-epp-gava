# Consolidación reproducible de migraciones Prisma

## Objetivo

Permitir que una base PostgreSQL vacía reconstruya el esquema completo usando
únicamente `prisma migrate deploy`, preservando la compatibilidad con bases donde
las estructuras de inventario fueron instaladas mediante scripts manuales.

## Alcance autorizado

- Auditar las 87 migraciones y todos los scripts de `prisma/sql`.
- Incorporar las dependencias manuales mediante migraciones versionadas nuevas.
- Conservar `eq_safety` y `consumible` y todos los datos históricos.
- Clasificar y corregir únicamente el drift seguro del esquema Prisma.
- Probar la cadena completa en una base PostgreSQL local desechable.

## Restricciones

- Sin worktrees, clones, ramas nuevas, commits, push, reset ni clean.
- Sin ejecutar migraciones, limpieza o comandos destructivos sobre `requestsgava`.
- Sin `prisma db push` ni modificación de migraciones históricas.
- Sin eliminar valores enum, registros, índices o defaults sin evidencia de seguridad.

## Tareas

- [x] **MIG-01 — Inventariar migraciones, scripts y dependencias manuales**
- [x] **MIG-02 — Diseñar puente idempotente anterior a Fase 6**
- [x] **MIG-03 — Preservar enums legacy en el esquema Prisma**
- [x] **MIG-04 — Desplegar la cadena en PostgreSQL local desechable**
- [x] **MIG-05 — Analizar `prisma migrate diff` y corregir drift seguro**
- [x] **MIG-06 — Revalidar Fases 6 y 6.1, historial y restricciones**
- [x] **MIG-07 — Documentar orden, riesgos y diferencias pendientes**

## Ruta y entrega

- Ruta directa: la política activa prohíbe subagentes salvo solicitud explícita.
- Entrega `exception-ok`: el usuario prohíbe commits.
- Pronóstico: 700–1,200 líneas autoradas, dominadas por SQL idempotente y documentación.

## Verificación prevista

- `prisma format`, `prisma validate` y `prisma generate`.
- `prisma migrate deploy` sobre una base local creada específicamente para la prueba.
- Inspección de `_prisma_migrations` y de las restricciones de Fases 6/6.1.
- `prisma migrate diff` entre la base desplegada y `schema.prisma`.
- Build, pruebas focalizadas, ESLint focalizado y `git diff --check`.

## Estado

Auditoría completada. No se accedió a `requestsgava` durante la prueba.

## Evidencia observada

- La cadena oficial contiene 89 migraciones: las 87 originales y dos nuevas
  migraciones de consolidación.
- Una base PostgreSQL vacía aislada aplicó 89 de 89 migraciones mediante
  `prisma migrate deploy`; `migrate status` quedó actualizado.
- `prisma migrate diff` devolvió `-- This is an empty migration.`.
- La migración puente fue reproducida sobre una base aislada con estructuras
  manuales y Fases 6/6.1 ya presentes, sin drift posterior.
- El replay directo de la migración puente fue idempotente.
- `consumible` y `eq_safety` permanecen en PostgreSQL y en Prisma; no se ejecutó
  el script destructivo que elimina registros históricos.
- `prisma validate`, `prisma generate` y el build NestJS finalizaron con código 0.
- Jest focalizado: 4 suites y 35 pruebas aprobadas.
- ESLint focalizado de `src/element/element.service.ts`: código 0.
- Las dos bases aisladas creadas para la validación fueron eliminadas al final.

## Decisiones y diferencias

- Los nombres históricos y truncados de índices y claves foráneas se preservan
  mediante `map` en `schema.prisma`; no se renombraron objetos físicos.
- Los defaults existentes de `updatedAt` se conservaron y se declararon en el
  esquema, en vez de eliminarlos.
- El índice existente de `RequestWorker.workerId` se conserva y se declara.
- El índice ausente de `StaffPayrollProfile.workerId` se agrega mediante una
  migración oficial e idempotente.
- Los valores legacy se aceptan en el tipo generado de Prisma para conservar
  filas históricas, pero no se exponen como nuevas opciones en el DTO de
  elementos.

## Próximo paso

Validar backup y restauración en el entorno de despliegue y ejecutar primero
`prisma migrate status`; la aplicación sobre una base existente sigue siendo
una operación operativa que requiere ventana, backup y revisión humana.
