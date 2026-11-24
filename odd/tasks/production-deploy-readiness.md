# Preparación final del despliegue productivo

## Objetivo

Mantener verificaciones automáticas en `main`, exigir autorización explícita
para publicar y proporcionar una referencia versionada —no instalable sin
comparación— para incorporar backup y preflight al publicador del VPS.

## Alcance autorizado

- Auditar y endurecer el workflow y scripts locales de despliegue.
- Separar validación automática y publicación manual autorizada.
- Crear una referencia segura para comparar con el script real del VPS.
- Documentar instalación, prueba sin producción y primer despliegue supervisado.
- Mantener Prisma Migrate como único mecanismo normal de esquema.

## Restricciones

- Sin conexión ni cambios en el VPS o bases reales.
- Sin asumir el contenido completo del publicador remoto.
- Sin worktrees, clones, ramas nuevas, commits, push, reset ni clean.
- Sin declarar preparación productiva hasta comparar y probar el script real.

## Tareas

- [x] **PROD-01 — Auditar workflow, npm y ejecutor SQL actuales**
  - Confirmado: Prisma Migrate es la fuente normal del esquema y la allowlist
    de SQL adicional está vacía.
- [x] **PROD-02 — Separar CI automático y despliegue autorizado**
  - `push` a `main` ejecuta validación; la publicación requiere
    `workflow_dispatch`, SHA exacto y el environment `production`.
- [x] **PROD-03 — Crear referencia de backup y preflight PostgreSQL**
  - La referencia valida conexión, versión de herramientas, credenciales,
    destino, espacio, archivo, catálogo y checksum del backup.
- [x] **PROD-04 — Verificar commit, schema y manifiesto de migraciones**
  - GitHub Actions transmite conteo y hashes; la referencia exige coincidencia
    con el checkout autorizado antes de migrar.
- [x] **PROD-05 — Documentar integración segura en el VPS**
  - La guía exige comparar el script real y fusionar funciones; la referencia
    falla si se intenta ejecutar directamente.
- [x] **PROD-06 — Documentar simulación y primer despliegue supervisado**
  - Se separaron pruebas locales, ensayo aislado, instalación y despliegue
    supervisado, sin presentar el rollback de código como rollback de BD.
- [x] **PROD-07 — Ejecutar pruebas locales y revisar Git**
  - 11 pruebas focalizadas aprobadas; Prisma válido; SQL adicional vacío;
    Prettier, build y `git diff --check` aprobados.

## Ruta y entrega

- Ruta directa: la política activa prohíbe subagentes salvo solicitud explícita.
- Entrega `exception-ok`: el usuario prohíbe commits.
- Pronóstico: 350–600 líneas entre shell de referencia, workflow, pruebas y guía.

## Verificación ejecutada

- `bash -n`, rechazo de ejecución directa, orden backup → migración →
  publicación y funciones de versión PostgreSQL.
- Pruebas del gate de commit, disparadores del workflow y manifiestos.
- Validación del ejecutor SQL con allowlist vacía y rechazo del script
  destructivo histórico.
- `prisma validate`, build, Prettier, `node --check` y `git diff --check`.
- No se simuló una restauración PostgreSQL en esta tarea ni se ejecutó el
  publicador real del VPS.

## Estado

Preparación local completada. No se ha accedido al VPS, producción ni
`requestsgava`. El despliegue NO está listo para producción hasta comparar el
script real, verificar PostgreSQL/almacenamiento/credenciales y completar el
ensayo restaurable y el primer despliegue supervisado.
