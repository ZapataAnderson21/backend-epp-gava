# Roles y permisos

La configuración se encuentra en **Roles y permisos** (`/admin/permissions`).
Cada módulo expone Ver, Gestionar (crear/editar), Eliminar y Exportar cuando
corresponden. Las acciones especiales se despliegan por módulo. Planillas separa
configuración, asistencias y pagos; Información económica controla los importes.

## Activación

Aplicar primero el backend, con respaldo previo de la base de datos:

```powershell
npx prisma migrate deploy
npx prisma generate
npm run build
```

Reiniciar el backend con el procedimiento habitual y publicar el frontend.
La migración `20260908120000_dynamic_role_permissions` inicializa los roles
existentes; GERENTE y ADMINISTRADORA reciben administración de permisos. Los
otros roles reciben una configuración inicial editable. Revisar esa matriz antes
de habilitar usuarios. Renombrar un rol no cambia sus permisos.

Si existen usuarios activos pero ninguno está asignado a un rol administrador,
la migración se detiene: un operador debe corregir esa asignación antes de
reintentar. En una instalación vacía, el aprovisionamiento inicial debe asignar
los permisos al primer administrador mediante un procedimiento de confianza;
no existe un endpoint público de autoasignación de privilegios.

## Reglas

- Los roles nuevos comienzan sin permisos; duplicar copia la selección.
- Gestionar no incluye Eliminar, Exportar ni las acciones especiales.
- Las dependencias incluyen Ver; editar/exportar importes requiere Información
  económica. La interfaz explica las desactivaciones relacionadas.
- El servidor consulta los permisos persistidos en cada solicitud. La interfaz
  los actualiza al navegar, recuperar el foco o guardar la configuración.
- Asignar roles requiere un permiso independiente. Sin administración de roles,
  un operador no puede conceder permisos que él mismo no tiene.
- Se protegen las credenciales de usuarios con permisos superiores frente a
  editores delegados. Los cambios de rol se realizan por el endpoint específico.
- No se puede quitar, desactivar o reasignar al último administrador de permisos.
  La validación transaccional tiene protección adicional en PostgreSQL, incluso
  ante cambios concurrentes.
- Guardar usa una versión del rol: una edición desactualizada devuelve conflicto,
  evitando sobreescribir cambios de otro administrador.
- Las validaciones del negocio (estados, autoría, asistencias, etc.) siguen vigentes.
- Esta versión no contiene excepciones por usuario ni permisos por proyecto.

## Verificación

```powershell
npx jest permissions --runInBand
node scripts/test-permission-migration.cjs
```

El segundo comando solo acepta una base local. Crea un esquema aislado con nombre
único, prueba la migración y la concurrencia, y elimina ese esquema al terminar;
no aplica la migración en las tablas de la aplicación.

La implementación usa el catálogo `src/permissions/catalog.ts`, la política de
endpoints y el guard global. Los decoradores antiguos de nombres de roles no son
la fuente de autorización. Agregar un módulo o endpoint privado exige revisar
su política; los controladores desconocidos se rechazan por defecto.
