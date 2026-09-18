import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma';
import {
  endpointPermissions,
  satisfies,
} from 'src/permissions/endpoint-policy';
import { RequestFormDraftService } from './request-form-draft.service';
import {
  RequestDraftSlotDto,
  SaveRequestFormDraftDto,
} from './dto/request-form-draft.dto';

describe('Request form autosave', () => {
  const drafts = {
    findUnique: jest.fn(),
    createMany: jest.fn(),
    updateMany: jest.fn(),
  };
  const request = { findFirst: jest.fn() };
  const project = { findFirst: jest.fn() };
  const prisma = {
    requestFormDraft: drafts,
    request,
    project,
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback({ requestFormDraft: drafts }),
    ),
  };
  const service = new RequestFormDraftService(
    prisma as unknown as PrismaService,
  );
  const payload = {
    schemaVersion: 1,
    projectId: 0,
    description: 'Primer dato',
  };
  beforeEach(() => {
    jest.clearAllMocks();
    drafts.findUnique.mockResolvedValue(null);
    drafts.createMany.mockResolvedValue({ count: 1 });
    drafts.updateMany.mockResolvedValue({ count: 1 });
    request.findFirst.mockResolvedValue({ status: 'draft' });
    project.findFirst.mockResolvedValue({ projectId: 2 });
  });
  it('saves a partial form before selecting a project without creating a request', async () => {
    await service.save(1, 'new', { expectedVersion: 0, payload });
    expect(drafts.createMany).toHaveBeenCalledWith({
      data: { userId: 1, slot: 'new', payload },
      skipDuplicates: true,
    });
    expect(project.findFirst).not.toHaveBeenCalled();
    expect(request.findFirst).not.toHaveBeenCalled();
  });
  it('isolates users and form scopes', async () => {
    expect(await service.read(5, 'project-2')).toEqual({
      payload: null,
      version: 0,
      updatedAt: null,
    });
    expect(drafts.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_slot: { userId: 5, slot: 'project-2' } },
      }),
    );
  });
  it('checks ownership on existing requests before reading or saving', async () => {
    request.findFirst.mockResolvedValue(null);
    await expect(service.read(5, '7')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.save(5, '7', { expectedVersion: 0, payload }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(request.findFirst).toHaveBeenCalledWith({
      where: { requestId: 7, userId: 5 },
      select: { status: true },
    });
    expect(drafts.findUnique).not.toHaveBeenCalled();
  });
  it('does not allow edits after sending, but allows completion cleanup', async () => {
    request.findFirst.mockResolvedValue({ status: 'inProgress' });
    await expect(
      service.save(1, '7', { expectedVersion: 1, payload }),
    ).rejects.toBeInstanceOf(ConflictException);
    await service.save(1, '7', { expectedVersion: 1, payload: null });
    expect(drafts.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, slot: '7', version: 1 },
      data: { payload: Prisma.DbNull, version: { increment: 1 } },
    });
  });
  it('rejects both competing initial inserts and stale revisions', async () => {
    drafts.createMany.mockResolvedValue({ count: 0 });
    drafts.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.save(1, 'new', { expectedVersion: 0, payload }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.save(1, 'new', { expectedVersion: 3, payload }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects a mismatched project and validates existing projects', async () => {
    await expect(
      service.save(1, 'project-2', {
        expectedVersion: 0,
        payload: { ...payload, projectId: 3 },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    project.findFirst.mockResolvedValue(null);
    await expect(
      service.save(1, 'new', {
        expectedVersion: 0,
        payload: { ...payload, projectId: 2 },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects SMTP passwords and oversized content', async () => {
    await expect(
      service.save(1, 'new', {
        expectedVersion: 0,
        payload: { ...payload, passwordCPanel: 'secret' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.save(1, 'new', {
        expectedVersion: 0,
        payload: { ...payload, description: 'x'.repeat(70000) },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('requires request management, without unnecessarily requiring financial access', () => {
    for (const method of ['GET', 'PUT']) {
      const required = endpointPermissions(
        'RequestFormDraftController',
        'save',
        method,
      );
      expect(satisfies(['requests.view'], required)).toBe(false);
      expect(satisfies(['requests.view', 'requests.manage'], required)).toBe(
        true,
      );
    }
  });
  it('validates slot and body, allowing null tombstones but not forged owners', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    for (const slot of ['new', 'project-2', '7'])
      await expect(
        pipe.transform(
          { slot },
          { type: 'param', metatype: RequestDraftSlotDto },
        ),
      ).resolves.toBeInstanceOf(RequestDraftSlotDto);
    for (const slot of ['-1', 'project-0', 'bad'])
      await expect(
        pipe.transform(
          { slot },
          { type: 'param', metatype: RequestDraftSlotDto },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform(
        { expectedVersion: 1, payload: null },
        { type: 'body', metatype: SaveRequestFormDraftDto },
      ),
    ).resolves.toBeInstanceOf(SaveRequestFormDraftDto);
    await expect(
      pipe.transform(
        { expectedVersion: 1, payload, userId: 5 },
        { type: 'body', metatype: SaveRequestFormDraftDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      pipe.transform(
        { expectedVersion: 1 },
        { type: 'body', metatype: SaveRequestFormDraftDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
