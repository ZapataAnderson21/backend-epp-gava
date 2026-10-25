import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { PermissionsGuard } from '../src/permissions/permissions.guard';
import { PermissionsService } from '../src/permissions/permissions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { SignatureEvidenceService } from '../src/ssoma/signature-evidence.service';
import { SsomaController } from '../src/ssoma/ssoma.controller';
import { SsomaDocumentService } from '../src/ssoma/ssoma-document.service';
import { SsomaRetentionService } from '../src/ssoma/ssoma-retention.service';
import { SsomaService } from '../src/ssoma/ssoma.service';

const testPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/la0AAAAASUVORK5CYII=',
  'base64',
);

class SyntheticAuthenticatedUserGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { userId: number };
    }>();
    const userId = Number(request.headers['x-test-user']);
    if (!Number.isSafeInteger(userId) || userId < 1)
      throw new UnauthorizedException('Synthetic test identity required.');
    request.user = { userId };
    return true;
  }
}

function createHttpFixture() {
  const grants = new Map<number, string[]>();
  const state = {
    talkStatus: 'draft',
    participantIds: [] as number[],
    signed: false,
    currentVersion: 1,
    retentionRuns: 0,
  };
  const permissions = {
    forUser: jest.fn((userId: number) => grants.get(userId) ?? []),
  };
  const prisma = {
    userType: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    purchaseOrder: { findUnique: jest.fn() },
  };
  const ssoma = {
    createTalk: jest.fn(() => ({
      statusCode: 201,
      data: { ssomaTalkId: 41, status: state.talkStatus },
    })),
    listTalks: jest.fn(() => ({
      statusCode: 200,
      data: { items: [], totalItems: 0 },
    })),
    findTalk: jest.fn(() => ({
      statusCode: 200,
      data: { ssomaTalkId: 41, status: state.talkStatus },
    })),
    updateDraft: jest.fn(() => ({
      statusCode: 200,
      data: { ssomaTalkId: 41 },
    })),
    startTalk: jest.fn(() => ({
      statusCode: 200,
      data: { status: 'inProgress' },
    })),
    openTalk: jest.fn(() => ({
      statusCode: 200,
      data: { status: 'open' },
    })),
    annulTalk: jest.fn(() => ({
      statusCode: 200,
      data: { status: 'annulled' },
    })),
    searchWorkers: jest.fn(() => ({
      statusCode: 200,
      data: { items: [] },
    })),
    getAvailability: jest.fn(() => ({ statusCode: 200, data: [] })),
    addParticipants: jest.fn((_talkId: number, ids: number[]) => {
      state.participantIds.push(...ids);
      return {
        statusCode: 201,
        data: { participantIds: state.participantIds },
      };
    }),
    removeParticipant: jest.fn(() => ({
      statusCode: 200,
      data: { status: 'REMOVED' },
    })),
    invalidateAttendance: jest.fn(() => ({
      statusCode: 200,
      data: { status: 'VOIDED' },
    })),
    auditHistory: jest.fn(() => ({
      statusCode: 200,
      data: { items: [] },
    })),
  };
  const signatures = {
    capture: jest.fn((input: { workerId: number }) => {
      state.signed = true;
      return {
        statusCode: 200,
        data: { workerId: input.workerId, status: 'SIGNED' },
      };
    }),
  };
  const documents = {
    closeTalk: jest.fn((_talkId: number, _actorId: number, key: string) => {
      state.talkStatus = 'closed';
      return {
        statusCode: 200,
        data: { currentVersion: state.currentVersion, idempotencyKey: key },
      };
    }),
    startRevision: jest.fn(() => ({
      statusCode: 201,
      data: { revisionId: 73, status: 'pending' },
    })),
    publishRevision: jest.fn(
      (_talkId: number, revisionId: number, _actorId: number, key: string) => {
        state.currentVersion += 1;
        return {
          statusCode: 200,
          data: {
            revisionId,
            currentVersion: state.currentVersion,
            idempotencyKey: key,
          },
        };
      },
    ),
    listVersions: jest.fn(() => ({
      statusCode: 200,
      data: [{ version: state.currentVersion }],
    })),
    listRevisions: jest.fn(() => ({ statusCode: 200, data: [] })),
    reconcilePublications: jest.fn(() => ({
      statusCode: 200,
      data: { checked: 0 },
    })),
    downloadCurrent: jest.fn(() => Buffer.from('%PDF-1.4 synthetic current')),
    downloadVersion: jest.fn(() =>
      Buffer.from('%PDF-1.4 synthetic historical'),
    ),
  };
  const retention = {
    status: jest.fn(() => ({
      statusCode: 200,
      data: { evidence: { active: 1 }, backupPurge: 'not_verified' },
    })),
    orphanReport: jest.fn(() => ({
      statusCode: 200,
      data: { supported: false },
    })),
    runMaintenance: jest.fn(() => {
      state.retentionRuns += 1;
      return {
        statusCode: 200,
        data: { scheduled: 1, deleted: 0, backupPurge: 'not_verified' },
      };
    }),
    setRetentionHold: jest.fn(() => ({ statusCode: 200 })),
    clearRetentionHold: jest.fn(() => ({ statusCode: 200 })),
  };

  return {
    grants,
    state,
    permissions,
    prisma,
    ssoma,
    signatures,
    documents,
    retention,
  };
}

describe('SSOMA HTTP contract (mocked storage/provider integration)', () => {
  let app: INestApplication;
  let fixture: ReturnType<typeof createHttpFixture>;

  beforeAll(async () => {
    fixture = createHttpFixture();
    fixture.grants.set(1, [
      'ssoma.view',
      'ssoma.manage',
      'ssoma.sign',
      'ssoma.invalidate',
      'ssoma.close',
      'ssoma.revise',
      'ssoma.void',
      'ssoma.export',
      'ssoma.audit',
    ]);

    const module = await Test.createTestingModule({
      controllers: [SsomaController],
      providers: [
        PermissionsGuard,
        { provide: PermissionsService, useValue: fixture.permissions },
        { provide: PrismaService, useValue: fixture.prisma },
        { provide: SsomaService, useValue: fixture.ssoma },
        { provide: SignatureEvidenceService, useValue: fixture.signatures },
        { provide: SsomaDocumentService, useValue: fixture.documents },
        { provide: SsomaRetentionService, useValue: fixture.retention },
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalGuards(
      new SyntheticAuthenticatedUserGuard(),
      module.get(PermissionsGuard),
    );
    await app.init();
  });

  afterAll(async () => app.close());

  it('enforces each SSOMA permission through the HTTP guard pipeline', async () => {
    type PermissionRoute = {
      permission: string;
      method: 'get' | 'post';
      path: string;
      body?: Record<string, unknown>;
      upload?: boolean;
    };
    const cases: PermissionRoute[] = [
      { permission: 'ssoma.view', method: 'get', path: '/ssoma/talks/41' },
      {
        permission: 'ssoma.manage',
        method: 'post',
        path: '/ssoma/talks',
        body: {
          projectId: 2,
          talkDate: '2026-10-25',
          topic: 'Synthetic safety talk',
        },
      },
      {
        permission: 'ssoma.sign',
        method: 'post',
        path: '/ssoma/talks/41/attendance/51/signature',
        upload: true,
      },
      {
        permission: 'ssoma.invalidate',
        method: 'post',
        path: '/ssoma/talks/41/attendance/51/invalidate',
        body: { reason: 'Synthetic correction' },
      },
      {
        permission: 'ssoma.close',
        method: 'post',
        path: '/ssoma/talks/41/close',
        body: { idempotencyKey: 'e2e-close' },
      },
      {
        permission: 'ssoma.revise',
        method: 'post',
        path: '/ssoma/talks/41/revisions',
        body: { reason: 'Synthetic correction' },
      },
      {
        permission: 'ssoma.void',
        method: 'post',
        path: '/ssoma/talks/41/annul',
        body: { reason: 'Synthetic cancellation' },
      },
      {
        permission: 'ssoma.export',
        method: 'get',
        path: '/ssoma/talks/41/document',
      },
      {
        permission: 'ssoma.audit',
        method: 'get',
        path: '/ssoma/talks/41/audit',
      },
    ];
    const server = app.getHttpServer() as Server;
    const invoke = (route: (typeof cases)[number], userId: number) => {
      const headers = { 'x-test-user': String(userId) };
      if (route.upload)
        return request(server)
          .post(route.path)
          .set(headers)
          .field('workerId', '61')
          .attach('signature', testPng, {
            filename: 'synthetic.png',
            contentType: 'image/png',
          });
      const call =
        route.method === 'get'
          ? request(server).get(route.path).set(headers)
          : request(server).post(route.path).set(headers);
      return route.body ? call.send(route.body) : call;
    };

    await request(server).get('/ssoma/talks/41').expect(401);
    for (const [index, route] of cases.entries()) {
      const permissions =
        route.permission === 'ssoma.view'
          ? ['ssoma.view']
          : ['ssoma.view', route.permission];
      fixture.grants.set(100 + index, permissions);
      const allowed = await invoke(route, 100 + index);
      expect(allowed.status).toBe(
        route.permission === 'ssoma.export'
          ? 200
          : route.method === 'post'
            ? 201
            : 200,
      );

      if (route.permission !== 'ssoma.view') {
        fixture.grants.set(200 + index, ['ssoma.view']);
        await invoke(route, 200 + index).expect(403);
        fixture.grants.set(300 + index, [route.permission]);
        await invoke(route, 300 + index).expect(403);
      }
    }
  });

  it('runs a complete mocked HTTP talk, signature, document, revision, and retention flow', async () => {
    const server = app.getHttpServer() as Server;
    const actor = { 'x-test-user': '1' };
    const created = await request(server)
      .post('/ssoma/talks')
      .set(actor)
      .send({
        projectId: 7,
        talkDate: '2026-10-25',
        topic: 'Synthetic toolbox talk',
        trainer: 'Test Trainer',
      })
      .expect(201);
    const createdBody = created.body as { data: { ssomaTalkId: number } };
    expect(createdBody.data.ssomaTalkId).toBe(41);

    await request(server)
      .post('/ssoma/talks/41/participants')
      .set(actor)
      .send({ workerIds: [61] })
      .expect(201);
    expect(fixture.state.participantIds).toContain(61);

    await request(server)
      .post('/ssoma/talks/41/attendance/51/signature')
      .set(actor)
      .field('workerId', '61')
      .attach('signature', testPng, {
        filename: 'synthetic.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(fixture.signatures.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        talkId: 41,
        attendanceId: 51,
        workerId: 61,
        actorUserId: 1,
        mimeType: 'image/png',
        bytes: expect.any(Buffer) as Buffer,
      }),
    );
    expect(fixture.state.signed).toBe(true);

    await request(server)
      .post('/ssoma/talks/41/close')
      .set(actor)
      .send({ idempotencyKey: 'e2e-close-flow' })
      .expect(201);
    expect(fixture.state.talkStatus).toBe('closed');
    await request(server)
      .get('/ssoma/talks/41/document')
      .set(actor)
      .expect(200)
      .expect('content-type', /application\/pdf/);

    await request(server)
      .post('/ssoma/talks/41/revisions')
      .set(actor)
      .send({ reason: 'Synthetic revision' })
      .expect(201);
    await request(server)
      .post('/ssoma/talks/41/revisions/73/publish')
      .set(actor)
      .send({ idempotencyKey: 'e2e-revision' })
      .expect(201);
    expect(fixture.state.currentVersion).toBe(2);
    await request(server)
      .get('/ssoma/talks/41/versions/1/document')
      .set(actor)
      .expect(200)
      .expect('content-type', /application\/pdf/);

    const maintenance = await request(server)
      .post('/ssoma/maintenance/retention/run')
      .set(actor)
      .send({ batchSize: 5 })
      .expect(201);
    const maintenanceBody = maintenance.body as {
      data: { backupPurge: string };
    };
    expect(maintenanceBody.data.backupPurge).toBe('not_verified');
    expect(fixture.retention.runMaintenance).toHaveBeenCalledWith(5);
    expect(fixture.state.retentionRuns).toBe(1);
  });
});
