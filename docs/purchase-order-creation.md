# Guardado completo y reintentos de órdenes de compra

Crear una OC envía una sola petición con cabecera, `items` y `creationKey` (UUID v4). La clave se guarda en el borrador local y se sincroniza al servidor. Tras un fallo de conexión se reutiliza la misma clave. Recursos repetidos se rechazan en frontend y backend, sin consolidarlos automáticamente ni cambiar sus precios.

El backend guarda cabecera, recursos y recibo de creación en una transacción. Un bloqueo asesor transaccional PostgreSQL compartido por creación y duplicación serializa el cálculo de máximo anual + 1. No se renumeran órdenes existentes ni se rellenan huecos. La eliminación mantiene su comportamiento: borra la OC y sus notificaciones. El recibo no tiene FK a la orden para sobrevivir al borrado y evitar recrearla por un reintento antiguo. No contiene los datos completos del formulario, sino usuario, clave, hash e ID de orden.

Misma cuenta y clave con el mismo contenido: recupera la orden. Misma clave con contenido distinto: 409, debe revisarse la orden ya creada antes de aplicar cambios. Si esa orden fue eliminada: 409, no se recrea. Los recibos no expiran automáticamente. Borrar el almacenamiento del navegador y descartar el borrador puede perder la clave; no puede reconocerse un reintento enviado con una clave nueva.

La notificación de creación se intenta después del commit. Si falla se registra el error y el guardado devuelve éxito; no se implementa una cola de reenvío. Un fallo del proceso entre commit y notificación puede dejarla sin enviar. La edición y sus notificaciones mantienen su implementación previa.

Duplicar también guarda cabecera y recursos en una transacción. La clave del intento se conserva localmente por cuenta, origen y destino hasta obtener éxito. Un cambio de computadora solo conserva esta protección para creación cuando el borrador con su clave ya fue sincronizado; la clave de duplicación es local al navegador.

## Despliegue coordinado

1. Aplicar `20260921190000_purchase_order_creation_receipts` con `npm run prisma:migrate:deploy` en el backend antes de activar el código nuevo.
2. Compilar y publicar backend (`npm run build`) y reiniciar el proceso con el procedimiento habitual.
3. Publicar frontend y recargar las pestañas abiertas. `useState<string>` evita el error TS2345 al restaurar el UUID desde el borrador.

El frontend usa la nueva ruta `/purchase-order/complete`: contra un backend antiguo falla sin crear cabeceras parciales. El backend nuevo exige ítems y clave incluso en la ruta raíz anterior; clientes antiguos deben actualizarse. Los intentos realizados antes de este despliegue no tienen recibos y no se deduplican retroactivamente. Revisar las órdenes existentes antes de reintentar un borrador antiguo que ya se hubiera enviado.

## Verificación

`npm test -- purchase-order-creation.spec.ts purchase-order-code.spec.ts --runInBand` comprueba fallo de ítems y rollback, replay, concurrencia, notificación fallida, payload distinto, orden eliminada, recursos repetidos y duplicación. Las transacciones de estas pruebas usan un doble serializado en memoria; no sustituyen una prueba de integración con PostgreSQL. No se ejecutaron migraciones en producción desde esta tarea.
