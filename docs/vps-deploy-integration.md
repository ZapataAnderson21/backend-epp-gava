# Integración del publicador seguro del VPS

## Estado

La integración está preparada como **candidata**, no como reemplazo aprobado.
No se conectó al VPS ni se ejecutó contra PostgreSQL. La instalación productiva
queda bloqueada hasta completar un ensayo restaurable con la versión real de
PostgreSQL y comparar nuevamente el archivo instalado.

## Artefactos

- Original recibido: `scripts/deploy/publish-backend-epp.vps-original.sh`.
- Referencia previa: `scripts/deploy/publish-backend-epp.reference.sh`.
- Candidato integrado: `scripts/deploy/publish-backend-epp.proposed.sh`.

La copia original conserva el contenido shell proporcionado, excluyendo el
prompt `root@gava:~#` y normalizando únicamente los escapes de transporte del
mensaje y los finales de línea a LF. No debe ejecutarse desde el repositorio.

## Comparación línea por línea

La comparación reproducible es:

```bash
git diff --no-index -- \
  scripts/deploy/publish-backend-epp.vps-original.sh \
  scripts/deploy/publish-backend-epp.reference.sh

git diff --no-index -- \
  scripts/deploy/publish-backend-epp.vps-original.sh \
  scripts/deploy/publish-backend-epp.proposed.sh
```

### Diferencias relevantes

| Área                  | Script real                      | Referencia                       | Candidato integrado                                |
| --------------------- | -------------------------------- | -------------------------------- | -------------------------------------------------- |
| Bloqueo               | `flock -w 900`                   | Hook sin implementación          | Conservado                                         |
| Artefacto             | `main.js`, sin symlinks          | No implementaba recepción        | Añade Prisma Client y hash de árbol                |
| Commit                | Commit ancestro de `origin/main` | Exigía coincidencia exacta       | Exige HEAD exacto de `origin/main`                 |
| Schema y migraciones  | Sin manifiestos                  | Conteo y SHA-256                 | Integrado antes de migrar                          |
| Dependencias          | `npm ci --omit=dev`              | Conservaba la secuencia          | Conservado y comprobado en rollback                |
| PostgreSQL            | Prisma era la primera prueba     | Preflight y destino común        | Integrado con archivo protegido                    |
| Backup                | No existía                       | Custom dump, catálogo y checksum | Integrado obligatoriamente antes de Prisma         |
| SQL manual            | Ejecutaba `db:apply-idempotent`  | Lo retiraba                      | Retirado del flujo normal                          |
| Instalación de `dist` | `rsync --delete` directo         | Hook                             | Prepara candidato, verifica hash y luego sustituye |
| Rollback              | Solo restauraba `dist`           | Hook                             | Restaura checkout, dependencias y `dist`           |
| Health                | HTTP `/documentation`            | Hook                             | HTTP más consulta PostgreSQL por `DATABASE_URL`    |
| Migración fallida     | Abortaba                         | Abortaba                         | Aborta, restaura código y exige revisar BD         |

### Riesgos comprobados en el original

1. No existe backup previo a `prisma migrate deploy`.
2. El SQL adicional se ejecuta automáticamente después de Prisma.
3. El artefacto no tiene un digest esperado; SSH protege el transporte, pero el
   receptor no verifica los bytes recibidos contra GitHub Actions.
4. Un `rsync` interrumpido puede dejar `dist` parcialmente sustituido y el trap
   solo elimina temporales.
5. El rollback restaura `dist`, pero conserva el checkout y `node_modules` del
   release nuevo. El build anterior puede ser incompatible con esas dependencias.
6. `/documentation` demuestra respuesta HTTP, no disponibilidad PostgreSQL.
7. El commit puede ser cualquier ancestro de `origin/main`, no necesariamente el
   SHA exacto autorizado por el workflow.

## Integridad cubierta

El workflow calcula y el candidato compara:

- SHA autorizado y HEAD exacto de `origin/main`.
- Cantidad de directorios de migración.
- SHA-256 de `schema.prisma`.
- SHA-256 agregado de todas las migraciones ordenadas.
- SHA-256 agregado de rutas relativas y contenido de los archivos de `dist`.

El hash del artefacto detecta archivos añadidos, retirados, renombrados o
modificados. **No cubre** permisos Unix, propietario, directorios vacíos,
provenance criptográfica independiente del runner ni una firma del artefacto.
Los actions están fijados por commit y SCP/SSH protege el transporte, pero esto
no equivale a una cadena SLSA o a firma verificable.

## Dependencias de producción

`npm ci --omit=dev` conserva actualmente todos los componentes necesarios:

- `prisma` 7.0.0.
- `@prisma/client` 7.0.0.
- `@prisma/adapter-pg` 7.0.0.
- `pg` 8.x.

Los cuatro están en `dependencies` y aparecen como producción en
`package-lock.json`. Esta decisión debe revalidarse si se reorganiza
`package.json`.

## PostgreSQL y credenciales

El candidato carga `/etc/sir-gava/backend-deploy.env`, que debe pertenecer al
usuario ejecutor y tener modo `0600` o `0400`. Debe definir, sin imprimirlos:

```dotenv
DATABASE_URL='postgresql://...'
PGHOST='...'
PGPORT='5432'
PGDATABASE='...'
PGUSER='...'
PGPASSFILE='/etc/sir-gava/backend.pgpass'
BACKUP_DIR='/var/backups/backend-epp'
BACKUP_FREE_RESERVE_BYTES='1073741824'
```

`backend.pgpass` también debe ser propiedad del ejecutor y modo `0600` o
`0400`. El preflight verifica:

- conexión y versión real del servidor;
- `pg_dump` no anterior al servidor;
- misma major para `pg_dump` y `pg_restore`;
- identidad de base/servidor/puerto entre PG\* y `DATABASE_URL`;
- espacio libre mayor o igual al tamaño lógico de la BD más la reserva.

El backup usa formato custom, verifica que no esté vacío, inspecciona su
catálogo mediante `pg_restore --list` y valida su checksum. Esto **no sustituye
una restauración ensayada**.

Después del reinicio se exigen dos comprobaciones independientes: respuesta
HTTP y una consulta real con `DATABASE_URL` usando el mismo driver `pg` del
backend. La segunda confirma configuración y disponibilidad de PostgreSQL, pero
no es todavía un readiness endpoint transaccional servido por NestJS.

## Ensayo aislado obligatorio

1. Crear una VM o contenedor desechable sin acceso a producción.
2. Instalar la misma major de Node, PostgreSQL client, PM2 y rsync del VPS.
3. Restaurar una copia autorizada y anonimizada de producción en PostgreSQL
   aislado.
4. Preparar un repositorio y artefacto del mismo commit dentro del entorno
   desechable.
5. Configurar `backend-deploy.env` y `.pgpass` exclusivamente para esa base.
6. Ejecutar primero las simulaciones automatizadas del repositorio.
7. Ejecutar el candidato con PM2 y health URL aislados.
8. Confirmar backup, checksum, catálogo, migraciones, HTTP y consulta DB.
9. Restaurar el dump generado en una **segunda base desechable** y comparar
   esquema, `_prisma_migrations` y conteos críticos.
10. Provocar controladamente fallos de instalación, backup, migración y health
    check; confirmar que nunca se activa un build incompleto.

No usar `prisma migrate reset`, `prisma db push` ni una base existente para este
ensayo.

## Instalación posterior en el VPS — no ejecutar todavía

Solo después del ensayo restaurable:

1. Copiar el candidato con otro nombre:

   ```bash
   sudo install -o root -g root -m 0750 \
     scripts/deploy/publish-backend-epp.proposed.sh \
     /opt/deploy/publish-backend-epp.sh.candidate
   ```

2. Ejecutar únicamente validación sintáctica:

   ```bash
   sudo bash -n /opt/deploy/publish-backend-epp.sh.candidate
   ```

3. Crear el archivo de entorno y `.pgpass` protegidos; verificar permisos sin
   mostrar su contenido.
4. Verificar versiones de `psql`, `pg_dump`, `pg_restore`, Node, npm, PM2 y
   espacio del filesystem de backup.
5. Conservar el original:

   ```bash
   sudo cp -a /opt/deploy/publish-backend-epp.sh \
     /opt/deploy/publish-backend-epp.sh.pre-safe-deploy
   ```

6. Comparar el archivo candidato instalado contra el versionado mediante
   SHA-256.
7. Configurar y revisar el environment protegido `production` de GitHub.
8. Sustituir el script mediante `install`/`mv` atómico únicamente en una ventana
   supervisada.
9. Ejecutar el primer despliegue manual por SHA exacto, observar backup,
   migraciones, PM2, HTTP y PostgreSQL.
10. No borrar el original ni los backups hasta cerrar la validación operativa.

## Rollback y migraciones

El candidato mejora el rollback de código al restaurar checkout, dependencias y
build. Sin embargo, **ningún rollback del filesystem revierte PostgreSQL**. Las
migraciones publicadas deben ser compatibles hacia adelante con el build
anterior. Una migración parcialmente fallida exige inspección de
`_prisma_migrations` y una decisión operativa; nunca se debe ejecutar un reset.

## Historial Git local

En la auditoría del 20 de noviembre de 2026, la rama
`feat/optional-supplier-account` estaba 28 commits por delante y 1 por detrás de
`origin/main`. El commit local de proveedor aparece patch-equivalent al commit
remoto, pero 25 commits SSOMA aparecen exclusivos en la rama según `git cherry`.

No debe publicarse esta rama ni integrarse automáticamente. Primero se debe
determinar qué commits ya fueron publicados por otra historia y preparar una
integración Git explícita, revisada y fuera de esta tarea. El workflow impide el
deploy directo desde esta rama porque exige `refs/heads/main`, pero no evita que
una integración accidental lleve cambios no revisados a `main`.
