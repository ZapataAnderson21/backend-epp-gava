import { readFileSync } from 'node:fs';
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
});
