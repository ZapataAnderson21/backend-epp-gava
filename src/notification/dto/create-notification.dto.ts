import { IsString, IsInt, IsEnum, IsOptional } from 'class-validator';

export enum NotificationType {
  // Tareas
  task_assigned = 'task_assigned',
  task_unassigned = 'task_unassigned',
  task_due_soon = 'task_due_soon',
  task_overdue = 'task_overdue',
  task_status_changed = 'task_status_changed',
  task_completed = 'task_completed',
  subtask_completed = 'subtask_completed',

  // Solicitudes
  request_created = 'request_created',
  request_approved = 'request_approved',
  request_rejected = 'request_rejected',
  request_responded = 'request_responded',
  request_due_soon = 'request_due_soon',

  // Emergencias
  emergency_created = 'emergency_created',
  emergency_addressed = 'emergency_addressed',
  emergency_rejected = 'emergency_rejected',

  // Órdenes de Compra
  purchase_order_pending = 'purchase_order_pending',
  purchase_order_authorized = 'purchase_order_authorized',
  purchase_order_delivered = 'purchase_order_delivered',
  purchase_order_cancelled = 'purchase_order_cancelled',

  // Proyectos
  project_created = 'project_created',
  project_completed = 'project_completed',
  project_inactivated = 'project_inactivated',

  // Sistema
  system_reminder = 'system_reminder',
}

export class CreateNotificationDto {
  @IsInt()
  userId: number;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsInt()
  taskId?: number;

  @IsOptional()
  @IsInt()
  requestId?: number;

  @IsOptional()
  @IsInt()
  emergencyId?: number;

  @IsOptional()
  @IsInt()
  purchaseOrderId?: number;

  @IsOptional()
  @IsInt()
  projectId?: number;
}
