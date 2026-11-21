const { createHash } = require('node:crypto');
const { existsSync, readFileSync } = require('node:fs');
const { basename, join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = resolve(__dirname, '..');
const sqlDirectory = join(projectRoot, 'prisma', 'sql');
const prismaCommand = join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);

// Additional deployment SQL must be explicitly reviewed and pinned by SHA-256.
// The official migration chain currently covers every required schema change.
const DEPLOY_SQL_ALLOWLIST = Object.freeze([]);

const forbiddenStatements = Object.freeze([
  { label: 'DELETE', pattern: /\bDELETE\s+FROM\b/i },
  { label: 'TRUNCATE', pattern: /\bTRUNCATE\b/i },
  { label: 'DROP', pattern: /\bDROP\b/i },
  { label: 'dynamic EXECUTE', pattern: /\bEXECUTE\b/i },
  { label: 'CALL', pattern: /\bCALL\s+[a-z_".]/i },
]);

function stripSqlComments(contents) {
  return contents.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
}

function assertSqlIsSafe(fileName, contents) {
  const inspectableSql = stripSqlComments(contents);
  const forbidden = forbiddenStatements.find(({ pattern }) =>
    pattern.test(inspectableSql),
  );

  if (forbidden) {
    throw new Error(
      `El script ${fileName} contiene una sentencia prohibida para despliegue automático: ${forbidden.label}.`,
    );
  }
}

function resolveApprovedSqlFiles() {
  return DEPLOY_SQL_ALLOWLIST.map((entry) => {
    if (
      !entry ||
      typeof entry.fileName !== 'string' ||
      basename(entry.fileName) !== entry.fileName ||
      !entry.fileName.endsWith('.sql') ||
      !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '')
    ) {
      throw new Error('La allowlist SQL contiene una entrada inválida.');
    }

    const absolutePath = join(sqlDirectory, entry.fileName);
    if (!existsSync(absolutePath)) {
      throw new Error(`No existe el script SQL aprobado: ${entry.fileName}.`);
    }

    const contents = readFileSync(absolutePath, 'utf8');
    assertSqlIsSafe(entry.fileName, contents);

    const actualHash = createHash('sha256').update(contents).digest('hex');
    if (actualHash !== entry.sha256) {
      throw new Error(
        `El contenido de ${entry.fileName} no coincide con el SHA-256 aprobado.`,
      );
    }

    return { ...entry, absolutePath };
  });
}

function run(args = process.argv.slice(2)) {
  let approvedFiles;
  try {
    approvedFiles = resolveApprovedSqlFiles();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }

  if (args.includes('--list')) {
    approvedFiles.forEach(({ fileName }) => console.log(fileName));
    return 0;
  }

  if (args.includes('--check')) {
    console.log(
      `${approvedFiles.length} scripts SQL adicionales aprobados para despliegue.`,
    );
    return 0;
  }

  if (approvedFiles.length === 0) {
    console.log(
      'No hay scripts SQL adicionales aprobados; el esquema se gestiona únicamente con Prisma Migrate.',
    );
    return 0;
  }

  if (!existsSync(prismaCommand)) {
    console.error(
      'No se encontró la CLI local de Prisma. Ejecuta npm ci antes de aplicar SQL aprobado.',
    );
    return 1;
  }

  console.log(
    `Ejecutando ${approvedFiles.length} scripts SQL adicionales aprobados.`,
  );

  for (const { fileName } of approvedFiles) {
    const relativeFile = join('prisma', 'sql', fileName);
    console.log(`\n==> ${relativeFile}`);

    const result = spawnSync(
      prismaCommand,
      ['db', 'execute', '--file', relativeFile],
      {
        cwd: projectRoot,
        env: process.env,
        stdio: 'inherit',
        shell: false,
      },
    );

    if (result.error) {
      console.error(
        `No se pudo iniciar Prisma para ${fileName}:`,
        result.error,
      );
      return 1;
    }

    if (result.status !== 0) {
      console.error(`Falló el script ${fileName} con código ${result.status}.`);
      return result.status ?? 1;
    }
  }

  console.log('\nTodos los scripts SQL aprobados finalizaron correctamente.');
  return 0;
}

if (require.main === module) {
  process.exitCode = run();
}

module.exports = {
  DEPLOY_SQL_ALLOWLIST,
  assertSqlIsSafe,
  resolveApprovedSqlFiles,
  run,
};
