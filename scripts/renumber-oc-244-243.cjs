// Ejecutar desde backend-epp-gava. Sin argumentos solo revisa.
// Corrige exclusivamente el correlativo 244 de 2026; conserva referencia y proveedor.
function plan(rows) {
  const byNumber = new Map();
  for (const row of rows) {
    if (!(row.code || '').includes('-2026/')) continue;
    const match = /^No\s+(\d+)-2026\/.+\/[^/]+$/.exec(row.code);
    if (!match) throw new Error(`Formato no reconocido: ${row.code}`);
    const number = Number(match[1]);
    if (byNumber.has(number)) throw new Error(`Correlativo repetido: ${number}`);
    byNumber.set(number, row);
  }
  if ([...byNumber.keys()].some(number => number > 244)) {
    throw new Error('Hay OC posteriores a 244. Se cancela sin modificar ninguna: revisa su numeración antes de continuar.');
  }
  if (byNumber.has(243)) {
    throw new Error('243 ya está ocupado (puede haberse aplicado antes). No se modificó nada.');
  }
  const row = byNumber.get(244);
  if (!row) throw new Error('No existe una OC 244 de 2026. No se modificó nada.');
  return [{
    purchaseOrderId: row.purchaseOrderId,
    before: row.code,
    after: row.code.replace(/^(No\s+)\d+(-2026\/)/, '$1243$2'),
    updatedAt: row.updatedAt,
  }];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && !['--check', '--apply'].includes(args[0]))) {
    throw new Error('Uso: node scripts/renumber-oc-244-243.cjs [--check|--apply]');
  }
  const apply = args[0] === '--apply';
  require('dotenv').config({ quiet: true });
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL. Ejecuta desde la carpeta del backend.');
  const { Client } = require('pg');
  const fs = require('node:fs');
  const path = require('node:path');
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  let commitStarted = false;
  try {
    await db.connect();
    await db.query('BEGIN');
    await db.query("SET LOCAL lock_timeout = '15s'");
    await db.query("SET LOCAL statement_timeout = '30s'");
    // Same lock as creation/duplication; table lock also excludes other writers.
    await db.query('SELECT pg_advisory_xact_lock(20260921, 1)');
    await db.query('LOCK TABLE "PurchaseOrder" IN SHARE ROW EXCLUSIVE MODE');
    const { rows } = await db.query('SELECT "purchaseOrderId", code, "updatedAt" FROM "PurchaseOrder"');
    const edits = plan(rows);
    console.log(JSON.stringify({ mode: apply ? 'APLICAR' : 'REVISAR', cambios: edits, siguienteCorrelativo2026: 244 }, null, 2));
    if (!edits.length || !apply) {
      await db.query('ROLLBACK');
      console.log(edits.length ? 'Revisión correcta. Ejecuta con --apply para aplicar.' : 'El cambio ya está aplicado. No se modificó nada.');
      return;
    }
    const dir = path.resolve('.tmp');
    fs.mkdirSync(dir, { recursive: true });
    const backup = path.join(dir, `oc-244-to-243-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify({ createdAt: new Date().toISOString(), cambios: edits }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(`Respaldo de códigos anteriores: ${backup}`);
    for (const edit of edits) {
      const result = await db.query('UPDATE "PurchaseOrder" SET code = $1, "updatedAt" = NOW() WHERE "purchaseOrderId" = $2 AND code = $3', [edit.after, edit.purchaseOrderId, edit.before]);
      if (result.rowCount !== 1) throw new Error('La orden cambió durante la operación. Se cancelará la transacción.');
    }
    commitStarted = true;
    await db.query('COMMIT');
    console.log('Aplicado: 244 → 243. La próxima creación de 2026 tomará 244 con el backend actual (máximo + 1).');
    console.log('Los IDs y relaciones se conservan. Vuelve a generar los PDF; los archivos descargados y textos históricos no cambian.');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    if (commitStarted) console.error('No se pudo confirmar el resultado del COMMIT. Ejecuta --check antes de reintentar.');
    throw error;
  } finally {
    await db.end();
  }
}

module.exports = { plan };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
