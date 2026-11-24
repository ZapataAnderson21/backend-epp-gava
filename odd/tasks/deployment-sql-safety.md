# Seguridad del SQL adicional en despliegues

## Objetivo

Mantener el despliegue automático del backend, usando únicamente las
migraciones oficiales de Prisma para el esquema y evitando que un marcador en
`prisma/sql` autorice SQL destructivo en producción.

## Alcance autorizado

- Auditar el workflow, scripts npm, ejecutor SQL, 89 migraciones y `prisma/sql`.
- Sustituir el descubrimiento automático por una lista explícita y validada.
- Mantener compatibilidad temporal con la llamada remota
  `npm run db:apply-idempotent`.
- Añadir comprobaciones locales y de GitHub Actions.
- Documentar los cambios pendientes del script remoto del VPS.

## Restricciones

- Sin worktrees, clones, cambio de rama, commits, push, reset ni clean.
- Sin conexiones al VPS, producción o `requestsgava`.
- Sin modificar funcionalidades ajenas al despliegue.
- Sin asumir que el repositorio puede editar `/opt/deploy/publish-backend-epp.sh`.

## Tareas

- [x] **DEPLOY-01 — Clasificar migraciones y scripts SQL manuales**
- [x] **DEPLOY-02 — Reemplazar selección por marcador con allowlist explícita**
- [x] **DEPLOY-03 — Bloquear contenido SQL destructivo**
- [x] **DEPLOY-04 — Añadir pruebas de selección y validación**
- [x] **DEPLOY-05 — Añadir preflight seguro al workflow**
- [x] **DEPLOY-06 — Documentar backup, health check y rollback remoto**
- [x] **DEPLOY-07 — Ejecutar validaciones locales y revisar Git**

## Ruta y entrega

- Ruta directa: la política activa prohíbe subagentes salvo solicitud explícita.
- Entrega `exception-ok`: el usuario prohíbe commits.
- Pronóstico: 250–450 líneas autoradas entre ejecutor, prueba y documentación.

## Verificación prevista

- Listado y check del allowlist sin conexión a PostgreSQL.
- Prueba que demuestre que el SQL destructivo no puede seleccionarse.
- Prueba del detector de sentencias destructivas.
- Validación sintáctica del workflow.
- Build y comprobaciones focalizadas sin ejecutar migraciones.
- `git diff --check` y estado final.

## Estado

Auditoría y corrección local completadas. No se accedió al VPS, producción ni
`requestsgava`.

## Evidencia observada

- 89 migraciones auditadas por operaciones potencialmente destructivas.
- La única migración oficial con `DELETE` es la deduplicación
  `20260515120000_unique_element_request_response_per_line`; debe verificarse
  como ya aplicada antes del despliegue productivo.
- Los cuatro archivos de migración de Fases 5, 6 y 6.1 no contienen `DELETE`,
  `TRUNCATE`, `DROP TABLE`, `DROP TYPE`, `DROP SCHEMA` ni `DROP COLUMN`.
- Los ocho scripts de esquema/datos de `prisma/sql` tienen cobertura o
  clasificación explícita; ninguno es necesario en el deploy automático.
- Allowlist de SQL adicional: 0 archivos.
- El script destructivo perdió el marcador automático y el validador rechaza
  sus sentencias `DELETE`.
- Prueba RED observada con el selector anterior; GREEN final: 4/4 pruebas.
- `db:apply-idempotent` finaliza como no-op incluso sin `DATABASE_URL`.
- `prisma validate`, build NestJS y Prettier finalizaron con código 0.

## Decisiones

- Se conserva temporalmente el nombre npm `db:apply-idempotent` para no romper
  el script remoto antes de su actualización; ya no descubre archivos.
- Una futura excepción requiere nombre exacto, SHA-256 y contenido sin
  sentencias prohibidas.
- El workflow sigue publicando el mismo artefacto `dist`; la sincronización de
  migraciones y archivos de soporte del mismo commit debe comprobarse en el
  script remoto antes de publicar Fases 5, 6 y 6.1.

## Próximo paso

Revisar manualmente `/opt/deploy/publish-backend-epp.sh` en una ventana
operativa autorizada y aplicar el checklist de `docs/deployment-safety.md`.
