#!/usr/bin/env node

require('dotenv/config');

const fs = require('node:fs');
const pg = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const {
  ExpiringDocumentHistoryAction,
  PrismaClient,
} = require('../src/generated/prisma');

const SOURCE_LABEL = 'Relación de Emos - GAVA CYC (personal de obra).xlsx';
const CATEGORY_NAME = 'EMO';
const SHARED_FIELDS = Object.freeze({
  referenceType: 'Trabajador',
  referenceDescription: 'Emo de Trabajador',
  storageSpace: 'Local',
  storagePath: 'Relación de Emos - GAVA CYC(personal de obra)',
  storageDescription: 'Excel compartido por Rosa',
  notes: null,
});

const EMOS = Object.freeze([
  { title: 'ALVARADO DOMINGUEZ, ESTRELLITA DEL CARMEN', documentCode: '73706996', issueDate: '2026-05-26', expirationDate: '2027-05-26' },
  { title: 'ARBAÑIL HERNANDEZ, VICTOR MANUEL', documentCode: '47290648', issueDate: '2026-04-25', expirationDate: '2027-04-25' },
  { title: 'ATOCHE UBILLUS FREDI', documentCode: '16684517', issueDate: '2026-06-04', expirationDate: '2027-06-04' },
  { title: 'BUSTAMANTE CORNEJO JHONATAN', documentCode: '74362979', issueDate: '2025-08-25', expirationDate: '2026-08-25' },
  { title: 'CASTILLO CASTRO EDWIN', documentCode: '60458910', issueDate: '2026-05-29', expirationDate: '2027-05-29' },
  { title: 'CASTRO MARTINEZ JOSE ORLANDO', documentCode: '06208632', issueDate: '2025-10-20', expirationDate: '2026-10-19' },
  { title: 'CERCADO QUIROZ ROLANDO', documentCode: '16763026', issueDate: '2026-01-13', expirationDate: '2027-01-13' },
  { title: 'DIAZ ITURREGUI, EDER ALONSO', documentCode: '45944232', issueDate: '2026-06-03', expirationDate: '2027-06-03' },
  { title: 'ELIAS VILLEGAS ENZO', documentCode: '73897965', issueDate: '2026-07-27', expirationDate: '2027-07-27' },
  { title: 'GARCIA CORONADO, JORGE LUIS', documentCode: '73491670', issueDate: '2026-05-02', expirationDate: '2027-05-02' },
  { title: 'GAYOSO VALDERA HENRRY', documentCode: '16689896', issueDate: '2026-07-02', expirationDate: '2027-07-02' },
  { title: 'GONZALES DAMIAN ROSA', documentCode: '75047688', issueDate: '2026-05-18', expirationDate: '2027-05-18' },
  { title: 'GUEVARA CARRANZA, JORDY JAIRO', documentCode: '48775025', issueDate: '2026-06-22', expirationDate: '2027-06-22' },
  { title: 'HERRERA CORONADO ERWIN STALIN', documentCode: '46620689', issueDate: '2025-09-29', expirationDate: '2026-09-29' },
  { title: 'HUAMAN RUIZ VILMER', documentCode: '25747762', issueDate: '2026-05-04', expirationDate: '2027-05-04' },
  { title: 'INGA MACALUPU, VICTOR ALEXANDER', documentCode: '76351031', issueDate: '2026-05-29', expirationDate: '2027-05-29' },
  { title: 'JULCA FERNANDEZ, ALADINO', documentCode: '47184659', issueDate: '2025-11-29', expirationDate: '2026-11-29' },
  { title: 'LEYTON CACHAY PERCY', documentCode: '76690983', issueDate: '2026-06-26', expirationDate: '2027-06-26' },
  { title: 'LLAMOCTANTA ALTAMIRANO YOBER', documentCode: '74554741', issueDate: '2025-11-24', expirationDate: '2026-11-24' },
  { title: 'LLANOS LLAMO, KEVIN MICHELL', documentCode: '72470949', issueDate: '2025-08-25', expirationDate: '2026-08-25' },
  { title: 'LLONTOP RODRIGUEZ MIGUEL', documentCode: '16804811', issueDate: '2025-11-10', expirationDate: '2026-11-10' },
  { title: 'MACALUPU CHUQUIMANGO FABRIZIO DANIEL', documentCode: '73006462', issueDate: '2025-11-10', expirationDate: '2026-11-10' },
  { title: 'MIÑOPE ALARCON, JUNIOR NICOLAS', documentCode: '75480245', issueDate: '2026-07-25', expirationDate: '2027-07-25' },
  { title: 'OCHOA BENAVIDES, JHON OMAR', documentCode: '47284139', issueDate: '2025-12-03', expirationDate: '2026-12-03' },
  { title: 'OCHOA MARIN ANGELO', documentCode: '76740512', issueDate: '2025-10-20', expirationDate: '2026-10-19' },
  { title: 'OLIVOS DURAND EDGAR', documentCode: '44083083', issueDate: '2026-07-27', expirationDate: '2027-07-27' },
  { title: 'QUIROZ MONTALVAN LUIS ENRIQUE', documentCode: '42002267', issueDate: '2025-10-20', expirationDate: '2026-10-20' },
  { title: 'ROJAS DELGADO, FABIO MAURICIO', documentCode: '72727502', issueDate: '2026-07-11', expirationDate: '2027-07-11' },
  { title: 'ROMAN CORTEZ APARICIO', documentCode: '42775675', issueDate: '2026-05-18', expirationDate: '2027-05-18' },
  { title: 'SIANCAS TORO JOSÉ', documentCode: '72527072', issueDate: '2025-10-20', expirationDate: '2026-10-20' },
  { title: 'SILVA MENDOZA JOHN', documentCode: '42598792', issueDate: '2026-07-27', expirationDate: '2027-07-27' },
  { title: 'TEJADA SANDOVAL ELMER', documentCode: '16734858', issueDate: '2026-01-13', expirationDate: '2027-01-13' },
  { title: 'TEJADA SANDOVAL WALTER', documentCode: '16774775', issueDate: '2025-05-17', expirationDate: '2026-05-17' },
  { title: 'YAMUNAQUE CASTRO, EMERSON LEAO', documentCode: '60529602', issueDate: '2025-12-02', expirationDate: '2026-12-02' },
]);

const documentInclude = {
  category: true,
  createdBy: { select: { userId: true, name: true, lastName: true } },
  updatedBy: { select: { userId: true, name: true, lastName: true } },
};

function showHelp() {
  console.log(`
Uso:
  node scripts/seed-emos-personal-obra-once.cjs [--user-id <id>]
  node scripts/seed-emos-personal-obra-once.cjs --dry-run [--user-id <id>]
  node scripts/seed-emos-personal-obra-once.cjs --validate-only

Comportamiento:
  - Crea o actualiza ${EMOS.length} documentos de categoría EMO.
  - Fuerza almacenamiento Local y replica los campos comunes de la captura.
  - Ejecuta toda la carga en una sola transacción.
  - Se elimina a sí misma únicamente después de una carga confirmada.
  - --dry-run consulta la base de datos, pero no escribe ni elimina el archivo.
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const userIndex = args.indexOf('--user-id');
  const userId = userIndex >= 0 ? Number(args[userIndex + 1]) : null;
  if (userIndex >= 0 && (!Number.isInteger(userId) || userId <= 0)) {
    throw new Error('--user-id requiere un entero positivo.');
  }
  return {
    dryRun: args.includes('--dry-run'),
    validateOnly: args.includes('--validate-only'),
    help: args.includes('--help') || args.includes('-h'),
    userId,
  };
}

function dateOnly(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function validateRecords() {
  const codes = new Set();
  for (const record of EMOS) {
    if (!record.title || !/^\d{8}$/.test(record.documentCode)) {
      throw new Error(`Registro inválido: ${JSON.stringify(record)}`);
    }
    if (codes.has(record.documentCode)) {
      throw new Error(`DNI duplicado en la seed: ${record.documentCode}`);
    }
    codes.add(record.documentCode);
    const issueDate = dateOnly(record.issueDate);
    const expirationDate = dateOnly(record.expirationDate);
    if (Number.isNaN(issueDate.getTime()) || Number.isNaN(expirationDate.getTime())) {
      throw new Error(`Fecha inválida para DNI ${record.documentCode}.`);
    }
    if (issueDate > expirationDate) {
      throw new Error(`La emisión supera el vencimiento para DNI ${record.documentCode}.`);
    }
  }
}

async function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en el entorno o en .env.');
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return { prisma: new PrismaClient({ adapter }), pool };
}

async function findCategory(prisma) {
  return prisma.expiringDocumentCategory.findUnique({ where: { name: CATEGORY_NAME } });
}

async function ensureCategory(tx) {
  return tx.expiringDocumentCategory.upsert({
    where: { name: CATEGORY_NAME },
    update: { deletedAt: null },
    create: {
      name: CATEGORY_NAME,
      description: 'Examen Médico Ocupacional de trabajadores.',
    },
  });
}

async function resolveActor(prisma, requestedUserId, categoryId) {
  if (requestedUserId) {
    const requested = await prisma.user.findFirst({
      where: { userId: requestedUserId, deletedAt: null },
      select: { userId: true, name: true, lastName: true },
    });
    if (!requested) throw new Error(`No existe un usuario activo con id ${requestedUserId}.`);
    return requested;
  }

  if (categoryId) {
    const previous = await prisma.expiringDocument.findFirst({
      where: { categoryId },
      orderBy: { expiringDocumentId: 'asc' },
      select: { updatedBy: { select: { userId: true, name: true, lastName: true } } },
    });
    if (previous?.updatedBy) return previous.updatedBy;
  }

  const privileged = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      userUserTypes: {
        some: { userType: { name: { in: ['GERENTE', 'ADMINISTRADOR', 'ADMINISTRADORA'] } } },
      },
    },
    orderBy: { userId: 'asc' },
    select: { userId: true, name: true, lastName: true },
  });
  if (privileged) return privileged;

  const fallback = await prisma.user.findFirst({
    where: { deletedAt: null },
    orderBy: { userId: 'asc' },
    select: { userId: true, name: true, lastName: true },
  });
  if (!fallback) throw new Error('No existe un usuario activo para atribuir la carga.');
  return fallback;
}

function codeCandidates(documentCode) {
  const withoutLeadingZeros = documentCode.replace(/^0+/, '');
  return withoutLeadingZeros === documentCode
    ? [documentCode]
    : [documentCode, withoutLeadingZeros];
}

async function findExisting(client, categoryId, record) {
  const matches = await client.expiringDocument.findMany({
    where: {
      categoryId,
      OR: [
        { documentCode: { in: codeCandidates(record.documentCode) } },
        { title: { equals: record.title, mode: 'insensitive' } },
      ],
    },
    orderBy: { expiringDocumentId: 'asc' },
  });
  if (matches.length > 1) {
    throw new Error(
      `Hay ${matches.length} documentos EMO que coinciden con ${record.documentCode} / ${record.title}. Corrija los duplicados antes de ejecutar la seed.`,
    );
  }
  return matches[0] || null;
}

function documentData(record, categoryId, actorId) {
  return {
    categoryId,
    title: record.title,
    documentCode: record.documentCode,
    ...SHARED_FIELDS,
    issueDate: dateOnly(record.issueDate),
    expirationDate: dateOnly(record.expirationDate),
    updatedByUserId: actorId,
    deletedAt: null,
  };
}

function comparable(document) {
  return JSON.stringify({
    title: document.title,
    documentCode: document.documentCode,
    referenceType: document.referenceType,
    referenceDescription: document.referenceDescription,
    storageSpace: document.storageSpace,
    storagePath: document.storagePath,
    storageDescription: document.storageDescription,
    issueDate: document.issueDate?.toISOString().slice(0, 10) || null,
    expirationDate: document.expirationDate.toISOString().slice(0, 10),
    notes: document.notes,
    deletedAt: document.deletedAt,
  });
}

function targetComparable(record) {
  return JSON.stringify({
    title: record.title,
    documentCode: record.documentCode,
    referenceType: SHARED_FIELDS.referenceType,
    referenceDescription: SHARED_FIELDS.referenceDescription,
    storageSpace: SHARED_FIELDS.storageSpace,
    storagePath: SHARED_FIELDS.storagePath,
    storageDescription: SHARED_FIELDS.storageDescription,
    issueDate: record.issueDate,
    expirationDate: record.expirationDate,
    notes: SHARED_FIELDS.notes,
    deletedAt: null,
  });
}

async function planImport(prisma, category) {
  const plan = { create: 0, update: 0, unchanged: 0 };
  if (!category) {
    plan.create = EMOS.length;
    return plan;
  }
  for (const record of EMOS) {
    const existing = await findExisting(prisma, category.expiringDocumentCategoryId, record);
    if (!existing) plan.create += 1;
    else if (comparable(existing) === targetComparable(record)) plan.unchanged += 1;
    else plan.update += 1;
  }
  return plan;
}

async function importEmos(prisma, actorId) {
  return prisma.$transaction(async (tx) => {
    const category = await ensureCategory(tx);
    const result = { created: 0, updated: 0, unchanged: 0 };

    for (const record of EMOS) {
      const existing = await findExisting(tx, category.expiringDocumentCategoryId, record);
      if (existing && comparable(existing) === targetComparable(record)) {
        result.unchanged += 1;
        continue;
      }

      const document = existing
        ? await tx.expiringDocument.update({
            where: { expiringDocumentId: existing.expiringDocumentId },
            data: documentData(record, category.expiringDocumentCategoryId, actorId),
            include: documentInclude,
          })
        : await tx.expiringDocument.create({
            data: {
              ...documentData(record, category.expiringDocumentCategoryId, actorId),
              createdByUserId: actorId,
            },
            include: documentInclude,
          });

      await tx.expiringDocumentHistory.create({
        data: {
          expiringDocumentId: document.expiringDocumentId,
          changedByUserId: actorId,
          action: existing
            ? ExpiringDocumentHistoryAction.updated
            : ExpiringDocumentHistoryAction.created,
          snapshot: JSON.parse(JSON.stringify(document)),
        },
      });
      if (existing) result.updated += 1;
      else result.created += 1;
    }
    return result;
  }, { timeout: 60_000 });
}

function destroySelf() {
  fs.unlinkSync(__filename);
  console.log(`Seed autodestruida: ${__filename}`);
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    showHelp();
    return;
  }

  validateRecords();
  console.log(`Fuente: ${SOURCE_LABEL}`);
  console.log(`Registros validados: ${EMOS.length}`);
  console.log(`Campos comunes: ${JSON.stringify(SHARED_FIELDS)}`);

  if (options.validateOnly) {
    console.log('Validación local completada. No se consultó la base de datos.');
    return;
  }

  let prisma;
  let pool;
  let completed = false;
  try {
    ({ prisma, pool } = await createPrismaClient());
    const currentCategory = await findCategory(prisma);
    const actor = await resolveActor(
      prisma,
      options.userId,
      currentCategory?.expiringDocumentCategoryId,
    );
    console.log(`Usuario de auditoría: ${actor.userId} - ${actor.name} ${actor.lastName}`);

    if (options.dryRun) {
      const plan = await planImport(prisma, currentCategory);
      console.log(`Dry run: crear=${plan.create}, actualizar=${plan.update}, sin cambios=${plan.unchanged}.`);
      return;
    }

    const result = await importEmos(prisma, actor.userId);
    completed = true;
    console.log(`Carga completada: creados=${result.created}, actualizados=${result.updated}, sin cambios=${result.unchanged}.`);
  } finally {
    if (prisma) await prisma.$disconnect();
    if (pool) await pool.end();
  }

  if (completed) destroySelf();
}

main().catch((error) => {
  console.error('\nNo se cargaron los EMO:');
  console.error(error);
  process.exitCode = 1;
});
