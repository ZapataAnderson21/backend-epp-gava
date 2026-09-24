# Corrección de numeración desde la web

## Publicación

1. Aplicar las migraciones del backend (`npm run prisma:migrate:deploy`), incluida `20260924190000_purchase_order_renumber`.
2. Generar Prisma y compilar/publicar el backend con el procedimiento habitual.
3. Publicar el frontend y recargar las pestañas abiertas.
4. En **Roles y Permisos → Órdenes de compra**, asignar **Corregir numeración** (`orders.renumber`) y/o **Ver historial de numeración** (`orders.renumberHistory`). Ambos requieren `orders.view`. No se conceden automáticamente a ningún rol inicial, ni dependen de `finance.view`.

## Uso

Abrir **Numeración de OC** desde **Todas las órdenes de compra** o desde el detalle de una OC. Seleccionar año, hasta 100 órdenes y el primer número. La selección se ordena por correlativo actual, no por orden de clic. Revisar todos los códigos propuestos, escribir un motivo y confirmar.

Las comprobaciones incluyen todas las OC de ese año y todos los proyectos, también los eliminados. Solo se modifican las seleccionadas. Destinos ocupados por OC ajenas a la selección, formatos desconocidos y correlativos repetidos impiden continuar. Los campos de estado, importes, ítems, IDs y relaciones no se modifican.

La siguiente creación obtiene el máximo anual resultante + 1. Corregir una OC antigua no reduce el máximo si siguen existiendo otras superiores. El borrado mantiene su comportamiento y nunca inicia una corrección automática.

## Integridad y recuperación

La vista previa se guarda en servidor y vence a los 30 minutos. Al confirmar se revalidan los códigos, estados, fechas de modificación y nombres de proyecto/proveedor del año. Cualquier cambio exige una nueva vista previa.

Creación, duplicación, edición y corrección comparten el bloqueo de numeración. La corrección también bloquea escrituras sobre PurchaseOrder durante su transacción. Los códigos temporales permiten desplazar grupos con destinos solapados sin violar la unicidad del código; ningún lector externo ve esos valores antes del commit. Historial y cambios se confirman juntos.

El identificador de la vista previa es también la clave del intento. Repetirlo con el mismo usuario y motivo devuelve el resultado anterior. El navegador conserva el intento en sessionStorage por usuario; permite recuperarlo al recargar o cerrar/reabrir el modal en la misma pestaña. Si se pierde la pestaña/almacenamiento, consultar el historial antes de iniciar otra corrección. La revocación del permiso se aplica a cada solicitud del servidor.

El historial conserva usuario, nombre, fecha, motivo, ID y códigos antes/después. No tiene claves foráneas hacia órdenes o usuarios: permanece después de su eliminación. Solo operaciones aplicadas aparecen en el historial paginado; las vistas previas vencidas no cambian datos y se conservan por ahora.

Las notificaciones históricas y PDF descargados conservan el texto original. Volver a generar y distribuir los PDF afectados tras corregir; las nuevas descargas usan el código vigente.

## Verificación

Pruebas en `renumber.spec.ts`, `purchase-order-code.spec.ts` y pruebas de permisos: selección, conflictos, desplazamiento con códigos únicos, rollback, reintento concurrente, caducidad, cambios desde la vista previa, usuario diferente y permisos independientes. El doble de base de datos simula transacciones y unicidad; no sustituye una prueba de integración PostgreSQL. No aplicar migraciones sobre producción hasta desplegar la versión coordinada.
