# Integración segura del publicador VPS

## Objetivo

Conservar el publicador real recibido como evidencia, compararlo con la
referencia versionada y preparar una propuesta integrada verificable sin
ejecutarla contra el VPS ni una base real.

## Alcance autorizado

- Preservar una copia textual del script real proporcionado.
- Crear un publicador propuesto separado del original y la referencia.
- Incorporar manifiestos de código, migraciones, schema y artefacto.
- Incorporar preflight PostgreSQL, backup previo y rollback coherente de código,
  dependencias y build.
- Simular fallos de instalación, backup, migración y health check sin base real.
- Documentar comparación, ensayo aislado e instalación posterior.

## Restricciones

- Sin VPS, producción ni `requestsgava`.
- Sin ejecutar el script real o el propuesto contra servicios reales.
- Sin worktrees, clones, cambio de rama, reset, clean, commits ni push.
- Sin declarar preparación productiva antes de un ensayo restaurable.

## Tareas

- [x] **VPS-01 — Preservar y comparar el publicador original**
  - Copia separada y comparación reproducible documentada.
- [x] **VPS-02 — Añadir integridad del artefacto al workflow**
  - Hash agregado de rutas y bytes de `dist` transmitido al publicador.
- [x] **VPS-03 — Preparar publicador integrado propuesto**
  - Candidato separado; el workflow productivo todavía invoca el original.
- [x] **VPS-04 — Reforzar backup, PostgreSQL y rollback**
  - Preflight, backup verificable, consulta DB posterior y restauración de
    checkout, dependencias y build.
- [x] **VPS-05 — Simular fallos sin infraestructura real**
  - Fallos de instalación, backup, migración y health check detienen el flujo e
    invocan restauración; no se abrió ninguna conexión real.
- [x] **VPS-06 — Documentar ensayo e instalación posterior**
  - Procedimientos separados y no ejecutados en
    `docs/vps-deploy-integration.md`.
- [x] **VPS-07 — Auditar historial, dependencias y verificaciones finales**
  - Rama 28 commits ahead/1 behind; cuatro dependencias Prisma/PostgreSQL
    confirmadas como producción; 21 pruebas focalizadas, Prisma y build válidos.

## Ruta y entrega

- Ruta directa: el modelo exacto de los workers ODD no está disponible y la
  política activa impide sustituirlo.
- Entrega `exception-ok`: el usuario prohíbe commits.
- Pronóstico: 700–1,100 líneas entre shell, pruebas, workflow y documentación.

## Criterios de aceptación

- El original permanece separado y no se ejecuta.
- El propuesto no contiene `db:apply-idempotent` en el flujo normal.
- Backup verificado precede siempre a Prisma Migrate.
- Cualquier fallo previo impide publicar y cualquier fallo posterior intenta
  restaurar checkout, dependencias y build sin afirmar rollback de BD.
- El workflow no despliega por `push` y transmite un hash del artefacto.
- Las simulaciones cubren instalación, backup, migración y health check.

## Verificación ejecutada

- 21/21 pruebas focalizadas de despliegue aprobadas.
- `prisma validate`, Prisma generate y build NestJS aprobados.
- `npm ls --omit=dev` confirmó Prisma CLI, cliente, adapter y `pg`.
- `bash -n`, `node --check`, Prettier y `git diff --check` focalizado en los
  archivos versionados de despliegue aprobados.
- El `git diff --check` global sigue fallando por espacios finales generados por
  Prisma en `src/generated/prisma/index.d.ts`; no se editó el cliente generado.
- ShellCheck no estaba instalado; no se afirmó esa validación.
- No se ejecutaron PostgreSQL, PM2, rsync, curl o migraciones reales.

## Estado

Integración local candidata completada. No está lista para producción hasta
reconciliar la rama, comparar por checksum con el archivo instalado y superar
un ensayo restaurable en infraestructura aislada.
