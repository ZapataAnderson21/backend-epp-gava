# Fase 4.1 — Simplificación UX/UI de Planillas STAFF

## Objetivo

Reducir el flujo mensual STAFF a seleccionar período, editar una tabla única y guardar todas las filas en una sola operación, preservando perfiles remunerativos, snapshots históricos, permisos y exportación.

## Problema y por qué

El flujo actual obliga a configurar perfiles individualmente, crear un período vacío, incorporar personal y guardar cada entrada por separado. La experiencia fragmentada aumenta errores y no conserva la uniformidad visual del SIR.

## Alcance autorizado

- Reutilizar los modelos `StaffPayrollProfile`, `StaffPayroll` y `StaffPayrollEntry` sin modificar Prisma.
- Añadir contratos backend para preparar y guardar una planilla completa de forma transaccional.
- Simplificar el listado principal y crear un editor compartido para alta y edición.
- Mantener la vista secundaria de Personal STAFF y los endpoints históricos compatibles.
- Conservar `GeneralPayroll`, fases 1–3 y los demás módulos sin cambios funcionales.

## Restricciones

- Sin worktrees, clones, cambios de rama, operaciones destructivas, commits ni push.
- Sin migraciones reales, `migrate reset`, `db push` ni edición manual del cliente Prisma.
- No modificar planillas semanales.
- El sueldo mensual cambia solo el snapshot; el perfil habitual solo cambia por acción explícita.

## Estrategia de entrega

- Ruta: ejecución directa por indisponibilidad del modelo exacto `gpt-6.1-luna` asignado al worker ODD; no se sustituye el modelo.
- Estrategia: `exception-ok`, porque el usuario prohíbe commits y esta intervención debe permanecer en los checkouts actuales.
- Pronóstico: 900–1,400 líneas autoradas entre backend, frontend y pruebas.

## Tareas

- [x] **UX01 — Contrato transaccional backend**
  - Preparar filas con perfiles habituales o sueldo pendiente.
  - Guardar período, perfiles faltantes, entradas y actualizaciones explícitas de perfil en una sola transacción.
  - Preservar entradas existentes y snapshots históricos.
  - Pruebas: RED/GREEN focalizado de preparación, guardado masivo, atomicidad y protección histórica.
- [x] **UX02 — Editor mensual y listado simplificado**
  - Listado compacto con período, total neto y acciones.
  - Editor compartido nuevo/existente, tabla editable, total general, notas compactas y guardado único.
  - Precarga de personal STAFF, inclusión opcional y acción explícita para actualizar sueldo habitual.
  - Panel y espaciado consistentes con Proyectos; advertencia de cambios sin guardar.
  - Pruebas: contrato frontend focalizado y build.
- [x] **UX03 — Integración, permisos y verificación**
  - Verificar permisos `staffPayroll.*` + `finance.view`, exportación y compatibilidad semanal.
  - Ejecutar Prisma validate/generate, build, Jest, lint, pruebas frontend y auditoría de diffs.

## Criterios de aceptación

- Una planilla nueva se prepara y guarda sin visitar Personal STAFF.
- Solo aparecen trabajadores STAFF activos y no eliminados; perfiles existentes se precargan.
- Perfiles faltantes se crean atómicamente al primer guardado válido.
- Varios trabajadores se guardan con una sola acción y los errores señalan la fila.
- Los snapshots históricos no se recalculan ni se sobrescriben desde perfiles actuales.
- El listado no muestra KPIs y todas las pantallas STAFF conservadas usan espaciado uniforme.
- Exportación, permisos y planillas semanales continúan funcionando.

## Progreso y evidencia

- Inspección inicial de ramas, estados Git, módulo STAFF y componentes compartidos: completada.
- RED backend observado: preparePeriod y savePeriod ausentes; 0 pruebas ejecutadas por TS2551/TS2339.
- GREEN backend observado: 15/15 pruebas focalizadas y build NestJS correctos; luego se amplió la cobertura de sueldo habitual y snapshots.
- RED frontend observado: ruta/listado/editor nuevos ausentes.
- GREEN frontend observado: 8/8 contratos y build TypeScript + Vite correctos.
- Prisma validate y generate: correctos con Prisma 7.0.0.
- Pruebas backend STAFF: 26/26 correctas en dos suites; prueba focal final: 16/16.
- Regresión semanal: 19/19 correctas en tres suites de GeneralPayroll.
- Lint focalizado backend y frontend: correcto.
- Builds backend y frontend: correctos; Vite conserva la advertencia preexistente de chunk mayor a 500 kB.
- Auditoría Git: diff-check correcto; no se creó migración de Fase 4.1, commit ni push.
- Validación visual en navegador: no ejecutada por no disponer de una sesión local autenticada y una base aislada preparada.
- Próximo paso: validación funcional local del usuario con datos reales de prueba.
