# Consolidación de la cadena de migraciones Prisma

## Objetivo

Una instalación nueva debe reconstruir el esquema completo exclusivamente con:

```bash
npx prisma migrate deploy
```

Los scripts de `prisma/sql` dejan de ser prerrequisitos para una base nueva. Se
conservan como material histórico u operativo, pero no forman parte de la cadena
de despliegue oficial.

## Migraciones de consolidación

### `20261118200000_consolidate_inventory_schema_prerequisites`

Se ordena después de la clasificación de Inventario de Fase 5 y antes de Fase 6.
Consolida de forma idempotente:

- Enums, valores y ubicaciones del motor de inventario.
- Variantes de elementos y stock central.
- Activos individualizados, perfiles de arnés y medición.
- Asignaciones a trabajadores y columnas de movimientos.
- Atributos de catálogo y stock mínimo.
- Componentes normalizados de protección contra caídas.
- Índices y claves foráneas requeridos por Fase 6.
- Backfill no destructivo de componentes desde las columnas legacy.

La migración acepta tanto una base limpia como una base donde los scripts
manuales ya fueron ejecutados. Reconoce las claves compuestas creadas por Fase 6
y no restaura las claves simples reemplazadas.

### `20261119120000_add_missing_staff_payroll_profile_index`

Agrega el índice declarado por Prisma para `StaffPayrollProfile.workerId`. La
restricción única existente se conserva; no se elimina ni renombra.

## Auditoría de `prisma/sql`

| Script | Tratamiento oficial |
| --- | --- |
| `20260413_fix_missing_inventory_family.sql` | Redundante con las migraciones versionadas de abril de 2026; no requerido para instalaciones nuevas. |
| `20260427_inventory_schema_sync.sql` | Absorbido por `20261118200000_consolidate_inventory_schema_prerequisites`. |
| `20260427_add_inventory_item_attributes.sql` | Sus columnas fueron absorbidas por la migración de consolidación. |
| `20260427_ssoma_final_design.sql` | `uniform` ya se agrega en la cadena y `stockMinimum` fue absorbido por la consolidación. |
| `20260429_add_fall_protection_groups.sql` | Redundante con `20260502110000_create_fall_protection_groups`. |
| `20260707_add_fall_protection_group_components.sql` | Tabla, enum, índices, claves y backfill absorbidos por la consolidación. |
| `20260427_remove_eq_safety_consumibles.sql` | **Prohibido para despliegue.** Elimina registros históricos. No forma parte de la cadena. |
| `ssoma-audit-role-privileges.sql` | Auditoría operativa de privilegios; no define el esquema de aplicación y no se convierte en migración Prisma. |

## Valores legacy

`consumible` y `eq_safety` permanecen en `ElementFamily` y en
`schema.prisma`. No se reclasifican registros automáticamente. Una eventual
eliminación requiere inventario de datos, correspondencia empresarial explícita
y una migración separada que preserve todas las relaciones.

## Diferencias de `prisma migrate diff`

La primera comparación contra una base reconstruida detectó:

- Un índice faltante de `StaffPayrollProfile`: corregido mediante migración.
- Índices y claves foráneas con nombres truncados o históricos: se declararon
  mediante `map` en Prisma, sin renombrar objetos ni adquirir bloqueos evitables.
- Defaults de `FallProtectionGroup.updatedAt` y `RateLimitBucket.updatedAt`: se
  conservaron en PostgreSQL y se reflejaron con `@default(now()) @updatedAt`.
- `RequestWorker_workerId_idx`: se conservó y se declaró en Prisma; no se eliminó
  un índice potencialmente útil.
- Valores enum legacy: se conservaron en el esquema.

Después de estas correcciones, el diff de una base reconstruida es vacío.

## Compatibilidad con bases existentes

La migración de consolidación usa `IF NOT EXISTS`, comprobaciones de
`pg_constraint` y backfills con `ON CONFLICT DO NOTHING`. También fue probada en
una base aislada donde Fase 6 y Fase 6.1 figuraban como aplicadas y la nueva
migración anterior todavía no estaba registrada. `prisma migrate deploy` la
aplicó posteriormente sin drift ni pérdida de datos.

No debe ejecutarse manualmente ninguno de los scripts absorbidos antes o después
del deploy en instalaciones nuevas.

## Procedimiento de despliegue

1. Realizar backup y verificar capacidad de restauración.
2. Confirmar que `DATABASE_URL` apunta al entorno previsto.
3. Ejecutar `npx prisma migrate status`.
4. Ejecutar `npx prisma migrate deploy`.
5. Verificar que todas las migraciones terminen con `finished_at` y sin
   `rolled_back_at` en `_prisma_migrations`.
6. Ejecutar `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`.
7. El resultado esperado es `-- This is an empty migration.`.

No ejecutar `prisma db push`, `migrate reset` ni el script destructivo de
eliminación de familias legacy.

## Evidencia de validación local

- PostgreSQL local desechable: `sir_gava_migration_verify_full_20261119`.
- 89 de 89 migraciones registradas y finalizadas correctamente.
- Tablas de inventario, Fase 6 y Fase 6.1 presentes.
- Restricciones críticas de cantidades e integridad presentes.
- `prisma migrate status`: esquema actualizado.
- `prisma migrate diff`: vacío.
- Replay idempotente de la consolidación: correcto.

Las bases de validación fueron creadas exclusivamente para esta auditoría y no
corresponden a `requestsgava`. Ambas se eliminaron al terminar la validación.
