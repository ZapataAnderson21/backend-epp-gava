import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateFallProtectionGroupDto,
  FallProtectionGroupComponentDto,
} from './dto/create-fall-protection-group.dto';
import { ElementService } from './element.service';

interface FallProtectionGroupCreateArgs {
  data: {
    code: string;
    description: string | null;
    harnessElementId: number;
    anchorBandElementId: number;
    lifelineElementId: number;
    positioningLanyardElementId: number;
    components: { create: FallProtectionGroupComponentDto[] };
  };
  include: object;
}

describe('ElementService - Grupos EPA', () => {
  const element = {
    findFirst: jest.fn(),
  };
  const fallProtectionGroup = {
    findUnique: jest.fn(),
    create: jest.fn<Promise<unknown>, [FallProtectionGroupCreateArgs]>(),
  };
  const prisma = Object.assign(
    Object.create(PrismaService.prototype) as PrismaService,
    { element, fallProtectionGroup },
  );
  const service = new ElementService(prisma);

  const validComponents: FallProtectionGroupComponentDto[] = [
    { role: 'harness', elementId: 1 },
    { role: 'anchorBand', elementId: 2 },
    { role: 'lifeline', elementId: 3 },
    { role: 'positioningLanyard', elementId: 4 },
  ];

  const createDto = (
    overrides: Partial<CreateFallProtectionGroupDto> = {},
  ): CreateFallProtectionGroupDto => ({
    code: 'EPA-001',
    components: validComponents,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fallProtectionGroup.findUnique.mockResolvedValue(null);
    fallProtectionGroup.create.mockResolvedValue({
      fallProtectionGroupId: 10,
      code: 'EPA-001',
    });
    element.findFirst.mockImplementation(
      ({ where }: { where: { elementId: number } }) => {
        const names: Record<number, string> = {
          1: 'Arnes',
          2: 'Banda de Anclaje',
          3: 'Linea de Vida',
          4: 'Eslinga de posicionamiento',
        };
        return Promise.resolve(
          names[where.elementId]
            ? {
                elementId: where.elementId,
                name: names[where.elementId],
                code: `EPA-PARTE-${where.elementId}`,
                category: null,
              }
            : null,
        );
      },
    );
  });

  it('rechaza un codigo compuesto solo por espacios', async () => {
    await expect(
      service.createFallProtectionGroup(createDto({ code: '   ' })),
    ).rejects.toThrow(
      new BadRequestException('Ingresa el código del Grupo EPA.'),
    );

    expect(fallProtectionGroup.findUnique).not.toHaveBeenCalled();
    expect(fallProtectionGroup.create).not.toHaveBeenCalled();
  });

  it.each([
    ['harness', 'Selecciona al menos un arnés.'],
    ['anchorBand', 'Selecciona al menos una banda de anclaje.'],
    ['lifeline', 'Selecciona al menos una línea de vida.'],
    [
      'positioningLanyard',
      'Selecciona al menos una eslinga de posicionamiento.',
    ],
  ] as const)(
    'indica especificamente cuando falta el componente %s',
    async (role, message) => {
      const components = validComponents?.filter(
        (component) => component.role !== role,
      );

      await expect(
        service.createFallProtectionGroup(createDto({ components })),
      ).rejects.toThrow(new BadRequestException(message));

      expect(fallProtectionGroup.create).not.toHaveBeenCalled();
    },
  );

  it('devuelve un mensaje claro cuando el codigo del grupo ya existe', async () => {
    fallProtectionGroup.findUnique.mockResolvedValue({
      fallProtectionGroupId: 99,
    });

    await expect(
      service.createFallProtectionGroup(createDto()),
    ).rejects.toThrow(
      new ConflictException('Ya existe un Grupo EPA con el código EPA-001.'),
    );

    expect(element.findFirst).not.toHaveBeenCalled();
    expect(fallProtectionGroup.create).not.toHaveBeenCalled();
  });

  it('normaliza el codigo y crea el grupo con sus componentes', async () => {
    const result = await service.createFallProtectionGroup(
      createDto({ code: '  EPA-001  ', description: '  Grupo para obra  ' }),
    );

    expect(fallProtectionGroup.findUnique).toHaveBeenCalledWith({
      where: { code: 'EPA-001' },
      select: { fallProtectionGroupId: true },
    });
    const createArguments = fallProtectionGroup.create.mock.calls[0]?.[0];
    expect(createArguments?.data).toEqual({
      code: 'EPA-001',
      description: 'Grupo para obra',
      harnessElementId: 1,
      anchorBandElementId: 2,
      lifelineElementId: 3,
      positioningLanyardElementId: 4,
      components: { create: validComponents },
    });
    expect(result.message).toBe('Grupo EPA registrado exitosamente.');
  });
});
