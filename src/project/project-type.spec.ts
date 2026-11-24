/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are intentionally untyped. */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectService } from './project.service';

const baseProject = {
  projectId: 1,
  name: 'Proyecto Uno',
  code: 'PROY-001',
  description: 'Proyecto de prueba',
  status: 'active',
  type: 'works',
  location: 'Lima',
  startDate: null,
  endDate: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
};

function validCreatePayload(type?: string) {
  return {
    name: 'Proyecto Uno',
    code: 'PROY-001',
    description: 'Proyecto de prueba',
    location: 'Lima',
    ...(type === undefined ? {} : { type }),
  };
}

function buildService() {
  const project = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };
  const prisma = { project };
  const taskService = { areAllTasksCompletedOrCancelled: jest.fn() };
  const notificationService = {
    notifyProjectCreated: jest.fn(),
    notifyProjectCompleted: jest.fn(),
    notifyProjectInactivated: jest.fn(),
  };
  const inventoryService = { getProjectClosureReadiness: jest.fn() };

  return {
    service: new ProjectService(
      prisma as never,
      taskService as never,
      notificationService as never,
      inventoryService as never,
    ),
    project,
    notificationService,
  };
}

describe('project type classification', () => {
  describe('migration', () => {
    const migration = readFileSync(
      resolve(
        'prisma/migrations/20261116220000_add_project_type/migration.sql',
      ),
      'utf8',
    );

    it('backfills existing projects before making type required', () => {
      const addColumn = migration.indexOf('ADD COLUMN "type" "ProjectType"');
      const backfill = migration.indexOf(
        `SET "type" = 'works' WHERE "type" IS NULL`,
      );
      const makeRequired = migration.indexOf(
        'ALTER COLUMN "type" SET NOT NULL',
      );

      expect(addColumn).toBeGreaterThan(-1);
      expect(backfill).toBeGreaterThan(addColumn);
      expect(makeRequired).toBeGreaterThan(backfill);
    });

    it('does not leave a permanent default for new projects', () => {
      expect(migration).not.toMatch(/DEFAULT\s+'works'/i);
    });
  });

  describe('CreateProjectDto', () => {
    it.each(['works', 'services', 'consulting'])(
      'accepts the %s project type',
      async (type) => {
        const dto = plainToInstance(CreateProjectDto, validCreatePayload(type));

        await expect(validate(dto)).resolves.toHaveLength(0);
      },
    );

    it('rejects a project without type', async () => {
      const dto = plainToInstance(CreateProjectDto, validCreatePayload());

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'type')).toBe(true);
    });

    it('rejects an unknown project type', async () => {
      const dto = plainToInstance(
        CreateProjectDto,
        validCreatePayload('unknown'),
      );

      const errors = await validate(dto);

      expect(errors.some((error) => error.property === 'type')).toBe(true);
    });
  });

  it.each(['works', 'services', 'consulting'])(
    'creates a %s project with an explicit type',
    async (type) => {
      const { service, project, notificationService } = buildService();
      project.findUnique.mockResolvedValue(null);
      project.create.mockResolvedValue({ ...baseProject, type });

      await service.create(validCreatePayload(type) as never);

      expect(project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type, status: 'active' }),
      });
      expect(notificationService.notifyProjectCreated).toHaveBeenCalled();
    },
  );

  it('updates the project type when provided', async () => {
    const { service, project } = buildService();
    project.findUnique.mockResolvedValue({ ...baseProject, requests: [] });
    project.update.mockResolvedValue({ ...baseProject, type: 'services' });

    await service.update(1, { type: 'services' } as never);

    expect(project.update).toHaveBeenCalledWith({
      where: { projectId: 1 },
      data: { type: 'services' },
    });
  });

  it('does not overwrite type when another field is updated', async () => {
    const { service, project } = buildService();
    project.findUnique.mockResolvedValue({ ...baseProject, requests: [] });
    project.update.mockResolvedValue({ ...baseProject, name: 'Nuevo nombre' });

    await service.update(1, { name: 'Nuevo nombre' });

    expect(project.update).toHaveBeenCalledWith({
      where: { projectId: 1 },
      data: { name: 'Nuevo nombre' },
    });
  });

  it('combines type, status, search and pagination filters', async () => {
    const { service, project } = buildService();
    project.findMany.mockResolvedValue([baseProject]);
    project.count.mockResolvedValue(1);

    await service.findPaginated({
      type: 'consulting',
      status: 'active',
      search: 'uno',
      page: 2,
      pageSize: 10,
      order: 'asc',
    } as never);

    const expectedWhere = expect.objectContaining({
      deletedAt: null,
      type: 'consulting',
      status: 'active',
      OR: expect.any(Array),
    });
    expect(project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere, skip: 10, take: 10 }),
    );
    expect(project.count).toHaveBeenCalledWith({ where: expectedWhere });
  });
});
