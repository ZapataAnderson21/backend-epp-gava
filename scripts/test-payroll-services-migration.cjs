const { Client } = require('pg');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
require('dotenv').config({ quiet: true });

// Isolated disposable schema: never migrates or edits application tables.
async function main() {
  const url = process.env.DATABASE_URL;
  if (
    !url ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)
  ) {
    throw new Error('This test only runs against a local PostgreSQL server.');
  }
  const schema = `payroll_services_test_${process.pid}_${Date.now()}`;
  if (!/^payroll_services_test_\d+_\d+$/.test(schema))
    throw new Error('Unsafe test schema');
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 4000,
  });
  let created = false;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(`
      CREATE TABLE "Project" ("projectId" INT PRIMARY KEY);
      CREATE TABLE "GeneralPayroll" ("generalPayrollId" INT PRIMARY KEY);
      CREATE TABLE "GeneralPayrollProject" (
        "generalPayrollProjectId" SERIAL PRIMARY KEY,
        "generalPayrollId" INT NOT NULL REFERENCES "GeneralPayroll" ON DELETE CASCADE,
        "projectId" INT NOT NULL REFERENCES "Project" ON DELETE RESTRICT,
        UNIQUE ("generalPayrollId", "projectId")
      );
      INSERT INTO "Project" VALUES (3);
      INSERT INTO "GeneralPayroll" VALUES (1), (2);
      INSERT INTO "GeneralPayrollProject" ("generalPayrollId", "projectId") VALUES (1,3);
    `);
    await client.query(
      readFileSync(
        'prisma/migrations/20260909120000_payroll_services_location/migration.sql',
        'utf8',
      ),
    );
    const previous = (
      await client.query('SELECT * FROM "GeneralPayrollProject"')
    ).rows[0];
    assert.equal(previous.projectId, 3);
    assert.equal(previous.locationType, 'project');
    await client.query(
      `INSERT INTO "GeneralPayrollProject" ("generalPayrollId", "projectId", "locationType") VALUES (1,NULL,'services'), (2,NULL,'services')`,
    );
    for (const [values, code] of [
      ["(1,NULL,'services')", '23505'],
      ["(2,3,'services')", '23514'],
      ["(2,NULL,'project')", '23514'],
    ]) {
      await assert.rejects(
        client.query(
          `INSERT INTO "GeneralPayrollProject" ("generalPayrollId", "projectId", "locationType") VALUES ${values}`,
        ),
        (error) => error.code === code,
      );
    }
    assert.equal(
      (await client.query('SELECT count(*)::int AS n FROM "Project"')).rows[0]
        .n,
      1,
    );
    await client.query(
      'DELETE FROM "GeneralPayroll" WHERE "generalPayrollId"=2',
    );
    assert.equal(
      (
        await client.query(
          'SELECT count(*)::int AS n FROM "GeneralPayrollProject" WHERE "generalPayrollId"=2',
        )
      ).rows[0].n,
      0,
    );
    console.log(
      'PASS: existing projects preserved; independent Services; one Services/week; relation constraints and cascade.',
    );
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    if (created) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
