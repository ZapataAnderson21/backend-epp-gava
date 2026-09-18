# Borradores automáticos de órdenes de compra

La creación y edición guardan una copia en el navegador desde el primer cambio. La sincronización al servidor ocurre tras 800 ms sin escribir y se reintenta al recuperar conexión, volver a la página o cada 30 segundos. Una sesión vencida conserva los datos locales; hay que iniciar sesión nuevamente para sincronizarlos.

Se conserva un borrador por usuario, proyecto y orden; `new` identifica la nueva orden de cada proyecto. Para retomarlo en otra computadora, usar la misma cuenta y abrir Nueva orden en el mismo proyecto o editar la misma orden. Es necesario que la primera computadora haya sincronizado los cambios. Los borradores no crean órdenes formales, no emiten notificaciones y no reemplazan la validación de Guardar.

El aviso del formulario distingue guardado local, sincronización, error y conflicto. Si dos sesiones modificaron el mismo borrador, se debe elegir explícitamente la copia local o la del servidor. El borrador se limpia únicamente después de guardar correctamente la cabecera y todos los ítems. Si falla la limpieza remota, la marca local de finalización queda pendiente para reintentar al abrir ese formulario.

## Despliegue

Desplegar primero backend y migración, luego frontend. Con el procedimiento habitual de instalación de dependencias y respaldo de la base, ejecutar en `~/backend-epp-gava`:

```sh
npm run prisma:migrate:deploy
npm run build
```

Reiniciar el backend con el gestor de procesos habitual y publicar la compilación del frontend (`npm run build`). No se ejecuta ninguna migración automáticamente al abrir el formulario. La migración nueva es `20260917120000_purchase_order_drafts`.

La tabla `PurchaseOrderDraft` contiene JSON parcial y una revisión. Al limpiar se conserva una revisión con contenido nulo para rechazar escrituras atrasadas. GET y PUT `/purchase-order-draft/:projectId/:slot` obtienen el usuario exclusivamente de la sesión autenticada y exigen `orders.view`, `orders.manage` y `finance.view`. Las escrituras requieren `expectedVersion`; una revisión diferente devuelve 409. Límite del contenido: 64 KB.

## Verificación

```sh
# Backend
npm test -- purchase-order-draft.spec.ts --runInBand
# Frontend, en su repositorio
npm run test:drafts
npm run build
```

Prueba manual: escribir un dato, recargar, desconectar internet, editar, volver a conectar y comprobar el aviso de sincronización. Abrir la misma ruta en otra computadora con la misma cuenta y verificar recuperación. Modificar desde ambas para comprobar el aviso de conflicto. Un error al guardar la orden debe mantener el borrador.

El guardado formal existente sigue usando solicitudes separadas para cabecera e ítems; este cambio protege el borrador, pero no convierte ese flujo en una transacción única. Si una interrupción ocurre durante ese guardado, revisar la orden que pudo haberse creado antes de volver a crearla.
