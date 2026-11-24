# Matriz de clasificación — Fase 5

No se consultó una base de datos porque no se identificó un entorno PostgreSQL
local aislado y autorizado. Las cantidades quedan pendientes de un inventario
seguro previo a cualquier reclasificación futura.

| Familia histórica | Área/propuesta | Cantidad | Relaciones preservadas | Tratamiento en Fase 5 | Riesgo / intervención |
|---|---|---:|---|---|---|
| `uniform` | Recursos SSOMA / Ropa de Trabajo | No consultada | Requerimientos, stock, movimientos, asignaciones | Agrupación visual; sin actualización de datos | Bajo; validar nomenclatura empresarial |
| `epp` | Recursos SSOMA / EPP | No consultada | Requerimientos, stock, movimientos, asignaciones | Agrupación visual; sin actualización de datos | Bajo |
| `epi` | Recursos SSOMA / EPP | No consultada | Requerimientos, activos/asignaciones individuales | Agrupación visual conjunta; conserva reglas EPI | Bajo; no fusionar valores persistentes |
| `ese` | Recursos SSOMA / Equipos de Seguridad | No consultada | Categorías, activos, movimientos y devoluciones | Se conserva; nuevos registros distinguen control consumible/no consumible | Medio; revisar categorías existentes |
| `ssomaSupply` | Pendiente de clasificación empresarial | No consultada | Stock, requerimientos y movimientos | Visible como histórico sin reclasificar | Alto; decidir si cada insumo pertenece a Equipos de Seguridad consumibles |
| `harness` | Pendiente: protección anticaída SSOMA o Arnés Eléctrico | No consultada | Grupos EPA, componentes, activos, asignaciones | Conservación total; no mover a Inventario | Alto; revisión registro por registro |
| `measurement` | Posible Inventario / Equipos Eléctricos | No consultada | Activos, calibración, mantenimiento y movimientos | Visible como histórico sin reclasificar | Alto; no todo equipo de medición es eléctrico |
| `officeMaterial` | Pendiente de clasificación empresarial | No consultada | Stock, requerimientos y movimientos | Visible como histórico sin reclasificar | Alto; destino no aprobado |
| Sin `family` (`operative` legacy) | Pendiente | No consultada | Todas las relaciones existentes | Compatibilidad de lectura; sin reclasificar | Alto; requiere análisis individual |

## Familias nuevas para registros futuros

| Valor interno | Etiqueta | Control inicial | Retorno | Trazabilidad individual |
|---|---|---|---|---|
| `electricalEquipment` | Equipos Eléctricos | `individual` | Sí | Sí |
| `tools` | Herramientas | `individual` | Sí | Sí |
| `ladders` | Escaleras | `individual` | Sí | Sí |
| `materials` | Materiales | `consumable` | No | No |
| `electricalHarness` | Arnés Eléctricos | `individual` | Sí | Sí |

La migración de esta fase solo amplía el enum. No actualiza filas existentes.
