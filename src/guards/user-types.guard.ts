import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';
import { USER_TYPES_KEY } from '../decorators/user-types.decorator';

@Injectable()
export class UserTypesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,   // PrismaService global para consultas a DB
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Obtener tipos requeridos desde la metadata del decorador
    const requiredTypes = this.reflector.getAllAndOverride<string[]>(USER_TYPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredTypes || requiredTypes.length === 0) {
      // Si la ruta no especifica tipos permitidos, no se restringe por tipo
      return true;
    }

    // 2. Obtener usuario desde la request (añadido por JwtAuthGuard/JwtStrategy)
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      // Si no hay usuario en la request, se deniega el acceso
      return false;
    }

    // 3. Consultar la base de datos para obtener los tipos del usuario
    const userId = user.userId;
    const userTypeLinks = await this.prisma.userUserType.findMany({
      where: { userId },
      include: { userType: true }  // incluir el objeto UserType relacionado
    });
    if (!userTypeLinks || userTypeLinks.length === 0) {
      return false; // el usuario no tiene ningún tipo asignado
    }

    // 4. Extraer los nombres de tipo de usuario que posee el usuario
    const userTypeNames = userTypeLinks.map(link => link.userType.name);
    // 5. Verificar si hay intersección entre los tipos requeridos y los tipos del usuario
    const hasPermission = requiredTypes.some(type => userTypeNames.includes(type));
    if (!hasPermission) {
      return false;  // El tipo de usuario no está en la lista permitida
    }

    return true; // El usuario tiene al menos uno de los tipos requeridos
  }
}
