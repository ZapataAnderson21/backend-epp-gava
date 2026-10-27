import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateSync } from 'class-validator';
import {
  AddSsomaParticipantsDto,
  CreateSsomaTalkDto,
} from './dto/ssoma-talk.dto';

describe('SSOMA Phase 3 schema foundation', () => {
  const schema = readFileSync(
    resolve(__dirname, '../../prisma/schema.prisma'),
    'utf8',
  );

  it('stores editable talk fields as queryable scalars and no signature or PDF payloads', () => {
    const talk = schema.match(/model SsomaTalk \{([\s\S]*?)\n\}/)?.[1] ?? '';
    for (const field of [
      'trainer',
      'location',
      'targetAudience',
      'scheduledTime',
      'durationMinutes',
      'observations',
      'responsibleName',
      'responsiblePosition',
    ])
      expect(talk).toMatch(new RegExp(`\\b${field}\\s+`));
    expect(talk).not.toMatch(/signature(Bytes|Data)|pdf(Bytes|Data)|base64/i);
  });

  it('gives publication retries a nullable unique key without changing historical rows', () => {
    const publication =
      schema.match(/model SsomaDocumentPublication \{([\s\S]*?)\n\}/)?.[1] ??
      '';
    expect(publication).toMatch(/idempotencyKey\s+String\?\s+@unique/);
    const migration = readFileSync(
      resolve(
        __dirname,
        '../../prisma/migrations/20261025_add_ssoma_phase3/migration.sql',
      ),
      'utf8',
    );
    expect(migration).toContain('ADD COLUMN "idempotencyKey" VARCHAR(200)');
    expect(migration).toContain(
      'CHECK ("durationMinutes" IS NULL OR "durationMinutes" > 0)',
    );
  });

  it('rejects caller-supplied attendance dates and impossible calendar dates', () => {
    const participants = Object.assign(new AddSsomaParticipantsDto(), {
      workerIds: [4],
      attendanceDate: '2026-10-25',
    });
    expect(
      validateSync(participants, {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).map(({ property }) => property),
    ).toContain('attendanceDate');

    const talk = Object.assign(new CreateSsomaTalkDto(), {
      projectId: 9,
      talkDate: '2026-02-30',
      topic: 'Safety',
    });
    expect(validateSync(talk).map(({ property }) => property)).toContain(
      'talkDate',
    );
  });

  it('persists the approved activity choices and a bounded Other label', () => {
    const activity =
      schema.match(/enum SsomaActivityType \{([\s\S]*?)\n\}/)?.[1] ?? '';
    for (const value of [
      'INDUCTION',
      'TALK',
      'TRAINING',
      'PRACTICE',
      'DRILL',
      'OTHER',
    ])
      expect(activity).toMatch(new RegExp(`\\b${value}\\b`));
    const talk = schema.match(/model SsomaTalk \{([\s\S]*?)\n\}/)?.[1] ?? '';
    expect(talk).toMatch(/activityType\s+SsomaActivityType\s+@default\(TALK\)/);
    expect(talk).toMatch(/otherActivityText\s+String\?\s+@db\.VarChar\(12\)/);

    const migration = readFileSync(
      resolve(
        __dirname,
        '../../prisma/migrations/20261027_add_ssoma_activity_type/migration.sql',
      ),
      'utf8',
    );
    expect(migration).toContain('CREATE TYPE "SsomaActivityType"');
    expect(migration).toContain(
      '"activityType" "SsomaActivityType" NOT NULL DEFAULT \'TALK\'',
    );
    expect(migration).toContain('"otherActivityText" VARCHAR(12)');
    expect(migration).toContain('btrim("otherActivityText")');
  });

  it('validates activity enum and Other text length on the talk DTO', () => {
    const invalidActivity = Object.assign(new CreateSsomaTalkDto(), {
      projectId: 9,
      talkDate: '2026-10-25',
      topic: 'Safety',
      activityType: 'NOT_AN_ACTIVITY',
    });
    expect(
      validateSync(invalidActivity).map(({ property }) => property),
    ).toContain('activityType');

    const longOther = Object.assign(new CreateSsomaTalkDto(), {
      projectId: 9,
      talkDate: '2026-10-25',
      topic: 'Safety',
      activityType: 'OTHER',
      otherActivityText: 'x'.repeat(13),
    });
    expect(validateSync(longOther).map(({ property }) => property)).toContain(
      'otherActivityText',
    );
  });

  it('applies the UTC currentAt correction after the additive activity migration', () => {
    const migrationsRoot = resolve(__dirname, '../../prisma/migrations');
    const migrationNames = readdirSync(migrationsRoot).sort();
    const activityIndex = migrationNames.indexOf(
      '20261027_add_ssoma_activity_type',
    );
    const utcIndex = migrationNames.indexOf(
      '20261027_fix_ssoma_document_current_utc',
    );
    expect(activityIndex).toBeGreaterThanOrEqual(0);
    expect(utcIndex).toBeGreaterThan(activityIndex);

    const phase2 = readFileSync(
      resolve(migrationsRoot, '20261023_add_ssoma_phase2/migration.sql'),
      'utf8',
    );
    expect(phase2).toContain(
      'CREATE FUNCTION ssoma_validate_document_version()',
    );
    expect(phase2).toContain('"currentAt" TIMESTAMP(3)');
    expect(phase2).toContain(
      'EXECUTE FUNCTION ssoma_validate_document_version()',
    );

    const activity = readFileSync(
      resolve(migrationsRoot, '20261027_add_ssoma_activity_type/migration.sql'),
      'utf8',
    );
    expect(activity).toContain('CREATE TYPE "SsomaActivityType"');

    const utcMigration = readFileSync(
      resolve(
        migrationsRoot,
        '20261027_fix_ssoma_document_current_utc/migration.sql',
      ),
      'utf8',
    );
    expect(utcMigration).toContain(
      'CREATE OR REPLACE FUNCTION ssoma_validate_document_version()',
    );
    expect(
      utcMigration.match(/clock_timestamp\(\) AT TIME ZONE 'UTC'/g),
    ).toHaveLength(2);
  });
});
