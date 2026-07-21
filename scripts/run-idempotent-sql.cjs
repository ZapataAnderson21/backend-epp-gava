const { existsSync, readdirSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = resolve(__dirname, '..');
const sqlDirectory = join(projectRoot, 'prisma', 'sql');
const idempotentMarker = '-- @idempotent';
const prismaCommand = join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);

if (!existsSync(prismaCommand)) {
  console.error(
    'No se encontró la CLI local de Prisma. Ejecuta npm ci antes de aplicar los scripts SQL.',
  );
  process.exit(1);
}

const sqlFiles = readdirSync(sqlDirectory)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort((left, right) => left.localeCompare(right));

const idempotentFiles = sqlFiles.filter((fileName) => {
  const contents = readFileSync(join(sqlDirectory, fileName), 'utf8');
  const firstMeaningfulLine = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return firstMeaningfulLine === idempotentMarker;
});

if (idempotentFiles.length === 0) {
  console.error(`No se encontraron scripts con el marcador ${idempotentMarker}.`);
  process.exit(1);
}

if (process.argv.includes('--list')) {
  idempotentFiles.forEach((fileName) => console.log(fileName));
  process.exit(0);
}

console.log(
  `Ejecutando ${idempotentFiles.length} scripts SQL idempotentes en orden alfabético.`,
);

for (const fileName of idempotentFiles) {
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
    console.error(`No se pudo iniciar Prisma para ${fileName}:`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`Falló el script ${fileName} con código ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nTodos los scripts SQL idempotentes finalizaron correctamente.');

