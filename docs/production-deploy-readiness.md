# Preparación del primer despliegue de Fases 5, 6 y 6.1

**Estado: no listo para producción.** El script real ya fue preservado,
comparado e integrado en un candidato separado. Falta verificar PostgreSQL en
producción y ejecutar un ensayo restaurable. Véase
`docs/vps-deploy-integration.md`.

## Propuesta concreta

| Etapa               | Control                                                            |
| ------------------- | ------------------------------------------------------------------ |
| Push a `main`       | Ejecuta validación, pruebas y build; no publica.                   |
| Autorización        | `workflow_dispatch` exige el SHA exacto de `main`.                 |
| Aprobación          | Job asociado al environment `production`.                          |
| Identidad           | GitHub y VPS comparan commit, schema y manifiesto de migraciones.  |
| Preflight           | Valida credenciales, conexión, versión de PostgreSQL y espacio.    |
| Backup              | `pg_dump` custom, archivo no vacío, `pg_restore --list` y SHA-256. |
| Esquema             | Solo `prisma migrate deploy`; sin SQL manual adicional.            |
| Activación          | Ocurre después del backup y las migraciones.                       |
| Fallo de aplicación | Restaura el código anterior; la base permanece migrada.            |

## Verificaciones locales realizadas

Estas comprobaciones no requieren VPS ni una base real:

```bash
npm run test:deploy-sql
npm run test:deploy-workflow
npm run test:deploy-reference
npm run test:deploy-proposed
npm run db:check-deploy-sql
npm run prisma:validate
npm run build
```

La referencia Bash rechaza su ejecución directa. Solo puede cargarse para
probar funciones o utilizarse como material de comparación.

## Configuración requerida en GitHub

1. Crear el environment `production` en **Settings → Environments**.
2. Configurar revisores requeridos y activar **Prevent self-review**.
3. Deshabilitar el bypass administrativo, cuando el plan lo permita.
4. Autorizar despliegues únicamente desde `main`.
5. Mover `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT` y
   `VPS_BACKEND_PATH` a secretos del environment.
6. Proteger `main` y exigir como estado requerido el job **Verificar backend**.

El archivo del workflow no crea reglas de aprobación por sí solo. Si el plan de
GitHub no ofrece required reviewers para el repositorio, el dispatch manual y
el SHA exacto siguen evitando despliegues por push, pero debe definirse un
control humano alternativo antes de producción.

## Referencia versionada para el VPS

Archivo:

`scripts/deploy/publish-backend-epp.reference.sh`

No debe copiarse directamente a `/opt/deploy`. Tiene hooks deliberadamente no
implementados para la lógica que solo existe en el script real:

- adquisición de `flock`;
- fetch, verificación y checkout;
- publicación de releases;
- reinicio de PM2;
- health check;
- restauración del código anterior.

La integración correcta consiste en comparar ambos archivos y trasladar al
script real únicamente estas funciones revisadas:

- `verify_protected_credentials`;
- `verify_postgres_connection_and_tools`;
- `verify_prisma_and_backup_target_match`;
- `verify_backup_space`;
- `create_verified_backup`;
- `migration_manifest_sha256`;
- `verify_commit_and_migration_manifest`.

## Instalación en producción — pendiente

Estas acciones se realizan únicamente en una ventana autorizada y después de
aprobar el candidato descrito en `docs/vps-deploy-integration.md`.

1. Guardar una copia con permisos restringidos del publicador actual.
2. Comparar su flujo con la función `reference_deploy_sequence`.
3. Conservar sin cambios la semántica comprobada de `flock`, releases, PM2,
   health check y rollback de código.
4. Incorporar el preflight y backup antes de `prisma migrate deploy`.
5. Eliminar `npm run db:apply-idempotent` del flujo normal.
6. Incorporar la comparación de `EXPECTED_MIGRATION_COUNT`,
   `EXPECTED_MIGRATIONS_SHA256` y `EXPECTED_SCHEMA_SHA256`.
7. Ejecutar la migración antes de activar el nuevo release.
8. Confirmar que ningún `|| true`, subshell en background o manejo de errores
   permite continuar cuando falla Prisma.
9. Validar el archivo con `bash -n` y ShellCheck en el VPS o en un entorno Linux
   equivalente.
10. Instalar primero con otro nombre y reemplazar el publicador solo después del
    ensayo supervisado.

## Credenciales y versión PostgreSQL

Producción debe definir, sin imprimirlas:

- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`;
- `PGPASSFILE` propiedad del usuario de despliegue y modo `0600` o `0400`;
- `DATABASE_URL` para Prisma en un archivo de entorno protegido;
- opcionalmente `PSQL_BIN`, `PG_DUMP_BIN` y `PG_RESTORE_BIN`.

La referencia consulta `server_version_num` y compara la versión mayor del
servidor con `pg_dump`. Un cliente anterior al servidor se rechaza. La versión
18 local no demuestra la versión productiva. También compara el destino real
de `DATABASE_URL` con el destino de las variables `PG*`, evitando respaldar una
base distinta de la que Prisma migrará.

No activar `set -x`, no imprimir `DATABASE_URL` y no pasar contraseñas como
argumentos. El backup se escribe con `umask 077` fuera de los releases.

## Ensayo sin modificar producción

1. Usar la copia preservada del script real; no conectarse al VPS desde esta
   tarea.
2. Revisar el candidato integrado que permanece en un archivo separado.
3. Ejecutar `bash -n` y ShellCheck.
4. Preparar una base PostgreSQL aislada a partir de un backup autorizado.
5. Usar un usuario de prueba, un `PGPASSFILE` temporal y un directorio de backup
   desechable.
6. Sustituir PM2, publicación y health check por stubs que registren el orden.
7. Provocar fallos de conexión, espacio, `pg_dump`, Prisma y health check.
8. Confirmar que nunca se activa el nuevo build después de un fallo previo.
9. Restaurar el dump en otra base aislada y ejecutar comprobaciones funcionales.

No es suficiente que `pg_restore --list` acepte el archivo: antes de producción
debe existir al menos una restauración real verificada.

## Primer despliegue supervisado

- [ ] Confirmar ventana, responsables y canal de comunicación.
- [ ] Confirmar protección del environment y SHA autorizado.
- [ ] Confirmar versión real de PostgreSQL y binarios cliente compatibles.
- [ ] Confirmar espacio, retención y ubicación externa del backup.
- [ ] Confirmar que la restauración aislada fue satisfactoria.
- [ ] Confirmar que producción tiene aplicada
      `20260515120000_unique_element_request_response_per_line`.
- [ ] Confirmar los 89 directorios y los hashes recibidos desde GitHub Actions.
- [ ] Supervisar backup, `prisma migrate deploy`, activación, PM2 y health check.
- [ ] Revisar `_prisma_migrations` y logs sin mostrar secretos.
- [ ] Ejecutar smoke tests de Inventario, SSOMA y Requerimientos.
- [ ] Registrar explícitamente que un rollback de código no revierte PostgreSQL.

## Información todavía faltante

- Confirmación por checksum de que el script preservado sigue coincidiendo con
  el instalado en el VPS al iniciar la ventana de cambio.
- Versión y topología reales de PostgreSQL en producción.
- Ruta, capacidad, retención y copia externa de backups.
- Usuario PostgreSQL y privilegios disponibles para backup.
- Nombre PM2, rutas de releases y contrato exacto del health check.
- Disponibilidad de required reviewers según el plan de GitHub.
- Resultado del ensayo con una restauración reciente de producción.
