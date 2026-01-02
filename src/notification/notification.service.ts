import { Injectable, NotFoundException, HttpStatus, Logger, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateNotificationDto, NotificationType } from './dto';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger('NotificationService');
  private readonly appUrl: string;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => NotificationGateway))
    private readonly notificationGateway: NotificationGateway,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:5173';
  }

  /**
   * Construir URL completa para la notificación
   */
  private buildUrl(path: string): string {
    return `${this.appUrl}${path}`;
  }

  /**
   * Crear una notificación y emitirla por WebSocket
   */
  async create(createNotificationDto: CreateNotificationDto) {
    const notification = await this.prismaService.notification.create({
      data: createNotificationDto,
      include: {
        user: { select: { userId: true, name: true, lastName: true, email: true } },
        project: { select: { projectId: true, name: true, code: true } },
        task: { select: { taskId: true, title: true } },
        request: { select: { requestId: true, description: true } },
        emergency: { select: { emergencyId: true, title: true } },
        purchaseOrder: { select: { purchaseOrderId: true, code: true } },
      },
    });

    this.logger.log(`Notificación creada: ${notification.type} para usuario ${notification.userId}`);

    // Emitir por WebSocket en tiempo real
    this.notificationGateway.sendNotificationToUser(notification.userId, notification);
    
    // Actualizar contador de no leídas
    const unreadResult = await this.getUnreadCount(notification.userId);
    this.notificationGateway.sendUnreadCountToUser(notification.userId, unreadResult.data.unreadCount);

    return notification;
  }

  /**
   * Crear múltiples notificaciones (para enviar a varios usuarios) y emitirlas
   */
  async createMany(notifications: CreateNotificationDto[]) {
    const created = await this.prismaService.notification.createMany({
      data: notifications,
    });

    this.logger.log(`${created.count} notificaciones creadas`);

    // Obtener las notificaciones creadas para emitirlas por WebSocket
    // Emitir a cada usuario su notificación
    const userIds = [...new Set(notifications.map(n => n.userId))];
    for (const userId of userIds) {
      const userNotifications = await this.prismaService.notification.findMany({
        where: { userId, isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          project: { select: { projectId: true, name: true, code: true } },
          task: { select: { taskId: true, title: true } },
          request: { select: { requestId: true, description: true } },
          emergency: { select: { emergencyId: true, title: true } },
          purchaseOrder: { select: { purchaseOrderId: true, code: true } },
        },
      });

      // Emitir evento de nuevas notificaciones
      if (userNotifications.length > 0) {
        this.notificationGateway.sendNotificationToUser(userId, userNotifications[0]);
      }

      // Actualizar contador
      const unreadResult = await this.getUnreadCount(userId);
      this.notificationGateway.sendUnreadCountToUser(userId, unreadResult.data.unreadCount);
    }

    return created;
  }

  /**
   * Obtener notificaciones de un usuario
   */
  async findByUser(userId: number, options?: { onlyUnread?: boolean; limit?: number }) {
    const { onlyUnread = false, limit = 50 } = options || {};

    const notifications = await this.prismaService.notification.findMany({
      where: {
        userId,
        ...(onlyUnread ? { isRead: false } : {}),
      },
      include: {
        project: { select: { projectId: true, name: true, code: true } },
        task: { select: { taskId: true, title: true } },
        request: { select: { requestId: true, description: true } },
        emergency: { select: { emergencyId: true, title: true } },
        purchaseOrder: { select: { purchaseOrderId: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Notificaciones obtenidas correctamente',
      data: notifications,
    };
  }

  /**
   * Obtener conteo de notificaciones no leídas
   */
  async getUnreadCount(userId: number) {
    const count = await this.prismaService.notification.count({
      where: { userId, isRead: false },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Conteo obtenido correctamente',
      data: { unreadCount: count },
    };
  }

  /**
   * Marcar una notificación como leída
   */
  async markAsRead(notificationId: number, userId: number) {
    const notification = await this.prismaService.notification.findFirst({
      where: { notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    const updated = await this.prismaService.notification.update({
      where: { notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Notificación marcada como leída',
      data: updated,
    };
  }

  /**
   * Marcar todas las notificaciones de un usuario como leídas
   */
  async markAllAsRead(userId: number) {
    const result = await this.prismaService.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return {
      statusCode: HttpStatus.OK,
      message: `${result.count} notificaciones marcadas como leídas`,
      data: { updatedCount: result.count },
    };
  }

  /**
   * Eliminar una notificación
   */
  async remove(notificationId: number, userId: number) {
    const notification = await this.prismaService.notification.findFirst({
      where: { notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notificación no encontrada');
    }

    await this.prismaService.notification.delete({
      where: { notificationId },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Notificación eliminada correctamente',
      data: null,
    };
  }

  /**
   * Eliminar todas las notificaciones leídas de un usuario
   */
  async removeAllRead(userId: number) {
    const result = await this.prismaService.notification.deleteMany({
      where: { userId, isRead: true },
    });

    return {
      statusCode: HttpStatus.OK,
      message: `${result.count} notificaciones eliminadas`,
      data: { deletedCount: result.count },
    };
  }

  // ==================== DEBUG ====================
  
  /**
   * DEBUG: Obtener tipos de usuario y usuarios por tipo
   */
  async debugGetUserTypes() {
    const userTypes = await this.prismaService.userType.findMany();
    
    const usersWithTypes = await this.prismaService.user.findMany({
      where: { deletedAt: null },
      select: {
        userId: true,
        name: true,
        email: true,
        userUserTypes: {
          select: {
            userType: { select: { name: true } }
          }
        }
      }
    });

    return {
      statusCode: HttpStatus.OK,
      data: {
        userTypes,
        users: usersWithTypes.map(u => ({
          ...u,
          types: u.userUserTypes.map(ut => ut.userType.name)
        }))
      }
    };
  }

  // ==================== MÉTODOS HELPER PARA CREAR NOTIFICACIONES ====================

  /**
   * Notificar a usuarios por tipo de rol
   */
  async notifyByUserType(
    userTypeNames: string[],
    notification: Omit<CreateNotificationDto, 'userId'>,
  ) {
    // Buscar usuarios que tengan alguno de los tipos especificados (case-insensitive)
    const users = await this.prismaService.user.findMany({
      where: {
        deletedAt: null,
        userUserTypes: {
          some: {
            userType: {
              name: { 
                in: userTypeNames,
                mode: 'insensitive',
              },
            },
          },
        },
      },
      select: { userId: true },
    });

    this.logger.log(`notifyByUserType: Buscando usuarios con tipos [${userTypeNames.join(', ')}]. Encontrados: ${users.length}`);

    if (users.length === 0) {
      this.logger.warn(`No se encontraron usuarios con los tipos: ${userTypeNames.join(', ')}`);
      return;
    }

    const notifications = users.map((user) => ({
      ...notification,
      userId: user.userId,
    }));

    return this.createMany(notifications);
  }

  /**
   * Notificar a usuarios asignados a una tarea
   */
  async notifyTaskAssignees(
    taskId: number,
    notification: Omit<CreateNotificationDto, 'userId' | 'taskId'>,
    excludeUserId?: number,
  ) {
    const assignments = await this.prismaService.taskAssignment.findMany({
      where: { taskId },
      select: { userId: true },
    });

    const userIds = assignments
      .map((a) => a.userId)
      .filter((id) => id !== excludeUserId);

    if (userIds.length === 0) return;

    const notifications = userIds.map((userId) => ({
      ...notification,
      userId,
      taskId,
    }));

    return this.createMany(notifications);
  }

  // ==================== MÉTODOS ESPECÍFICOS POR CASO DE USO ====================

  // ----- TAREAS -----

  async notifyTaskAssigned(taskId: number, userId: number, taskTitle: string, projectId: number, projectName: string) {
    return this.create({
      userId,
      type: NotificationType.task_assigned,
      title: 'Nueva tarea asignada',
      message: `Te han asignado la tarea "${taskTitle}" en el proyecto ${projectName}`,
      taskId,
      projectId,
      url: this.buildUrl(`/admin/projects/${projectId}/progress`),
    });
  }

  async notifyTaskUnassigned(taskId: number, userId: number, taskTitle: string, projectId: number) {
    return this.create({
      userId,
      type: NotificationType.task_unassigned,
      title: 'Tarea desasignada',
      message: `Has sido removido de la tarea "${taskTitle}"`,
      taskId,
      projectId,
      url: this.buildUrl(`/admin/projects/${projectId}/progress`),
    });
  }

  async notifyTaskStatusChanged(
    taskId: number,
    taskTitle: string,
    newStatus: string,
    projectId: number,
    excludeUserId?: number,
  ) {
    const statusLabels: Record<string, string> = {
      pending: 'Pendiente',
      in_progress: 'En progreso',
      completed: 'Completada',
      cancelled: 'Cancelada',
    };

    return this.notifyTaskAssignees(
      taskId,
      {
        type: NotificationType.task_status_changed,
        title: 'Estado de tarea actualizado',
        message: `La tarea "${taskTitle}" cambió a "${statusLabels[newStatus] || newStatus}"`,
        projectId,
        url: this.buildUrl(`/admin/projects/${projectId}/progress`),
      },
      excludeUserId,
    );
  }

  async notifyTaskDueSoon(taskId: number, taskTitle: string, daysRemaining: number, projectId: number) {
    return this.notifyTaskAssignees(taskId, {
      type: NotificationType.task_due_soon,
      title: 'Tarea próxima a vencer',
      message: `La tarea "${taskTitle}" vence en ${daysRemaining} día(s)`,
      projectId,
      url: this.buildUrl(`/admin/projects/${projectId}/progress`),
    });
  }

  async notifyTaskOverdue(taskId: number, taskTitle: string, projectId: number) {
    return this.notifyTaskAssignees(taskId, {
      type: NotificationType.task_overdue,
      title: '⚠️ Tarea vencida',
      message: `La tarea "${taskTitle}" ha vencido`,
      projectId,
      url: this.buildUrl(`/admin/projects/${projectId}/progress`),
    });
  }

  async notifySubtaskCompleted(
    parentTaskId: number,
    subtaskTitle: string,
    parentTaskTitle: string,
    projectId: number,
  ) {
    return this.notifyTaskAssignees(parentTaskId, {
      type: NotificationType.subtask_completed,
      title: 'Subtarea completada',
      message: `La subtarea "${subtaskTitle}" de "${parentTaskTitle}" fue completada`,
      projectId,
      url: this.buildUrl(`/admin/projects/${projectId}/progress`),
    });
  }

  // ----- SOLICITUDES -----

  async notifyRequestCreated(
    requestId: number,
    projectId: number,
    projectName: string,
    requestType: string,
  ) {
    const typeLabels: Record<string, string> = {
      epp: 'EPP',
      operative: 'Operativo',
      eppAndOperative: 'EPP y Operativo',
    };

    return this.notifyByUserType(['ADMINISTRADORA', 'LOGISTICA'], {
      type: NotificationType.request_created,
      title: 'Nueva solicitud',
      message: `Nueva solicitud de ${typeLabels[requestType] || requestType} en proyecto ${projectName}`,
      requestId,
      projectId,
      url: this.buildUrl(`/admin/requests/${requestId}`),
    });
  }

  async notifyRequestApproved(requestId: number, userId: number, requestDescription: string) {
    return this.create({
      userId,
      type: NotificationType.request_approved,
      title: 'Solicitud aprobada',
      message: `Tu solicitud #${requestId} fue aprobada`,
      requestId,
      url: this.buildUrl(`/admin/requests/${requestId}`),
    });
  }

  async notifyRequestRejected(requestId: number, userId: number, reason?: string) {
    return this.create({
      userId,
      type: NotificationType.request_rejected,
      title: 'Solicitud rechazada',
      message: `Tu solicitud #${requestId} fue rechazada${reason ? `: ${reason}` : ''}`,
      requestId,
      url: this.buildUrl(`/admin/requests/${requestId}`),
    });
  }

  async notifyRequestResponded(requestId: number, userId: number) {
    return this.create({
      userId,
      type: NotificationType.request_responded,
      title: 'Respuesta a solicitud',
      message: `Tu solicitud #${requestId} tiene una nueva respuesta`,
      requestId,
      url: this.buildUrl(`/admin/requests/${requestId}`),
    });
  }

  // ----- EMERGENCIAS -----

  async notifyEmergencyCreated(
    emergencyId: number,
    projectId: number,
    projectName: string,
    emergencyTitle: string,
  ) {
    return this.notifyByUserType(['GERENTE', 'ADMINISTRADORA'], {
      type: NotificationType.emergency_created,
      title: '🚨 Nueva emergencia',
      message: `Emergencia reportada en ${projectName}: "${emergencyTitle}"`,
      emergencyId,
      projectId,
      url: this.buildUrl(`/admin/emergencies/${emergencyId}`),
    });
  }

  async notifyEmergencyAddressed(emergencyId: number, userId: number, emergencyTitle: string) {
    return this.create({
      userId,
      type: NotificationType.emergency_addressed,
      title: 'Emergencia atendida',
      message: `Tu emergencia "${emergencyTitle}" fue atendida`,
      emergencyId,
      url: this.buildUrl(`/admin/emergencies/${emergencyId}`),
    });
  }

  async notifyEmergencyRejected(emergencyId: number, userId: number, emergencyTitle: string) {
    return this.create({
      userId,
      type: NotificationType.emergency_rejected,
      title: 'Emergencia rechazada',
      message: `Tu emergencia "${emergencyTitle}" fue rechazada`,
      emergencyId,
      url: this.buildUrl(`/admin/emergencies/${emergencyId}`),
    });
  }

  // ----- ÓRDENES DE COMPRA -----

  async notifyPurchaseOrderPending(purchaseOrderId: number, code: string, projectName: string, projectId: number) {
    return this.notifyByUserType(['GERENTE'], {
      type: NotificationType.purchase_order_pending,
      title: 'OC pendiente de autorización',
      message: `La orden de compra ${code} del proyecto ${projectName} requiere autorización`,
      purchaseOrderId,
      url: this.buildUrl(`/admin/projects/${projectId}/purchase-orders/edit/${purchaseOrderId}`),
    });
  }

  async notifyPurchaseOrderAuthorized(purchaseOrderId: number, code: string, projectId: number) {
    return this.notifyByUserType(['LOGISTICA', 'ADMINISTRADORA'], {
      type: NotificationType.purchase_order_authorized,
      title: 'OC autorizada',
      message: `La orden de compra ${code} fue autorizada`,
      purchaseOrderId,
      url: this.buildUrl(`/admin/projects/${projectId}/purchase-orders/${purchaseOrderId}`),
    });
  }

  async notifyPurchaseOrderDelivered(purchaseOrderId: number, code: string, creatorUserId: number, projectId: number) {
    return this.create({
      userId: creatorUserId,
      type: NotificationType.purchase_order_delivered,
      title: 'OC entregada',
      message: `La orden de compra ${code} fue entregada`,
      purchaseOrderId,
      url: this.buildUrl(`/admin/projects/${projectId}/purchase-orders/${purchaseOrderId}`),
    });
  }

  async notifyPurchaseOrderCancelled(purchaseOrderId: number, code: string, projectId: number) {
    return this.notifyByUserType(['GERENTE', 'ADMINISTRADORA', 'LOGISTICA'], {
      type: NotificationType.purchase_order_cancelled,
      title: 'OC cancelada',
      message: `La orden de compra ${code} fue cancelada`,
      purchaseOrderId,
      url: this.buildUrl(`/admin/purchase-orders/${purchaseOrderId}`),
    });
  }

  // ----- PROYECTOS -----

  async notifyProjectCreated(projectId: number, projectName: string, projectCode: string) {
    // Notificar a TODOS los usuarios activos
    const users = await this.prismaService.user.findMany({
      where: { deletedAt: null },
      select: { userId: true },
    });

    this.logger.log(`notifyProjectCreated: Notificando a ${users.length} usuarios sobre el nuevo proyecto "${projectName}"`);

    if (users.length === 0) {
      this.logger.warn('No se encontraron usuarios activos para notificar');
      return;
    }

    const notifications = users.map((user) => ({
      type: NotificationType.project_created,
      title: 'Nuevo proyecto',
      message: `Se ha creado el proyecto "${projectName}" (${projectCode})`,
      projectId,
      userId: user.userId,
      url: this.buildUrl(`/admin/projects/${projectId}`),
    }));

    return this.createMany(notifications);
  }

  async notifyProjectCompleted(projectId: number, projectName: string) {
    return this.notifyByUserType(['GERENTE', 'ADMINISTRADORA'], {
      type: NotificationType.project_completed,
      title: 'Proyecto completado',
      message: `El proyecto "${projectName}" ha sido completado`,
      projectId,
      url: this.buildUrl(`/admin/projects/${projectId}`),
    });
  }

  async notifyProjectInactivated(projectId: number, projectName: string) {
    return this.notifyByUserType(['GERENTE', 'ADMINISTRADORA'], {
      type: NotificationType.project_inactivated,
      title: 'Proyecto inactivado',
      message: `El proyecto "${projectName}" ha sido inactivado`,
      projectId,
      url: this.buildUrl(`/admin/projects/${projectId}`),
    });
  }
}
