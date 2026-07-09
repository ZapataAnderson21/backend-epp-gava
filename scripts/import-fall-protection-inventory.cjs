#!/usr/bin/env node

require('dotenv/config');

const path = require('node:path');
const ExcelJS = require('exceljs');

const REQUIRED_ROLES = [
  'harness',
  'anchorBand',
  'lifeline',
  'positioningLanyard',
];

const ROLE_LABELS = {
  harness: 'Arnes',
  anchorBand: 'Banda de Anclaje',
  lifeline: 'Linea de Vida',
  positioningLanyard: 'Eslinga de posicionamiento',
};

function showHelp() {
  console.log(`
Uso:
  node scripts/import-fall-protection-inventory.cjs <archivo.xlsx> [--dry-run]

Ejemplos:
  node scripts/import-fall-protection-inventory.cjs ./imports/Inventario-de-Arnes-2026.xlsx --dry-run
  node scripts/import-fall-protection-inventory.cjs ./imports/Inventario-de-Arnes-2026.xlsx

Notas:
  - Lee el formato del Excel "Inventario de Arnes - 2026".
  - Crea/actualiza elementos EPA por codigo.
  - Crea/actualiza grupos EPA por codigo general del arnes.
  - Los grupos incompletos se omiten y se reportan como advertencia.
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const help = args.includes('--help') || args.includes('-h');
  const fileArg = args.find((arg) => !arg.startsWith('--'));

  return { dryRun, fileArg, help };
}

function cellText(row, columnNumber) {
  const value = row.getCell(columnNumber).value;

  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object') {
    if (value.text) {
      return String(value.text).trim();
    }
    if (value.richText) {
      return value.richText.map((part) => part.text || '').join('').trim();
    }
    if (value.result !== undefined && value.result !== null) {
      return String(value.result).trim();
    }
    if (value instanceof Date) {
      return String(value.getUTCFullYear());
    }
  }

  return String(value).trim();
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function optionalText(value) {
  const text = String(value || '').trim();
  if (!text || ['__', '-', 'n/a', 'na'].includes(text.toLowerCase())) {
    return null;
  }
  return text;
}

function parseDateCell(row, columnNumber) {
  const value = row.getCell(columnNumber).value;

  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  if (typeof value === 'object' && value.result !== undefined) {
    return parseDateValue(value.result);
  }

  return parseDateValue(value);
}

function parseDateValue(value) {
  const text = String(value || '').trim();
  if (!text || ['__', '-', 'n/a', 'na'].includes(text.toLowerCase())) {
    return null;
  }

  if (/^\d{4}$/.test(text)) {
    return new Date(Date.UTC(Number(text), 0, 1));
  }

  const dateParts = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dateParts) {
    const day = Number(dateParts[1]);
    const month = Number(dateParts[2]) - 1;
    const year = Number(dateParts[3].length === 2 ? `20${dateParts[3]}` : dateParts[3]);
    return new Date(Date.UTC(year, month, day));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function detectRole(description) {
  const normalized = normalizeText(description);

  if (normalized.includes('arnes')) {
    return 'harness';
  }
  if (normalized.includes('banda')) {
    return 'anchorBand';
  }
  if (normalized.includes('linea')) {
    return 'lifeline';
  }
  if (normalized.includes('eslinga')) {
    return 'positioningLanyard';
  }

  return null;
}

function normalizeOperationalStatus(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return 'operativo';
  }
  if (normalized.includes('inoper')) {
    return 'inoperativo';
  }
  return 'operativo';
}

function normalizeCode(value) {
  const text = optionalText(value);
  return text ? text.toUpperCase() : null;
}

function splitCodes(value) {
  const text = optionalText(value);
  if (!text) {
    return [];
  }

  return text
    .split(/\s+-\s+|[,;\n/]+/)
    .map((code) => normalizeCode(code))
    .filter(Boolean);
}

function uniqueComponents(components) {
  const seen = new Set();
  return components.filter((component) => {
    const key = `${component.role}:${component.code}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

async function readWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet('Hoja1') || workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('El archivo no contiene hojas.');
  }

  return worksheet;
}

function parseGroups(worksheet) {
  const groups = [];
  const warnings = [];
  let currentGroup = null;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < 4) {
      return;
    }

    const workerName = optionalText(cellText(row, 2));
    const groupCode = normalizeCode(cellText(row, 3));
    const itemDescription = optionalText(cellText(row, 4));
    const itemCodes = splitCodes(cellText(row, 5));
    const startsGroup = Boolean(
      (!currentGroup && (groupCode || workerName)) ||
        (groupCode && currentGroup && groupCode !== currentGroup.code),
    );

    if (startsGroup) {
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        rowNumber,
        workerName,
        code: groupCode || itemCodes[0],
        components: [],
      };
    }

    if (!currentGroup && (itemDescription || itemCodes.length > 0)) {
      currentGroup = {
        rowNumber,
        workerName: null,
        code: groupCode || itemCodes[0],
        components: [],
      };
      warnings.push(`Fila ${rowNumber}: componente sin encabezado de grupo; se usara su propio codigo como grupo.`);
    }

    if (!currentGroup || (!itemDescription && itemCodes.length === 0)) {
      return;
    }

    const role = detectRole(itemDescription);
    if (!role) {
      warnings.push(`Fila ${rowNumber}: no se pudo reconocer el tipo de componente "${itemDescription || '(sin descripcion)'}".`);
      return;
    }

    if (itemCodes.length === 0) {
      warnings.push(`Fila ${rowNumber}: componente "${itemDescription}" sin codigo; se omitira.`);
      return;
    }

    for (const itemCode of itemCodes) {
      currentGroup.components.push({
        rowNumber,
        role,
        categoryName: ROLE_LABELS[role],
        name: itemDescription || ROLE_LABELS[role],
        code: itemCode,
        serialNumber: optionalText(cellText(row, 6)),
        brand: optionalText(cellText(row, 7)),
        manufactureDate: parseDateCell(row, 8),
        expirationDate: parseDateCell(row, 9),
        operationalStatus: normalizeOperationalStatus(cellText(row, 10)),
      });
    }
  });

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return {
    groups: groups.map((group) => ({
      ...group,
      components: uniqueComponents(group.components),
    })),
    warnings,
  };
}

function validateGroups(groups) {
  const validGroups = [];
  const warnings = [];

  for (const group of groups) {
    const missing = [];
    for (const role of REQUIRED_ROLES) {
      if (!group.components.some((component) => component.role === role)) {
        missing.push(ROLE_LABELS[role]);
      }
    }

    if (!group.code) {
      warnings.push(`Fila ${group.rowNumber}: grupo sin codigo general; se omitira.`);
      continue;
    }

    if (missing.length > 0) {
      warnings.push(`Grupo ${group.code}: incompleto, faltan ${missing.join(', ')}; se omitira.`);
      continue;
    }

    validGroups.push(group);
  }

  return { validGroups, warnings };
}

function summarizeGroups(groups) {
  const totalComponents = groups.reduce((sum, group) => sum + group.components.length, 0);
  const byRole = Object.fromEntries(REQUIRED_ROLES.map((role) => [role, 0]));

  for (const group of groups) {
    for (const component of group.components) {
      byRole[component.role] += 1;
    }
  }

  return { totalGroups: groups.length, totalComponents, byRole };
}

async function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en el entorno o en .env.');
  }

  const pg = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { PrismaClient } = require('../src/generated/prisma');

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  return { prisma, pool };
}

async function ensureCategory(prisma, name) {
  return prisma.elementCategory.upsert({
    where: { name },
    update: { deletedAt: null },
    create: {
      name,
      description: `Categoria importada para componentes EPA: ${name}.`,
    },
  });
}

async function upsertElement(prisma, component, categoryId) {
  return prisma.element.upsert({
    where: { code: component.code },
    update: {
      name: component.name,
      description: component.name,
      brand: component.brand,
      serialNumber: component.serialNumber,
      operationalStatus: component.operationalStatus,
      manufactureDate: component.manufactureDate,
      expirationDate: component.expirationDate,
      type: 'epp',
      family: 'harness',
      controlType: 'individual',
      elementCategoryId: categoryId,
      deletedAt: null,
    },
    create: {
      name: component.name,
      code: component.code,
      description: component.name,
      brand: component.brand,
      serialNumber: component.serialNumber,
      operationalStatus: component.operationalStatus,
      manufactureDate: component.manufactureDate,
      expirationDate: component.expirationDate,
      type: 'epp',
      family: 'harness',
      controlType: 'individual',
      elementCategoryId: categoryId,
      stockMinimum: 0,
    },
  });
}

function pickLegacyElementId(components, role) {
  const component = components.find((item) => item.role === role);
  if (!component) {
    throw new Error(`No hay componente para el rol ${role}.`);
  }
  return component.elementId;
}

async function upsertGroup(prisma, group, components) {
  const groupData = {
    description: group.workerName
      ? `Importado desde inventario 2026. Trabajador: ${group.workerName}.`
      : 'Importado desde inventario 2026.',
    harnessElementId: pickLegacyElementId(components, 'harness'),
    anchorBandElementId: pickLegacyElementId(components, 'anchorBand'),
    lifelineElementId: pickLegacyElementId(components, 'lifeline'),
    positioningLanyardElementId: pickLegacyElementId(components, 'positioningLanyard'),
    deletedAt: null,
  };

  const existingGroup = await prisma.fallProtectionGroup.findUnique({
    where: { code: group.code },
    select: { fallProtectionGroupId: true },
  });

  if (!existingGroup) {
    await prisma.fallProtectionGroup.create({
      data: {
        code: group.code,
        ...groupData,
        components: {
          create: components.map((component) => ({
            role: component.role,
            elementId: component.elementId,
          })),
        },
      },
    });
    return 'created';
  }

  await prisma.$transaction([
    prisma.fallProtectionGroup.update({
      where: { fallProtectionGroupId: existingGroup.fallProtectionGroupId },
      data: groupData,
    }),
    prisma.fallProtectionGroupComponent.deleteMany({
      where: { fallProtectionGroupId: existingGroup.fallProtectionGroupId },
    }),
    prisma.fallProtectionGroupComponent.createMany({
      data: components.map((component) => ({
        fallProtectionGroupId: existingGroup.fallProtectionGroupId,
        role: component.role,
        elementId: component.elementId,
      })),
      skipDuplicates: true,
    }),
  ]);

  return 'updated';
}

async function importGroups(prisma, groups) {
  const categoryCache = new Map();
  const result = {
    groupsCreated: 0,
    groupsUpdated: 0,
    elementsTouched: 0,
  };

  for (const group of groups) {
    const componentsWithIds = [];

    for (const component of group.components) {
      if (!categoryCache.has(component.categoryName)) {
        const category = await ensureCategory(prisma, component.categoryName);
        categoryCache.set(component.categoryName, category.elementCategoryId);
      }

      const element = await upsertElement(
        prisma,
        component,
        categoryCache.get(component.categoryName),
      );

      componentsWithIds.push({
        ...component,
        elementId: element.elementId,
      });
      result.elementsTouched += 1;
    }

    const groupAction = await upsertGroup(prisma, group, componentsWithIds);
    if (groupAction === 'created') {
      result.groupsCreated += 1;
    } else {
      result.groupsUpdated += 1;
    }
  }

  return result;
}

async function main() {
  const { dryRun, fileArg, help } = parseArgs(process.argv);

  if (help || !fileArg) {
    showHelp();
    process.exit(help ? 0 : 1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const worksheet = await readWorkbook(filePath);
  const { groups, warnings: parseWarnings } = parseGroups(worksheet);
  const { validGroups, warnings: validationWarnings } = validateGroups(groups);
  const warnings = [...parseWarnings, ...validationWarnings];
  const summary = summarizeGroups(validGroups);

  console.log(`Archivo: ${filePath}`);
  console.log(`Grupos validos: ${summary.totalGroups}`);
  console.log(`Componentes validos: ${summary.totalComponents}`);
  console.log(
    `Por rol: arnes=${summary.byRole.harness}, banda=${summary.byRole.anchorBand}, linea=${summary.byRole.lifeline}, eslinga=${summary.byRole.positioningLanyard}`,
  );

  if (warnings.length > 0) {
    console.log('\nAdvertencias:');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (dryRun) {
    console.log('\nDry run: no se realizaron cambios en la base de datos.');
    return;
  }

  let prisma;
  let pool;

  try {
    const client = await createPrismaClient();
    prisma = client.prisma;
    pool = client.pool;

    const result = await importGroups(prisma, validGroups);
    console.log('\nImportacion completada:');
    console.log(`- Elementos creados/actualizados: ${result.elementsTouched}`);
    console.log(`- Grupos creados: ${result.groupsCreated}`);
    console.log(`- Grupos actualizados: ${result.groupsUpdated}`);
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (pool) {
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error('\nError al importar inventario EPA:');
  console.error(error);
  process.exit(1);
});
