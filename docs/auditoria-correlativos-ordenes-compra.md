# Auditoría de correlativos de órdenes de compra

Fecha: 21 de septiembre de 2026. Alcance: código local, historial Git y pruebas con dependencias simuladas. No se consultó ni modificó la base del VPS. El grafo MCP no respondió (Transport closed); se revisaron directamente los archivos y referencias del código.

## Hallazgos confirmados

1. **El directorio no incluye proyectos eliminados.** `PurchaseOrderService.findDirectory` filtra `project.deletedAt = null`. `ProjectService.remove` marca el proyecto como eliminado, pero conserva sus órdenes. `formatedCode` incluye esas órdenes al calcular el máximo anual. Esto produce huecos aparentes en «Ver todas».
2. **Eliminar una orden borra su número del inventario de órdenes.** `PurchaseOrderService.remove` elimina físicamente la orden y sus notificaciones. Los recursos tienen eliminación en cascada. No hay una marca de anulación que conserve el número mediante este flujo. La cancelación de estado, en cambio, conserva la orden y aparece en el directorio. Eliminar un número intermedio deja un hueco; eliminar el máximo incluso permite reutilizarlo mediante `max + 1`.
3. **Creación parcial y reintentos.** `create` inserta la cabecera, calcula y actualiza su código y luego espera la notificación, sin una transacción que abarque esos pasos. Si la notificación falla, la petición falla aunque la orden ya exista. El formulario crea los recursos en peticiones posteriores; un fallo conserva la cabecera, habilita reintentar y vuelve a ejecutar POST sin reutilizar el identificador anterior. Esto consume números en órdenes adicionales/incompletas; por sí solo no los oculta del directorio. Si esas órdenes se eliminan posteriormente, quedan huecos.
4. **Duplicación no atómica.** `duplicate` crea cabecera, actualiza código y copia recursos en operaciones separadas. Un fallo posterior puede dejar una copia con número asignado y sin todos sus recursos. Un reintento crea otra copia.
5. **Correlativo sin exclusión mutua.** `formatedCode` lee el máximo y suma uno, sin bloqueo transaccional. Dos peticiones simultáneas pueden calcular el mismo número. La restricción única está en el código completo, no en el par año/correlativo: proyectos o proveedores distintos permiten códigos diferentes con el mismo correlativo. Es un defecto de duplicación; no demuestra por sí solo la causa de los huecos denunciados.
6. **El orden visual es por creación, no por correlativo.** El directorio ordena por `createdAt DESC, purchaseOrderId DESC`. La ausencia de un número entre dos filas no prueba su ausencia en el conjunto. El buscador no genera ni modifica códigos.

## Flujos descartados o contexto histórico

- El autoguardado escribe en `PurchaseOrderDraft`; no crea órdenes ni reserva correlativos.
- La edición actual descarta el campo `code` recibido: no renumera órdenes. Los cambios de estado tampoco generan correlativos.
- Consultar el directorio, el dashboard o generar el PDF no llama al generador de códigos.
- El generador actual utiliza el máximo anual más uno y no rellena huecos históricos.
- Antes del commit `f67782e` (18 de marzo de 2026), el número visible se basaba en `purchaseOrderId`. Los IDs de PostgreSQL pueden tener huecos tras fallos o borrados. La fecha del commit no confirma cuándo se desplegó en producción.
- El commit `e58016b` (7 de septiembre de 2026) preserva el código completo al editar. No prueba que los números señalados se hayan perdido por una edición anterior.

## Verificación realizada

Se ejecutaron los métodos reales del servicio transpiliado con Prisma y notificaciones simulados, sin conexión a base de datos:

- fallo de notificación: la orden 001 permanece y el reintento crea 002;
- máximo 186 con 185 ausente: el siguiente es 187;
- dos cálculos concurrentes: ambos obtienen 187 para códigos completos distintos;
- orden 186 asociada a proyecto eliminado: desaparece del directorio pero cuenta para el siguiente número.

## Cómo identificar los números denunciados

Ejecutar desde el backend del VPS, tras copiar el script:

```bash
cd ~/backend-epp-gava
node scripts/audit-purchase-order-sequences.cjs 2026
```

El script inicia una transacción READ ONLY, consulta órdenes de todos los proyectos y termina con ROLLBACK. No renumera, restaura, elimina ni actualiza datos. Clasifica 185, 192, 211–219 y 221 como existentes, ocultos por proyecto eliminado o no encontrados. También muestra correlativos repetidos, códigos sin formato y órdenes sin ítems. Una orden sin ítems no demuestra por sí sola un fallo.

«No encontrado» no significa automáticamente «eliminado»: para atribuir un borrado o una modificación histórica se necesitan logs o respaldos. El proceso de eliminación también borra notificaciones, por lo que estas no constituyen un historial completo.

## Correcciones recomendadas tras contrastar datos

1. Conservar números emitidos mediante anulación o eliminación lógica, con motivo y auditoría; no renumerar ni rellenar huecos automáticamente.
2. Asignar el correlativo anual con bloqueo/contador transaccional y unicidad por año y número, tras auditar duplicados existentes.
3. Guardar cabecera, código y recursos de creación/duplicación en una sola transacción; hacer idempotentes los reintentos y separar los fallos de notificación del resultado del guardado.
4. Ofrecer un historial explícito que incluya órdenes de proyectos eliminados, con su estado y navegación adecuada. No basta con quitar el filtro si las vistas del proyecto impiden consultarlo.

La auditoría no modifica el comportamiento de producción. Para los números concretos, la causa permanece pendiente de contrastar con el resultado del script del VPS.
