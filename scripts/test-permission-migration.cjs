const { Client } = require('pg');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
require('dotenv').config({ quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('This test only runs against a local PostgreSQL server.');
  const schema = `rbac_test_${process.pid}_${Date.now()}`;
  if (!/^rbac_test_\d+_\d+$/.test(schema)) throw new Error('Unsafe test schema');
  const first = new Client({ connectionString: url, connectionTimeoutMillis: 4000 });
  const second = new Client({ connectionString: url, connectionTimeoutMillis: 4000 });
  let created = false;
  await first.connect();
  try {
    await first.query(`CREATE SCHEMA "${schema}"`); created = true;
    await first.query(`SET search_path TO "${schema}"`);
    await first.query(`CREATE TABLE "UserType" ("userTypeId" INT PRIMARY KEY, name TEXT UNIQUE NOT NULL);
      CREATE TABLE "User" ("userId" INT PRIMARY KEY, "deletedAt" TIMESTAMP);
      CREATE TABLE "UserUserType" ("userUserTypeId" INT PRIMARY KEY, "userId" INT REFERENCES "User", "userTypeId" INT REFERENCES "UserType");
      INSERT INTO "UserType" VALUES (1,'GERENTE'), (2,'LOGISTICA');
      INSERT INTO "User" VALUES (1,NULL), (2,NULL);
      INSERT INTO "UserUserType" VALUES (1,1,1), (2,2,2);`);
    await first.query(readFileSync('prisma/migrations/20260908120000_dynamic_role_permissions/migration.sql','utf8'));
    const roles = (await first.query('SELECT name, permissions FROM "UserType" ORDER BY "userTypeId"')).rows;
    assert(roles[0].permissions.includes('roles.manage'));
    assert(roles[1].permissions.includes('workers.manage'));
    assert(!roles[1].permissions.includes('roles.manage'));
    for (const sql of [
      'UPDATE "UserType" SET permissions=ARRAY[]::text[] WHERE "userTypeId"=1',
      'UPDATE "User" SET "deletedAt"=now() WHERE "userId"=1',
      'DELETE FROM "UserUserType" WHERE "userId"=1',
    ]) {
      await first.query('BEGIN');
      let failed = false;
      try { await first.query(sql); await first.query('COMMIT'); } catch(error) { failed = error.code === '23514'; await first.query('ROLLBACK'); }
      assert(failed, 'Must reject removing the last administrator');
    }
    await first.query(`UPDATE "UserType" SET name='DIRECTOR' WHERE "userTypeId"=1`);
    assert((await first.query('SELECT permissions FROM "UserType" WHERE "userTypeId"=1')).rows[0].permissions.includes('roles.manage'));
    await first.query(`UPDATE "UserType" SET permissions=ARRAY['roles.view','roles.manage'] WHERE "userTypeId"=2`);
    await second.connect();
    await second.query(`SET search_path TO "${schema}"`);
    await first.query('BEGIN');
    await second.query('BEGIN');
    await first.query('UPDATE "User" SET "deletedAt"=now() WHERE "userId"=1');
    const concurrent = second.query('UPDATE "User" SET "deletedAt"=now() WHERE "userId"=2');
    await first.query('COMMIT');
    await concurrent;
    await assert.rejects(second.query('COMMIT'), error => error.code === '23514');
    await second.query('ROLLBACK');
    console.log('PASS: migration seed, rename, last-admin role/disable/unlink, concurrent disable.');
  } finally {
    await second.end().catch(()=>{});
    await first.query('ROLLBACK').catch(()=>{});
    if (created) await first.query(`DROP SCHEMA "${schema}" CASCADE`);
    await first.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
