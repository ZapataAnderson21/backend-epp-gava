import { Injectable, NotFoundException, BadRequestException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTaskDto, UpdateTaskDto, TaskStatus } from './dto';
import { NotificationService } from 'src/notification/notification.service';

@Injectable()
export class TaskService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

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

    // REGLA: No permitir crear tareas en proyectos con estado completed o inactive
    if (project.status === 'completed' || project.status === 'inactive') {
      throw new BadRequestException(
        `No se pueden crear tareas en un proyecto con estado "${project.status}". El proyecto debe estar activo.`,
      );
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
      // REGLA: No permitir asignar usuarios eliminados (deletedAt no nulo)
      const users = await this.prismaService.user.findMany({
        where: { 
          userId: { in: assignedUserIds },
          deletedAt: null, // Solo usuarios activos
        },
      });
      if (users.length !== assignedUserIds.length) {
        throw new BadRequestException('Uno o más usuarios asignados no existen o han sido eliminados');
      }
    }

    // REGLA: Validaciones de fechas
    const parsedStartDate = startDate ? new Date(startDate) : null;
    const parsedDueDate = dueDate ? new Date(dueDate) : null;
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalizar a inicio del día

    // startDate no puede ser anterior a la fecha actual
    if (parsedStartDate) {
      const normalizedStartDate = new Date(parsedStartDate);
      normalizedStartDate.setHours(0, 0, 0, 0);
      if (normalizedStartDate < now) {
        throw new BadRequestException('La fecha de inicio no puede ser anterior a la fecha actual');
      }
    }

    // dueDate no puede ser anterior a startDate
    if (parsedStartDate && parsedDueDate && parsedDueDate < parsedStartDate) {
      throw new BadRequestException('La fecha de vencimiento no puede ser anterior a la fecha de inicio');
    }

    // No permitir crear tareas con dueDate en el pasado
    if (parsedDueDate) {
      const normalizedDueDate = new Date(parsedDueDate);
      normalizedDueDate.setHours(0, 0, 0, 0);
      if (normalizedDueDate < now) {
        throw new BadRequestException('La fecha de vencimiento no puede estar en el pasado');
      }
    }

    // Crear la tarea con sus asignaciones
    const task = await this.prismaService.task.create({
      data: {
        ...taskData,
        startDate: parsedStartDate,
        dueDate: parsedDueDate,
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

    // Notificar a los usuarios asignados
    if (assignedUserIds && assignedUserIds.length > 0) {
      for (const userId of assignedUserIds) {
        await this.notificationService.notifyTaskAssigned(
          task.taskId,
          userId,
          task.title,
          task.project.name,
        );
      }
    }

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
      include: { subtasks: true },
    });
    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // REGLA: No permitir reabrir tareas canceladas
    if (existingTask.status === 'cancelled' && taskData.status && taskData.status !== TaskStatus.cancelled) {
      throw new BadRequestException('No se puede reabrir una tarea cancelada');
    }

    // REGLA: Validaciones de transición de estado
    if (taskData.status) {
      this.validateStatusTransition(existingTask.status as TaskStatus, taskData.status);
      
      // REGLA: Una tarea padre no puede completarse si tiene subtareas pendientes
      if (taskData.status === TaskStatus.completed && existingTask.subtasks.length > 0) {
        const pendingSubtasks = existingTask.subtasks.filter(
          (st) => st.status !== 'completed' && st.status !== 'cancelled',
        );
        if (pendingSubtasks.length > 0) {
          throw new BadRequestException(
            `No se puede completar la tarea porque tiene ${pendingSubtasks.length} subtarea(s) pendiente(s)`,
          );
        }
      }

      // REGLA: Al cancelar una tarea padre, cancelar automáticamente las subtareas
      if (taskData.status === TaskStatus.cancelled && existingTask.subtasks.length > 0) {
        await this.prismaService.task.updateMany({
          where: {
            parentTaskId: taskId,
            status: { notIn: ['completed', 'cancelled'] },
          },
          data: { status: 'cancelled' },
        });
      }
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

    // REGLA: Validaciones de fechas
    const parsedStartDate = startDate !== undefined ? (startDate ? new Date(startDate) : null) : undefined;
    const parsedDueDate = dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined;

    const effectiveStartDate = parsedStartDate !== undefined ? parsedStartDate : existingTask.startDate;
    const effectiveDueDate = parsedDueDate !== undefined ? parsedDueDate : existingTask.dueDate;

    // dueDate no puede ser anterior a startDate
    if (effectiveStartDate && effectiveDueDate && effectiveDueDate < effectiveStartDate) {
      throw new BadRequestException('La fecha de vencimiento no puede ser anterior a la fecha de inicio');
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
        startDate: parsedStartDate,
        dueDate: parsedDueDate,
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
        // REGLA: No permitir asignar usuarios eliminados
        const users = await this.prismaService.user.findMany({
          where: { 
            userId: { in: assignedUserIds },
            deletedAt: null,
          },
        });
        if (users.length !== assignedUserIds.length) {
          throw new BadRequestException('Uno o más usuarios asignados no existen o han sido eliminados');
        }

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
      include: { subtasks: true },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // REGLA: No permitir eliminar una tarea padre si tiene subtareas activas
    if (task.subtasks.length > 0) {
      const activeSubtasks = task.subtasks.filter(
        (st) => st.status !== 'completed' && st.status !== 'cancelled',
      );
      if (activeSubtasks.length > 0) {
        throw new BadRequestException(
          `No se puede eliminar la tarea porque tiene ${activeSubtasks.length} subtarea(s) activa(s). Complete o cancele las subtareas primero.`,
        );
      }
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
      include: { subtasks: true },
    });

    if (!existingTask) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // REGLA: No permitir reabrir tareas canceladas
    if (existingTask.status === 'cancelled' && status !== TaskStatus.cancelled) {
      throw new BadRequestException('No se puede reabrir una tarea cancelada');
    }

    // REGLA: Validaciones de transición de estado
    this.validateStatusTransition(existingTask.status as TaskStatus, status);

    // REGLA: Una tarea padre no puede completarse si tiene subtareas pendientes
    if (status === TaskStatus.completed && existingTask.subtasks.length > 0) {
      const pendingSubtasks = existingTask.subtasks.filter(
        (st) => st.status !== 'completed' && st.status !== 'cancelled',
      );
      if (pendingSubtasks.length > 0) {
        throw new BadRequestException(
          `No se puede completar la tarea porque tiene ${pendingSubtasks.length} subtarea(s) pendiente(s)`,
        );
      }
    }

    // REGLA: Al cancelar una tarea padre, cancelar automáticamente las subtareas
    if (status === TaskStatus.cancelled && existingTask.subtasks.length > 0) {
      await this.prismaService.task.updateMany({
        where: {
          parentTaskId: taskId,
          status: { notIn: ['completed', 'cancelled'] },
        },
        data: { status: 'cancelled' },
      });
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
        parentTask: { select: { taskId: true, title: true } },
        assignments: {
          include: {
            user: { select: { userId: true, name: true, lastName: true, email: true } },
          },
        },
      },
    });

    // Notificar cambio de estado a usuarios asignados
    await this.notificationService.notifyTaskStatusChanged(taskId, task.title, status);

    // Si se completó una subtarea, notificar a los asignados de la tarea padre
    if (status === TaskStatus.completed && task.parentTask) {
      await this.notificationService.notifySubtaskCompleted(
        task.parentTask.taskId,
        task.title,
        task.parentTask.title,
      );
    }

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

    // Verificar que el usuario existe y no está eliminado
    const user = await this.prismaService.user.findUnique({
      where: { userId },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // REGLA: No permitir asignar usuarios eliminados (deletedAt no nulo)
    if (user.deletedAt) {
      throw new BadRequestException('No se puede asignar un usuario eliminado a una tarea');
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
        task: { 
          select: { 
            title: true,
            project: { select: { name: true } },
          },
        },
      },
    });

    // Notificar al usuario asignado
    await this.notificationService.notifyTaskAssigned(
      taskId,
      userId,
      assignment.task.title,
      assignment.task.project.name,
    );

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
      include: {
        task: { select: { title: true } },
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

    // Notificar al usuario desasignado
    await this.notificationService.notifyTaskUnassigned(taskId, userId, assignment.task.title);

    return {
      statusCode: HttpStatus.OK,
      message: 'Usuario desasignado correctamente',
      data: null,
    };
  }

  /**
   * Validar transiciones de estado permitidas
   * REGLAS:
   * - No permitir pasar directamente de pending a completed (debe pasar por in_progress)
   * - Solo tareas en in_progress pueden marcarse como completed
   * - No permitir reabrir tareas canceladas (manejado por separado)
   */
  private validateStatusTransition(currentStatus: TaskStatus, newStatus: TaskStatus): void {
    // Si el estado no cambia, no hay que validar
    if (currentStatus === newStatus) {
      return;
    }

    // Definir transiciones válidas
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.pending]: [TaskStatus.in_progress, TaskStatus.cancelled],
      [TaskStatus.in_progress]: [TaskStatus.pending, TaskStatus.completed, TaskStatus.cancelled],
      [TaskStatus.completed]: [TaskStatus.in_progress], // Permitir reabrir si es necesario
      [TaskStatus.cancelled]: [], // No se puede cambiar desde cancelado
    };

    const allowedTransitions = validTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
      const statusLabels: Record<TaskStatus, string> = {
        [TaskStatus.pending]: 'Pendiente',
        [TaskStatus.in_progress]: 'En progreso',
        [TaskStatus.completed]: 'Completada',
        [TaskStatus.cancelled]: 'Cancelada',
      };

      throw new BadRequestException(
        `No se puede cambiar el estado de "${statusLabels[currentStatus]}" a "${statusLabels[newStatus]}". ` +
        (currentStatus === TaskStatus.pending && newStatus === TaskStatus.completed
          ? 'La tarea debe pasar por "En progreso" antes de completarse.'
          : 'Transición de estado no permitida.'),
      );
    }
  }

  /**
   * Verificar si todas las tareas de un proyecto están completadas o canceladas
   * Usado por ProjectService antes de completar un proyecto
   */
  async areAllTasksCompletedOrCancelled(projectId: number): Promise<{
    allCompleted: boolean;
    pendingCount: number;
    inProgressCount: number;
  }> {
    const tasks = await this.prismaService.task.findMany({
      where: { projectId },
      select: { status: true },
    });

    const pendingCount = tasks.filter((t) => t.status === 'pending').length;
    const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;

    return {
      allCompleted: pendingCount === 0 && inProgressCount === 0,
      pendingCount,
      inProgressCount,
    };
  }
}
