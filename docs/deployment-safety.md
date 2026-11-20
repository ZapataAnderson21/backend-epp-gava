# Despliegue seguro del backend

El esquema se publica exclusivamente con las 89 migraciones oficiales de
Prisma. Ningún archivo de `prisma/sql` está autorizado para ejecutarse
automáticamente después de la consolidación.

La preparación final, el gate manual y la integración del backup se detallan
en `docs/production-deploy-readiness.md`. La comparación e integración del
script real está en `docs/vps-deploy-integration.md`; el despliegue todavía no
debe considerarse listo hasta completar el ensayo restaurable.

## Ruta rápida

1. Validar automáticamente el commit en GitHub Actions.
2. Autorizar manualmente el SHA exacto mediante `workflow_dispatch` y el
   environment protegido `production`.
3. Crear y verificar un backup de PostgreSQL en el VPS.
4. Ejecutar `npm run prisma:migrate:deploy` antes de cambiar la versión activa.
5. Publicar el build, reiniciar PM2 y ejecutar el health check.
6. Si falla la aplicación, restaurar el build anterior; no asumir que esto
   revierte la base de datos.

## Controles incorporados al repositorio

| Control                | Decisión                                                                       |
| ---------------------- | ------------------------------------------------------------------------------ |
| Migraciones            | `prisma migrate deploy` es el único mecanismo del esquema.                     |
| SQL adicional          | Allowlist explícita, actualmente vacía.                                        |
| Integridad del SQL     | Toda futura entrada debe fijar archivo y SHA-256.                              |
| Operaciones prohibidas | El ejecutor rechaza `DELETE`, `TRUNCATE`, `DROP`, `EXECUTE` dinámico y `CALL`. |
| Script destructivo     | No tiene marcador automático y una prueba confirma que no puede seleccionarse. |
| CI                     | Valida Prisma, allowlist y pruebas antes de enviar el artefacto.               |

`npm run db:apply-idempotent` se conserva temporalmente porque el script remoto
actual todavía lo invoca. Con la allowlist vacía termina correctamente sin
conectarse a PostgreSQL ni ejecutar SQL. Puede retirarse del VPS y del
`package.json` cuando el procedimiento remoto haya sido actualizado.

## Auditoría de `prisma/sql`

| Archivo                                             | Cobertura oficial                                       | Uso automático               |
| --------------------------------------------------- | ------------------------------------------------------- | ---------------------------- |
| `20260413_fix_missing_inventory_family.sql`         | Migración histórica de abril y puente `20261118200000`. | No requerido.                |
| `20260427_add_inventory_item_attributes.sql`        | Puente `20261118200000`.                                | No requerido.                |
| `20260427_inventory_schema_sync.sql`                | Puente `20261118200000`.                                | No requerido.                |
| `20260427_ssoma_final_design.sql`                   | Fase 5 y puente `20261118200000`.                       | No requerido.                |
| `20260429_add_fall_protection_groups.sql`           | `20260502110000_create_fall_protection_groups`.         | No requerido.                |
| `20260707_add_fall_protection_group_components.sql` | Puente `20261118200000`.                                | No requerido.                |
| `20260714_remove_supplier_email_unique.sql`         | `20260714183000_remove_supplier_email_unique`.          | No requerido.                |
| `20260427_remove_eq_safety_consumibles.sql`         | No debe aplicarse; elimina históricos.                  | Prohibido.                   |
| `ssoma-audit-role-privileges.sql`                   | Control operativo de privilegios, no esquema.           | Ejecución manual controlada. |

Las 89 migraciones contienen operaciones históricas de evolución, incluidas
eliminaciones antiguas de columnas y tablas. Esto no convierte esos cambios en
SQL recurrente: Prisma los registra en `_prisma_migrations` y los ejecuta una
sola vez. Las migraciones pendientes de Fases 5, 6 y 6.1 no eliminan registros
históricos; el puente elimina únicamente índices de unicidad incompatibles con
el modelo consolidado.

La auditoría encontró una migración oficial con `DELETE`:
`20260515120000_unique_element_request_response_per_line`. Conserva la fila más
reciente de cada duplicado antes de crear una restricción única. Antes del
despliegue debe confirmarse que esa migración histórica ya figura como aplicada
en producción; no debe asumirse a partir de la fecha o del contenido del VPS.

## Cambio requerido en el VPS

No se modificó `/opt/deploy/publish-backend-epp.sh`. Antes de desplegar Fases 5,
6 y 6.1 debe revisarse manualmente para cumplir este orden:

```bash
set -Eeuo pipefail

# 1. Adquirir el bloqueo de despliegue existente.
# 2. Verificar espacio, configuración y artefacto.
# 3. Crear y comprobar el backup PostgreSQL.
npm run prisma:migrate:deploy

# No ejecutar SQL descubierto por marcadores.
# La llamada temporal siguiente es un no-op con la versión nueva del runner:
npm run db:apply-idempotent

# 4. Solo después de migrar: activar release, reiniciar PM2 y comprobar salud.
# 5. Ante fallo de salud: reactivar el build anterior y reiniciar PM2.
```

El comando de migración no puede estar seguido por `|| true`, ejecutarse en
segundo plano ni quedar dentro de una condición que ignore su código. Con
`set -e`, cualquier error debe ocurrir antes del cambio de symlink o reinicio de
PM2.

### Artefacto y migraciones

El workflow visible envía únicamente `dist`. Por tanto, el script remoto debe
demostrar que materializa desde el mismo commit `DEPLOY_COMMIT`, antes de
migrar, al menos:

- `prisma/migrations` y `prisma/schema.prisma`;
- `prisma.config.ts`;
- `package.json` y el lockfile;
- `scripts/run-idempotent-sql.cjs`, mientras exista la llamada temporal.

Si el VPS no sincroniza esos archivos por otro mecanismo verificable, las
nuevas migraciones no estarán disponibles aunque el build sí llegue. Este punto
es un bloqueo de despliegue que debe comprobarse directamente en el script del
VPS, sin exponer credenciales.

## Backup sin exponer credenciales

Usar una cuenta de backup de mínimo privilegio y un `PGPASSFILE` propiedad del
usuario de despliegue, con modo `0600`. No imprimir `DATABASE_URL`, no habilitar
`set -x` y no colocar contraseñas en argumentos o logs.

Ejemplo orientativo para el script remoto:

```bash
umask 077
backup="/var/backups/backend-epp/predeploy-$(date -u +%Y%m%dT%H%M%SZ).dump"
export PGPASSFILE=/etc/backend-epp/pgpass
pg_dump --format=custom --no-owner --no-privileges \
  --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
  --dbname="$PGDATABASE" --file="$backup"
test -s "$backup"
pg_restore --list "$backup" >/dev/null
sha256sum "$backup" >"$backup.sha256"
```

El backup debe almacenarse fuera del directorio de releases, tener retención y
contar con una restauración probada. Un archivo creado pero nunca restaurado no
es evidencia suficiente.

## Rollback y compatibilidad

Reactivar el build anterior revierte solamente el código. Las migraciones de
PostgreSQL permanecen aplicadas. Por eso:

- las migraciones deben seguir el patrón expandir–migrar–contraer;
- el build anterior debe tolerar el esquema expandido durante el rollback;
- una restauración de base requiere decisión operativa, ventana y pérdida
  controlada de escrituras posteriores al backup;
- un health check fallido después de migrar debe generar alerta explícita de
  “código revertido, base no revertida”.

## Checklist para Fases 5, 6 y 6.1

- [ ] Confirmar que el VPS materializa las migraciones del mismo commit.
- [ ] Actualizar el runner remoto o retirar `db:apply-idempotent` del script.
- [ ] Verificar backup restaurable y espacio disponible.
- [ ] Confirmar que el bloqueo impide dos despliegues simultáneos.
- [ ] Ejecutar `prisma migrate deploy` antes de activar el nuevo build.
- [ ] Confirmar que el error de migración detiene el despliegue.
- [ ] Ejecutar health check autenticado solo si corresponde, sin secretos en logs.
- [ ] Validar rollback del código y registrar que la base no se revierte.
- [ ] Revisar `_prisma_migrations` y logs después de publicar.
