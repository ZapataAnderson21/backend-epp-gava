# Autoguardado de requerimientos

Los formularios Nuevo requerimiento y Editar requerimiento conservan una copia local desde el primer cambio y sincronizan con el servidor después de 800 ms sin escribir. La copia incluye proyecto, fecha y hora de entrega, descripción, ítems con sus cantidades y notas, trabajadores y planificación; también conserva los detalles de planificación pendientes de confirmar. No incluye la contraseña de correo.

Cada usuario tiene borradores independientes para:

- El formulario general `/admin/requests/new`, incluso antes de elegir proyecto.
- El formulario de creación de cada proyecto `/admin/requests/new?projectId=ID`.
- La edición de cada requerimiento `/admin/requests/ID` o `/admin/requests/edit/ID`.

Para retomarlo desde otra computadora, abrir la misma ruta con la misma cuenta después de que el aviso indique que está sincronizado. Los cambios sin conexión permanecen en ese navegador hasta poder sincronizar. Se reintenta al recuperar conexión, volver a la página y cada 30 segundos. La sesión vencida no borra el contenido. Los conflictos entre dispositivos requieren elegir qué versión conservar.

Estos borradores automáticos son independientes del estado Borrador de los requerimientos ya registrados. No generan solicitudes, correos, notificaciones ni movimientos de inventario. Guardar mantiene las validaciones habituales. Eliminar un ítem durante la edición modifica primero el formulario y se aplica al servidor al pulsar Guardar.

Si la creación devuelve un identificador y falla después al guardar ítems o planificación, ese identificador queda en el borrador para retomar el mismo requerimiento. El reintento consulta los ítems y trabajadores realmente persistidos. Si se pierde la respuesta inicial antes de recibir el identificador, el flujo existente no garantiza idempotencia: revisar la lista de requerimientos antes de repetir la creación.

El borrador automático se limpia después de guardar todos los datos. Si falla el correo después de guardar, el requerimiento continúa registrado y el usuario vuelve a su edición/listado para reintentar el envío. Nunca se envía correo desde el autoguardado. Las claves globales antiguas (`selectedElements`, `selectedElementRequest`, etc.) ya no se leen ni se escriben desde estos formularios; no se importan automáticamente porque no identifican al usuario que las creó.

## Despliegue

Publicar primero el backend y ejecutar en `~/backend-epp-gava`, siguiendo el procedimiento habitual de respaldo e instalación de dependencias:

```sh
npm run prisma:migrate:deploy
npm run build
```

Reiniciar el proceso backend y publicar el frontend compilado con `npm run build`. La migración `20260918010000_request_form_drafts` crea `RequestFormDraft`; si aún está pendiente la migración de órdenes de compra, el comando aplicará ambas.

GET y PUT `/request-form-draft/:slot` requieren sesión y permisos `requests.view` y `requests.manage`. `slot` acepta `new`, `project-ID` o el identificador de un requerimiento propio. Las revisiones previenen sobrescrituras; la limpieza conserva una marca con contenido nulo. El tamaño máximo del contenido es 64 KB. Los requerimientos enviados ya no aceptan modificaciones de borrador, pero permiten completar su limpieza.

## Pruebas

```sh
# Backend
npm test -- request-form-draft.spec.ts purchase-order-draft.spec.ts --runInBand
# Frontend
npm run test:drafts
npm run build
```

Prueba manual: escribir descripción antes de elegir proyecto, recargar y comprobar recuperación; agregar cantidades/notas y planificación, perder conexión, volver a conectar y comprobar sincronización; abrir la misma ruta en otro navegador y verificar conflictos. Un fallo al guardar ítems debe conservar el borrador. Un fallo de correo posterior al guardado debe conservar el requerimiento registrado.
