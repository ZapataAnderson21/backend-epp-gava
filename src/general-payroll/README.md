# Ubicación Servicios

En **Planillas → Semana → Configurar**, `includeServices` habilita una ubicación
independiente. No crea registros en `Project`: utiliza `GeneralPayrollProject`
como asignación semanal con `locationType = services` y `projectId = null`.
El nombre visible es siempre **Servicios** y solo puede existir una por semana.

- Comparte padrón, grupos, asistencias, pagos y permisos con las demás ubicaciones.
- La validación de asistencia diaria considera tanto proyectos como Servicios.
- Se incluye en General, el total semanal y los totales globales del dashboard.
- No se incluye en los gastos ni en el contador de proyectos reales.
- El Excel incluye la hoja Servicios y sus fórmulas en GENERAL. Ese nombre de
  hoja está reservado para evitar colisiones con códigos de proyectos.
- Omitir `includeServices` conserva la selección existente; enviarlo como `false`
  retira la asignación. Si tiene registros, requiere `confirmRemoveServices` y
  los permisos correspondientes. La eliminación borra sus registros vinculados.

## Activación

Aplicar la migración `20260909120000_payroll_services_location` en cada entorno
antes de iniciar el backend actualizado:

```sh
npx prisma migrate deploy
npx prisma generate
npm run build
```

Reiniciar el backend y publicar también el frontend actualizado antes de usar
Servicios. La migración conserva las asignaciones existentes como proyectos.

## Verificación

```sh
npx jest general-payroll dashboard --runInBand
node scripts/test-payroll-services-migration.cjs
```

El segundo comando solo admite PostgreSQL local y usa un esquema temporal
aislado que elimina al terminar; no aplica migraciones a los datos reales.

## Guardado de asistencia

Cada check se persiste mediante
`PATCH /general-payroll/weeks/:weekId/entries/:entryId/attendance`. La operación toma
el bloqueo transaccional de la semana, vuelve a comprobar la exclusividad del
trabajador por día y actualiza únicamente el campo pulsado. La respuesta es
pequeña y no obliga al frontend a recargar la planilla completa. El guardado
masivo se mantiene exclusivamente para los montos.
