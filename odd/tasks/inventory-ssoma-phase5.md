# Fase 5 — Inventario y Recursos SSOMA

## Objetivo

Separar funcionalmente Inventario y Recursos SSOMA sobre el motor existente,
incorporar cinco familias nuevas de Inventario y preservar íntegramente los
registros, movimientos, asignaciones y relaciones históricas.

## Alcance autorizado

- Auditar modelos, reglas, permisos y dependencias actuales.
- Añadir familias persistentes inequívocas para nuevos registros de Inventario.
- Conservar los valores legacy sin reclasificación automática.
- Mantener el mismo motor de inventario, movimientos y trazabilidad.
- Crear migración aditiva y no aplicarla contra la base real.
- Agregar pruebas focalizadas y documentación de la matriz histórica.

## Restricciones

- Sin worktrees, clones, cambios de rama, reset, clean, commits ni push.
- Sin migraciones sobre la base real, `migrate reset` o `db push`.
- Sin eliminación o actualización masiva de datos históricos.
- Sin modificar manualmente el cliente Prisma generado.

## Decisión de diseño

`Element.family` sigue siendo el discriminador persistente. Se agregan valores
nuevos para las cinco familias de Inventario; los valores SSOMA existentes se
agrupan visualmente sin modificar sus identificadores ni reglas. No se añade
una segunda tabla o motor de movimientos.

## Tareas

- [x] **BE-P5-01 — Matriz y contrato de clasificación**
- [x] **BE-P5-02 — Enum y migración aditiva**
- [x] **BE-P5-03 — Reglas operativas para nuevas familias**
- [x] **BE-P5-04 — Pruebas y validación backend**

## Verificación prevista

- Prisma validate y generate.
- Build NestJS.
- Jest y ESLint focalizados.
- Inspección SQL de migración sin aplicarla.
- Revisión de diff y estado Git.

## Estrategia de ejecución

- Ruta directa: el uso de subagentes está deshabilitado para esta solicitud por
  la política activa del runtime.
- Entrega `exception-ok`: el usuario prohibió commits.
- Pronóstico: 250–450 líneas autoradas, excluyendo cliente generado.

## Evidencia de cierre

- `prisma validate`: correcto.
- `prisma generate`: correcto; cliente regenerado mediante Prisma, sin edición manual.
- Jest focalizado: 8/8 pruebas correctas.
- ESLint focalizado: correcto tras normalización Prettier.
- Build NestJS: correcto.
- Migración creada e inspeccionada; no aplicada a ninguna base de datos.
- Sin commits por restricción expresa del usuario.
