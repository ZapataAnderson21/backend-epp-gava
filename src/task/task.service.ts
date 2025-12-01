import { Injectable, NotFoundException, BadRequestException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto, TaskStatus } from './dto';

@Injectable()
export class TaskService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Crear una nueva tarea o subtarea
   */
  async create(createTaskDto: CreateTaskDto) {
    const { assignedUserIds, startDate, dueDate, ...taskData } = createTaskDto;

    // Validar que el proyecto existe
    const project = await this.prismaService.project.findUnique({
      where: { projectId: taskData.projectId },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    // Validar tarea padre si es subtarea
    if (taskData.parentTaskId) {
      const parentTask = await this.prismaService.task.findUnique({
        where: { taskId: taskData.parentTaskId },
      });
      if (!parentTask) {
        throw new NotFoundException('Tarea padre no encontrada');
      }
      if (parentTask.projectId !== taskData.projectId) {
        throw new BadRequestException('La subtarea debe pertenecer al mismo proyecto que la tarea padre');
      }
    }

    // Validar usuarios asignados
    if (assignedUserIds && assignedUserIds.length > 0) {
      const users = await this.prismaService.user.findMany({
        where: { userId: { in: assignedUserIds } },
      });
      if (users.length !== assignedUserIds.length) {
        throw new BadRequestException('Uno o más usuarios asignados no existen');
      }
    }

    // Crear la tarea con sus asignaciones
    const task = await this.prismaService.task.create({
      data: {
        ...taskData,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignments: assignedUserIds
          ? {
              create: assignedUserIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
      include: {
        project: { select: { projectId: true, name: true, code: true } },
        parentTask: { select: { taskId: true, title: true } },
        assignments: {
          include: {
            user: { select: { userId: true, name: true, lastName: true, email: true } },
          },
        },
        subtasks: true,
      },
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Tarea creada correctamente',
      data: task,
    };
  }

  /**
   * Obtener todas las tareas de un proyecto (solo tareas principales, no subtareas)
   */
  async findByProject(projectId: number) {
    const tasks = await this.prismaService.task.findMany({
      where: {
        projectId,
        parentTaskId: null, // Solo tareas principales
      },
      include: {
        assignments: {
          include: {
            user: { select: { userId: true, name: true, lastName: true, email: true } },
          },
        },
        subtasks: {
          include: {
            assignments: {
              include: {
                user: { select: { userId: true, name: true, lastName: true, email: true } },
              },
            },
            subtasks: {
              include: {
                assignments: {
                  include: {
                    user: { select: { userId: true, name: true, lastName: true, email: true } },
                  },
                },
              },
            },
          },
        },
        _count: {
          select: { subtasks: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Tareas del proyecto obtenidas correctamente',
      data: tasks,
    };
  }

  /**
   * Obtener una tarea por ID con todos sus detalles
   */
  async findOne(taskId: number) {
    const task = await this.prismaService.task.findUnique({
      where: { taskId },
      include: {
        project: { select: { projectId: true, name: true, code: true } },
        parentTask: { select: { taskId: true, title: true } },
        assignments: {
          include: {
            user: { select: { userId: true, name: true, lastName: true, email: true } },
          },
        },
        subtasks: {
          include: {
            assignments: {
              include: {
                user: { select: { userId: true, name: true, lastName: true, email: true } },
              },
            },
            _count: { select: { subtasks: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Tarea obtenida correctamente',
      data: task,
    };
  }

  /**
   * Actualizar una tarea
   */
  async update(taskId: number, updateTaskDto: UpdateTaskDto) {
    const { assignedUserIds, startDate, dueDate, ...taskData } = updateTaskDto;

    // Verificar que la tarea existe
    const existingTask = await this.prismaService.task.findUnique({
      where: { taskId },
    });
    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Validar tarea padre si se está cambiando
    if (taskData.parentTaskId !== undefined) {
      if (taskData.parentTaskId === taskId) {
        throw new BadRequestException('Una tarea no puede ser su propia tarea padre');
      }
      if (taskData.parentTaskId) {
        const parentTask = await this.prismaService.task.findUnique({
          where: { taskId: taskData.parentTaskId },
        });
        if (!parentTask) {
          throw new NotFoundException('Tarea padre no encontrada');
        }
        if (parentTask.projectId !== existingTask.projectId) {
          throw new BadRequestException('La subtarea debe pertenecer al mismo proyecto que la tarea padre');
        }
      }
    }

    // Preparar datos de completado
    const completedAt =
      taskData.status === TaskStatus.completed && existingTask.status !== TaskStatus.completed
        ? new Date()
        : taskData.status !== TaskStatus.completed && existingTask.status === TaskStatus.completed
          ? null
          : undefined;

    // Actualizar la tarea
    const task = await this.prismaService.task.update({
      where: { taskId },
      data: {
        ...taskData,
        startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
        completedAt,
      },
      include: {
        project: { select: { projectId: true, name: true, code: true } },
        parentTask: { select: { taskId: true, title: true } },
        assignments: {
          include: {
            user: { select: { userId: true, name: true, lastName: true, email: true } },
          },
        },
        subtasks: true,
      },
    });

    // Actualizar asignaciones si se proporcionaron
    if (assignedUserIds !== undefined) {
      // Eliminar asignaciones actuales
      await this.prismaService.taskAssignment.deleteMany({
        where: { taskId },
      });

      // Crear nuevas asignaciones
      if (assignedUserIds.length > 0) {
        await this.prismaService.taskAssignment.createMany({
          data: assignedUserIds.map((userId) => ({ taskId, userId })),
        });
      }

      // Recargar la tarea con las nuevas asignaciones
      return this.findOne(taskId);
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Tarea actualizada correctamente',
      data: task,
    };
  }

  /**
   * Eliminar una tarea (y sus subtareas por cascade)
   */
  async remove(taskId: number) {
    const task = await this.prismaService.task.findUnique({
      where: { taskId },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    await this.prismaService.task.delete({
      where: { taskId },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Tarea eliminada correctamente',
      data: null,
    };
  }

  /**
   * Obtener tareas asignadas a un usuario
   */
  async findByUser(userId: number) {
    const tasks = await this.prismaService.task.findMany({
      where: {
        assignments: {
          some: { userId },
        },
      },
      include: {
        project: { select: { projectId: true, name: true, code: true } },
        parentTask: { select: { taskId: true, title: true } },
        assignments: {
          include: {
            user: { select: { userId: true, name: true, lastName: true, email: true } },
          },
        },
        _count: { select: { subtasks: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Tareas del usuario obtenidas correctamente',
      data: tasks,
    };
  }

  /**
   * Obtener estadísticas de avance de un proyecto
   * Incluye conteo de tareas vencidas (overdue)
   */
  async getProjectProgress(projectId: number) {
    const now = new Date();
    
    const tasks = await this.prismaService.task.findMany({
      where: { projectId },
      select: { 
        status: true, 
        parentTaskId: true,
        dueDate: true,
      },
    });

    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const cancelled = tasks.filter((t) => t.status === 'cancelled').length;
    
    // Tareas vencidas: dueDate < hoy y no completadas/canceladas
    const overdue = tasks.filter(
      (t) => 
        t.dueDate && 
        new Date(t.dueDate) < now && 
        t.status !== 'completed' && 
        t.status !== 'cancelled'
    ).length;

    const totalWithoutCancelled = total - cancelled;
    const progressPercentage =
      totalWithoutCancelled > 0 ? Math.round((completed / totalWithoutCancelled) * 100) : 0;

    return {
      statusCode: HttpStatus.OK,
      message: 'Progreso del proyecto obtenido correctamente',
      data: {
        projectId,
        total,
        completed,
        inProgress,
        pending,
        cancelled,
        overdue,
        progressPercentage,
      },
    };
  }

  /**
   * Cambiar el estado de una tarea (endpoint rápido)
   */
  async updateStatus(taskId: number, status: TaskStatus) {
    const existingTask = await this.prismaService.task.findUnique({
      where: { taskId },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Manejar completedAt
    const completedAt =
      status === TaskStatus.completed && existingTask.status !== 'completed'
        ? new Date()
        : status !== TaskStatus.completed && existingTask.status === 'completed'
          ? null
          : undefined;

    const task = await this.prismaService.task.update({
      where: { taskId },
      data: {
        status,
        completedAt,
      },
      include: {
        project: { select: { projectId: true, name: true, code: true } },
        assignments: {
          include: {
            user: { select: { userId: true, name: true, lastName: true, email: true } },
          },
        },
      },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Estado de la tarea actualizado correctamente',
      data: task,
    };
  }

  /**
   * Asignar un usuario a una tarea
   */
  async assignUser(taskId: number, userId: number) {
    // Verificar que la tarea existe
    const task = await this.prismaService.task.findUnique({
      where: { taskId },
    });
    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Verificar que el usuario existe
    const user = await this.prismaService.user.findUnique({
      where: { userId },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar si ya está asignado
    const existingAssignment = await this.prismaService.taskAssignment.findUnique({
      where: {
        taskId_userId: { taskId, userId },
      },
    });
    if (existingAssignment) {
      throw new BadRequestException('El usuario ya está asignado a esta tarea');
    }

    // Crear la asignación
    const assignment = await this.prismaService.taskAssignment.create({
      data: { taskId, userId },
      include: {
        user: { select: { userId: true, name: true, lastName: true, email: true } },
      },
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Usuario asignado correctamente',
      data: assignment,
    };
  }

  /**
   * Desasignar un usuario de una tarea
   */
  async unassignUser(taskId: number, userId: number) {
    // Verificar que la asignación existe
    const assignment = await this.prismaService.taskAssignment.findUnique({
      where: {
        taskId_userId: { taskId, userId },
      },
    });

    if (!assignment) {
      throw new NotFoundException('El usuario no está asignado a esta tarea');
    }

    await this.prismaService.taskAssignment.delete({
      where: {
        taskId_userId: { taskId, userId },
      },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Usuario desasignado correctamente',
      data: null,
    };
  }
}
