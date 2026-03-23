import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  ParseIntPipe,
  ParseBoolPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { GetUser } from 'src/decorators/get-user.decorator';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /notification
   * Obtener notificaciones del usuario autenticado
   */
  @Get()
  findMyNotifications(
    @GetUser('userId') userId: number,
    @Query('onlyUnread', new DefaultValuePipe(false), ParseBoolPipe)
    onlyUnread: boolean,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.notificationService.findByUser(userId, { onlyUnread, limit });
  }

  /**
   * GET /notification/unread-count
   * Obtener conteo de notificaciones no leídas
   */
  @Get('unread-count')
  getUnreadCount(@GetUser('userId') userId: number) {
    return this.notificationService.getUnreadCount(userId);
  }

  /**
   * POST /notification/:notificationId/read
   * Marcar una notificación como leída
   */
  @Post(':notificationId/read')
  markAsRead(
    @Param('notificationId', ParseIntPipe) notificationId: number,
    @GetUser('userId') userId: number,
  ) {
    return this.notificationService.markAsRead(notificationId, userId);
  }

  /**
   * POST /notification/read-all
   * Marcar todas las notificaciones como leídas
   */
  @Post('read-all')
  markAllAsRead(@GetUser('userId') userId: number) {
    return this.notificationService.markAllAsRead(userId);
  }

  /**
   * DELETE /notification/:notificationId
   * Eliminar una notificación
   */
  @Delete(':notificationId')
  remove(
    @Param('notificationId', ParseIntPipe) notificationId: number,
    @GetUser('userId') userId: number,
  ) {
    return this.notificationService.remove(notificationId, userId);
  }

  /**
   * DELETE /notification/read
   * Eliminar todas las notificaciones leídas
   */
  @Delete('read')
  removeAllRead(@GetUser('userId') userId: number) {
    return this.notificationService.removeAllRead(userId);
  }
}
