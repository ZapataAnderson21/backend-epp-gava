# Auditoría Fase 6 — Requerimientos SSOMA y Ropa de Trabajo

## Reutilización segura

- `Request` conserva estados, proyecto, creador y flujo de atención.
- `RequestType` (`epp`, `operative`, `eppAndOperative`) describe la composición
  legacy y no se reinterpretará como tipo funcional SSOMA.
- `ElementVariant` representa tallas configurables por artículo.
- `OfficeInventoryEntry` representa stock central por elemento y variante.
- `InventoryMovement` permanece como bitácora común de movimientos físicos.
- `Worker` es el padrón único para destinatarios de entregas.

## Desarrollo necesario

- Clasificación nullable `SsomaRequestKind` para preservar requerimientos legacy.
- Entidades específicas de despacho, custodia, entrega y devolución, porque
  `ProjectInventoryEntry` no representa tránsito ni custodia de un PDR.
- Permisos `workClothing.*`; no existe relación directa `User`–`Worker` ni una
  asignación persistente usuario–proyecto.
- El PDR se representa como cuenta `User` autorizada por permisos y se valida
  contra el destinatario del despacho en backend.

## Retirada del inventario por proyecto

- Se conserva `ProjectInventoryEntry` para lectura histórica y bloqueos legacy.
- Se retiran rutas y pantallas operativas del frontend.
- Se bloquea el endpoint que crea nuevas entradas desde requerimientos.
- No se eliminan tablas, movimientos, asignaciones ni relaciones históricas.

## Riesgos y límites

- No existe una base PostgreSQL aislada identificada para contar o migrar datos.
- No se hará backfill de tipos SSOMA ni tallas.
- Las discrepancias de recepción se registran y no acreditan custodia; todavía
  falta un procedimiento empresarial aprobado para resolverlas.
- Las transferencias entre PDR no se automatizan; deben resolverse mediante devolución y nuevo despacho auditados.
- La cadena versionada de `prisma/migrations` no crea `ElementVariant`,
  `OfficeInventoryEntry` ni todos sus prerrequisitos. Esos objetos proceden de
  `prisma/sql/20260427_inventory_schema_sync.sql`; antes de desplegar debe
  comprobarse de forma solo lectura que existen en la base objetivo.
- El catálogo actual no ofrece un flujo completo para crear nuevas tallas
  `ElementVariant`; la recepción central exige una talla para Ropa de Trabajo.

## Resultado de implementación

- Se creó un flujo transaccional separado para despacho, tránsito, recepción, custodia, entrega, anulación y devolución de Ropa de Trabajo.
- Los nuevos requerimientos usan `SsomaRequestKind` y restringen el catálogo a `uniform`, `epp`, `epi` y `ese`; los requerimientos legacy permanecen legibles.
- La recepción con discrepancia queda registrada sin acreditar custodia ni inventar cantidades.
- El stock central solo se incrementa cuando Logística confirma físicamente una devolución.
- La migración `20261118213000_add_ssoma_work_clothing_flow` es aditiva y no fue aplicada a ninguna base de datos.

## Revisión final de migración — 2026-11-19

### Correspondencia Prisma y SQL

- La migración falla de forma explícita si faltan `ElementVariant`,
  `OfficeInventoryEntry`, `ElementRequest.elementVariantId` o los enums legacy
  requeridos. No intenta crear parcialmente el flujo sobre un esquema incompleto.
- Los nombres personalizados de claves, índices y relaciones se reflejan con
  `map` en `schema.prisma`.
- `ElementRequest` y `OfficeInventoryEntry` validan su propia pareja
  `(elementVariantId, elementId)`; la migración se detiene si detecta datos
  legacy incompatibles. Las relaciones de despacho y devolución con almacén
  usan además claves compuestas `(officeInventoryEntryId, elementId,
  elementVariantId)`.
- Las relaciones de talla usan `(elementVariantId, elementId)`, evitando asociar
  una talla perteneciente a otra prenda.
- `SsomaRequestKind` sigue siendo nullable. Los requerimientos históricos no
  necesitan reclasificación.

### Invariantes de cantidad

- Despachos, entregas y devoluciones admiten únicamente unidades enteras y
  positivas en DTO y servicio.
- La recepción admite cero, pero nunca una cantidad negativa, fraccionaria o
  superior a lo despachado.
- Los `CHECK` de PostgreSQL refuerzan esas reglas y garantizan que la custodia
  mantenga valores enteros no negativos y que entregado + en devolución +
  devuelto no supere lo recibido.
- No se agregó un `CHECK` entero global a `OfficeInventoryEntry.currentStock`:
  esa tabla también almacena materiales con cantidades decimales. Para Ropa de
  Trabajo la integralidad se valida en el servicio.

### Stock central, discrepancias e idempotencia

- El ingreso central conserva la talla y consolida contra una entrada existente
  con el mismo `(elementId, elementVariantId)`. Entradas legacy duplicadas no se
  eliminan ni fusionan.
- Un despacho consume una entrada central explícita mediante actualización
  condicional (`currentStock >= quantity`), por lo que nunca deja stock negativo.
  Si el stock está distribuido, cada entrada debe seleccionarse de forma
  explícita; no se hace un descuento agregado oculto.
- Una recepción con discrepancia guarda las cantidades declaradas y el estado,
  pero no acredita saldo al PDR. No existe todavía una operación de resolución;
  el caso queda bloqueado para decisión empresarial.
- `clientRequestId` único, transacciones serializables, guardas de estado y
  actualizaciones condicionales evitan dobles descuentos y saldos negativos.
  Reintentos secuenciales devuelven la operación previa; duplicados estrictamente
  concurrentes pueden recibir conflicto mientras la otra transacción finaliza.

### Autorización

- El destinatario de un despacho debe ser un usuario activo con permiso
  `workClothing.receive` o `workClothing.manage`.
- Un PDR solo confirma despachos destinados a su cuenta y solo entrega o devuelve
  desde saldos cuyo proyecto y custodio coinciden; `workClothing.manage` permite
  la excepción administrativa.
- Confirmar una devolución física requiere `workClothing.return` y capacidad de
  Logística (`workClothing.dispatch` o `workClothing.manage`).
- No existe una relación persistente Usuario–Proyecto; la autorización de proyecto
  se deriva del despacho y del saldo de custodia, no de una membresía separada.

### Estado de validación

- Prisma validate, generación/build NestJS, Jest focalizado de Fase 6 (18/18) y
  ESLint focalizado: correctos.
- Frontend: prueba contractual de Fase 6 (7/7), build Vite y ESLint focalizado:
  correctos.
- La prueba histórica de catálogo de permisos continúa fallando porque compara
  una migración antigua con permisos añadidos en fases posteriores; no se
  modificó la migración histórica para ocultar ese problema del test.
- No se ejecutó PostgreSQL ni navegador: no se identificó una base desechable y
  aislada. La migración no está lista para `requestsgava` hasta auditar los
  prerrequisitos, ensayar la cadena en aislamiento y definir la resolución de
  discrepancias y la configuración de nuevas tallas.
