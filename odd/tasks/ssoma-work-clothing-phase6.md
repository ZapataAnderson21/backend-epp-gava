# Fase 6 — Requerimientos SSOMA y Ropa de Trabajo

## Objetivo

Implementar el flujo seguro de requerimiento SSOMA, despacho, recepción,
custodia, entrega a trabajadores, anulaciones, devoluciones y constancia PDF,
preservando datos históricos y retirando el inventario general por proyecto de
los flujos operativos.

## Alcance autorizado

- Mantener `RequestType` legacy y añadir una clasificación SSOMA independiente.
- Usar `ElementVariant` y `OfficeInventoryEntry` para stock por prenda y talla.
- Crear entidades específicas para despacho, custodia, entrega y devolución.
- Reutilizar `InventoryMovement` para auditar entradas y salidas del almacén.
- Aplicar transacciones e idempotencia sin migrar datos históricos.
- Mantener lectura histórica de `ProjectInventoryEntry` y bloquear nuevas cargas.

## Restricciones

- Sin worktrees, clones, cambios de rama, reset, clean, commits ni push.
- Sin migraciones reales, `migrate reset`, `db push` o cambios destructivos.
- Sin inferir PDR por nombre de cargo; la autorización depende de permisos.
- Sin asignar permisos nuevos automáticamente a roles existentes.

## Tareas

- [x] **BE-P6-01 — Auditoría y contrato de datos**
- [x] **BE-P6-02 — Clasificación SSOMA y stock por talla**
- [x] **BE-P6-03 — Despachos, recepciones y custodia**
- [x] **BE-P6-04 — Entregas, anulaciones, devoluciones y PDF**
- [x] **BE-P6-05 — Retirada operativa del inventario por proyecto**
- [x] **BE-P6-06 — Pruebas y validación backend**

## Criterios de aceptación

- Los nuevos requerimientos exigen tipo SSOMA y solo admiten familias aprobadas.
- El stock central y la custodia nunca quedan negativos.
- Cada operación sensible es transaccional e idempotente.
- Los snapshots de entrega sobreviven a cambios de catálogo y trabajador.
- Los datos legacy se conservan y las migraciones son aditivas.

## Verificación prevista

- Prisma validate/generate y revisión SQL sin aplicar migraciones.
- Jest y ESLint focalizados.
- Build NestJS y diff check de archivos autorados.

## Estrategia

- Ruta directa por política activa del runtime que impide delegación.
- Entrega `exception-ok`: el usuario prohíbe commits.
- Pronóstico: 1,100–1,700 líneas autoradas, justificadas por el flujo transaccional completo.

## Progreso y evidencia

- `npx prisma validate`: correcto.
- `npm run build`: correcto; incluye `prisma generate` y compilación NestJS.
- `npx jest src/work-clothing/work-clothing-phase6.spec.ts --runInBand`: 12/12 pruebas correctas.
- Pruebas focalizadas de seguridad de requerimientos y compatibilidad de Fase 5: correctas.
- `npx eslint src/work-clothing/**/*.ts`: correcto.
- La migración fue creada y revisada como aditiva; no fue aplicada ni validada contra PostgreSQL por no existir una base aislada segura.
- El lint amplio de archivos legacy expuso ruido de formato CRLF/Prettier preexistente; no se reformatearon archivos completos para evitar un diff ajeno al alcance.
- No se creó commit por restricción expresa del usuario.

## Siguiente paso

Validar la migración en una base PostgreSQL aislada y asignar explícitamente los permisos `workClothing.*` a los roles autorizados antes del despliegue.

## Revisión final de migración — 2026-11-19

- [x] **BE-P6-R01 — Auditar correspondencia Prisma/SQL y migraciones previas**
- [x] **BE-P6-R02 — Reforzar cantidades enteras, positivas e invariantes con DTO, servicio y CHECK**
- [x] **BE-P6-R03 — Reforzar correspondencia elemento/talla y autorización de custodia**
- [x] **BE-P6-R04 — Revisar entradas centrales distribuidas, discrepancias e idempotencia**
- [x] **BE-P6-R05 — Ejecutar validaciones focalizadas y documentar preparación de despliegue**

### Ruta y límites de la revisión

- Ruta directa: la política del runtime no permite delegación sin solicitud explícita del usuario.
- Se corrigen únicamente defectos comprobados de Fase 6.
- La migración objetivo todavía no fue aplicada; no se modifican migraciones históricas.
- Sin commits por restricción expresa del usuario.

### Evidencia de la revisión

- Se detectó que la cadena versionada no crea `ElementVariant` ni
  `OfficeInventoryEntry`; la migración ahora falla de forma explícita si el
  `inventory_schema_sync` manual no está presente.
- Se agregaron validaciones enteras en DTO/servicio y `CHECK` de PostgreSQL para
  despacho, recepción, custodia, entrega y devolución.
- Se agregaron claves compuestas para garantizar la correspondencia exacta entre
  elemento, talla y entrada de almacén, con nombres `map` iguales al SQL.
- La recepción central ahora conserva `elementVariantId`; entradas distribuidas
  se preservan y cada despacho consume una entrada explícita.
- La recepción discrepante no acredita custodia. Su resolución y el alta de
  nuevas tallas siguen bloqueados por definición empresarial/operativa.
- `npx prisma validate`: correcto después de formatear el esquema.
- `npm run build`: correcto; incluye Prisma generate y NestJS.
- `npx jest src/work-clothing/work-clothing-phase6.spec.ts --runInBand`: 18/18.
- ESLint backend focalizado: correcto.
- Frontend `npm run test:ssoma-work-clothing`: 7/7; build Vite y ESLint focalizado: correctos.
- No se ejecutó una prueba PostgreSQL aislada ni se aplicó la migración.

### Decisión de despliegue

La migración no se considera lista para `requestsgava` hasta verificar de forma
solo lectura los prerrequisitos de inventario en esa base, ensayar la cadena en
una base desechable y aprobar el procedimiento de resolución de discrepancias y
configuración de nuevas tallas.
