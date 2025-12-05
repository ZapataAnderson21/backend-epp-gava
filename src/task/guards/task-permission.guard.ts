import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from 'src/prisma/prisma.service';

// Tipos de operación que requieren diferentes permisos
export type TaskOperation = 'update-status' | 'delete' | 'assign' | 'unassign' | 'update';

export const TASK_OPERATION_KEY = 'taskOperation';
export const TaskOperation = (operation: TaskOperation) =>
  (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(TASK_OPERATION_KEY, operation, descriptor.value);
    return descriptor;
  };

// Roles que tienen permisos administrativos
const ADMIN_ROLES = ['GERENTE', 'ADMINISTRADORA'];

@Injectable()
export class TaskPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No autenticado.');
    }

    // Obtener la operación desde metadata
    const operation = this.reflector.get<TaskOperation>(
      TASK_OPERATION_KEY,
      context.getHandler(),
    );

    if (!operation) {
      return true; // Si no hay operación definida, permitir
    }

    // Obtener los roles del usuario
    const userRoles = await this.getUserRoles(user.userId);
    const isAdmin = userRoles.some((role) => ADMIN_ROLES.includes(role));

    // Operaciones que solo pueden hacer admins
    if (['delete', 'assign', 'unassign'].includes(operation)) {
      if (!isAdmin) {
        throw new ForbiddenException(
          'Solo GERENTE o ADMINISTRADORA pueden realizar esta acción.',
        );
      }
      return true;
    }

    // Para update-status y update: admin O usuario asignado
    if (['update-status', 'update'].includes(operation)) {
      if (isAdmin) {
        return true;
      }

      // Verificar si el usuario está asignado a la tarea
      const taskId = parseInt(request.params.taskId, 10);
      if (!taskId) {
        throw new ForbiddenException('ID de tarea no proporcionado.');
      }

      const isAssigned = await this.isUserAssignedToTask(user.userId, taskId);
      if (!isAssigned) {
        throw new ForbiddenException(
          'Solo GERENTE, ADMINISTRADORA o usuarios asignados pueden actualizar esta tarea.',
        );
      }
      return true;
    }

    return true;
  }

  private async getUserRoles(userId: number): Promise<string[]> {
    const userTypeLinks = await this.prisma.userUserType.findMany({
      where: { userId },
      include: { userType: true },
    });
    return userTypeLinks.map((link) => link.userType.name);
  }

  private async isUserAssignedToTask(
    userId: number,
    taskId: number,
  ): Promise<boolean> {
    const task = await this.prisma.task.findUnique({
      where: { taskId },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada.');
    }

    const assignment = await this.prisma.taskAssignment.findUnique({
      where: {
        taskId_userId: { taskId, userId },
      },
    });

    return !!assignment;
  }
}
