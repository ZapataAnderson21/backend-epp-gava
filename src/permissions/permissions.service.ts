import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  normalizePermissions,
  permissionModules,
  permissionDependencies,
} from './catalog';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async forUser(userId: number): Promise<string[]> {
    const links = await this.prisma.userUserType.findMany({
      where: { userId, user: { deletedAt: null } },
      select: { userType: { select: { permissions: true } } },
    });
    return [...new Set(links.flatMap((link) => link.userType.permissions))];
  }

  async list() {
    const roles = await this.prisma.userType.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { userUserTypes: true } } },
    });
    return {
      data: {
        modules: permissionModules,
        dependencies: permissionDependencies,
        roles,
      },
    };
  }

  async save(
    id: number | undefined,
    dto: {
      name: string;
      description?: string;
      permissions: string[];
      version?: number;
    },
  ) {
    let permissions: string[];
    try {
      permissions = normalizePermissions(dto.permissions);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const data = {
      name: dto.name.trim().toUpperCase(),
      description: dto.description?.trim() ?? '',
      permissions,
    };
    if (data.name.length < 2)
      throw new BadRequestException(
        'El nombre del rol debe tener al menos dos caracteres.',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71823091)`;
      const duplicate = await tx.userType.findFirst({
        where: {
          name: { equals: data.name, mode: 'insensitive' },
          ...(id ? { userTypeId: { not: id } } : {}),
        },
      });
      if (duplicate)
        throw new ConflictException('Ya existe un rol con ese nombre.');
      if (!id) return { data: await tx.userType.create({ data }) };
      const result = await tx.userType.updateMany({
        where: { userTypeId: id, version: dto.version ?? -1 },
        data: { ...data, version: { increment: 1 } },
      });
      if (!result.count)
        throw new ConflictException(
          'El rol cambió mientras lo editabas. Recarga los permisos.',
        );
      await this.ensureAdministrator(tx);
      return {
        data: await tx.userType.findUnique({ where: { userTypeId: id } }),
      };
    });
  }

  async assign(userId: number, roleId: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71823091)`;
      const user = await tx.user.findFirst({
        where: { userId, deletedAt: null },
      });
      const role = await tx.userType.findUnique({
        where: { userTypeId: roleId },
      });
      if (!user || !role)
        throw new NotFoundException('Usuario o rol no encontrado.');
      await tx.userUserType.deleteMany({ where: { userId } });
      await tx.userUserType.create({ data: { userId, userTypeId: roleId } });
      await this.ensureAdministrator(tx);
      return {
        data: { userId, userTypeId: roleId },
        message: 'Rol actualizado.',
      };
    });
  }

  private async ensureAdministrator(tx: Pick<PrismaService, 'userUserType'>) {
    const count = await tx.userUserType.count({
      where: {
        user: { deletedAt: null },
        userType: { permissions: { has: 'roles.manage' } },
      },
    });
    if (!count)
      throw new BadRequestException(
        'Debe quedar al menos un usuario activo con permiso para administrar roles.',
      );
  }
}
