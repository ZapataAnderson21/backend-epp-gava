// Read-only inventory of issued codes. Run from the backend directory.
require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const year = Number(process.argv[2] || 2026);
if (!Number.isInteger(year) || year < 2000 || year > 9999) {
  console.error('Uso: node scripts/audit-purchase-order-sequences.cjs 2026');
  process.exit(1);
}
const targets = [185, 192, 211, 212, 213, 214, 215, 216, 217, 218, 219, 221];
const db = new Client({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    await db.connect();
    await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await db.query("SET LOCAL statement_timeout = '30s'");
    const { rows } = await db.query(`
      SELECT o."purchaseOrderId", o.code, o."projectId", o."createdAt", o."updatedAt",
             o.status, p.name AS proyecto, p."deletedAt" AS "proyectoEliminado",
             s.name AS proveedor,
             (SELECT COUNT(*)::int FROM "ResourcePurchaseOrder" r
              WHERE r."purchaseOrderId" = o."purchaseOrderId") AS items
      FROM "PurchaseOrder" o
      JOIN "Project" p ON p."projectId" = o."projectId"
      JOIN "Supplier" s ON s."supplierId" = o."supplierId"
      ORDER BY o."createdAt", o."purchaseOrderId"
    `);
    await db.query('ROLLBACK');
    const groups = new Map();
    const malformed = [];
    for (const row of rows) {
      const match = /^No\s+(\d+)-(\d{4})\/.+\/[^/]+$/.exec(row.code || '');
      if (!match) { malformed.push(row); continue; }
      if (Number(match[2]) !== year) continue;
      const sequence = Number(match[1]);
      groups.set(sequence, [...(groups.get(sequence) || []), row]);
    }
    const report = {
      year,
      advertencia: 'No encontrado NO demuestra eliminación. Consultar respaldos/logs para reconstruir registros ausentes. No se modifica ningún dato.',
      totalOrdenesConsultadas: rows.length,
      maximoCorrelativo: Math.max(0, ...groups.keys()),
      numerosConsultados: targets.map(number => {
        const orders = groups.get(number) || [];
        return { numero: number, resultado: !orders.length ? 'no_encontrado' : orders.every(o => o.proyectoEliminado) ? 'oculto_por_proyecto_eliminado' : 'existe_en_directorio', ordenes: orders };
      }),
      correlativosRepetidos: [...groups].filter(([, orders]) => orders.length > 1).map(([numero, ordenes]) => ({ numero, ordenes })),
      ocultasPorProyectoEliminado: [...groups.values()].flat().filter(o => o.proyectoEliminado),
      sinItems: [...groups.values()].flat().filter(o => o.items === 0),
      codigosSinFormato: malformed,
    };
    console.log(JSON.stringify(report, null, 2));
  } catch {
    console.error('No se pudo completar la auditoría. Comprueba conexión y permisos de lectura de DATABASE_URL.');
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
