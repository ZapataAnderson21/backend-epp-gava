import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';

const defaultCorsOrigins = [
  'http://localhost:5173',
  'http://sir.gavacyc.com',
  'https://sir.gavacyc.com',
];

const websocketCorsOrigins = (
  process.env.CORS_ORIGINS || defaultCorsOrigins.join(',')
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

@WebSocketGateway({
  cors: {
    origin: websocketCorsOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: 'notifications',
  transports: ['websocket', 'polling'],
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('NotificationGateway');

  // Mapa de userId -> socketId[] (un usuario puede tener múltiples conexiones)
  private userSockets: Map<number, Set<string>> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prismaService: PrismaService,
  ) {}

  afterInit() {
    this.logger.log(
      'WebSocket Gateway initialized on namespace /notifications',
    );
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client attempting connection: ${client.id}`);

    try {
      // Obtener token del handshake (query o auth header)
      const token =
        client.handshake.auth?.token ||
        (client.handshake.query?.token as string);

      this.logger.debug(`Token received: ${token ? 'Yes' : 'No'}`);

      if (!token) {
        this.logger.warn(
          `Client ${client.id} connection rejected: No token provided`,
        );
        client.emit('error', { message: 'No token provided' });
        client.disconnect();
        return;
      }

      const normalizedToken = token.replace(/^Bearer\s+/i, '').trim();

      // Verificar y decodificar el JWT
      let payload: any;
      try {
        payload = this.jwtService.verify(normalizedToken);
        this.logger.debug(`JWT payload: ${JSON.stringify(payload)}`);
      } catch (jwtError) {
        this.logger.error(
          `JWT verification failed for client ${client.id}: ${jwtError.message}`,
        );
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      const blacklistedToken =
        await this.prismaService.blacklistedToken.findUnique({
          where: { token: normalizedToken },
        });

      if (blacklistedToken) {
        this.logger.warn(
          `Client ${client.id} connection rejected: Token is blacklisted`,
        );
        client.emit('error', { message: 'Session expired' });
        client.disconnect();
        return;
      }

      const userId = payload.userId || payload.sub;

      if (!userId) {
        this.logger.warn(
          `Client ${client.id} connection rejected: Invalid token payload (no userId)`,
        );
        client.emit('error', { message: 'Invalid token payload' });
        client.disconnect();
        return;
      }

      // Guardar la relación usuario-socket
      client.data.userId = userId;

      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Unir al usuario a su room personal
      client.join(`user_${userId}`);

      // Emitir confirmación de conexión exitosa
      client.emit('connected', {
        userId,
        message: 'Successfully connected to notifications',
      });

      this.logger.log(
        `Client connected successfully: ${client.id} (User: ${userId})`,
      );
    } catch (error) {
      this.logger.error(
        `Client ${client.id} connection error: ${error.message}`,
      );
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);

      // Si el usuario ya no tiene conexiones activas, eliminar del mapa
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Enviar notificación a un usuario específico
  sendNotificationToUser(userId: number, notification: any) {
    this.server.to(`user_${userId}`).emit('notification', notification);
    this.logger.log(`Notification sent to user ${userId}`);
  }

  // Enviar notificación a múltiples usuarios
  sendNotificationToUsers(userIds: number[], notification: any) {
    userIds.forEach((userId) => {
      this.sendNotificationToUser(userId, notification);
    });
  }

  // Enviar actualización del contador de no leídas
  sendUnreadCountToUser(userId: number, count: number) {
    this.server.to(`user_${userId}`).emit('unreadCount', { count });
  }

  sendRequestMailProgressToUser(userId: number, progress: any) {
    this.server.to(`user_${userId}`).emit('requestMailProgress', progress);
  }

  // Verificar si un usuario está conectado
  isUserOnline(userId: number): boolean {
    return (
      this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0
    );
  }

  // Obtener usuarios conectados
  getOnlineUsers(): number[] {
    return Array.from(this.userSockets.keys());
  }

  // Cliente puede solicitar el contador de no leídas
  @SubscribeMessage('getUnreadCount')
  handleGetUnreadCount(client: Socket) {
    // Este mensaje se manejará en el servicio cuando se integre
    const userId = client.data.userId;
    this.logger.log(`User ${userId} requested unread count`);
    return { event: 'getUnreadCount', data: { userId } };
  }

  // Cliente puede marcar notificación como leída via WebSocket
  @SubscribeMessage('markAsRead')
  handleMarkAsRead(client: Socket, payload: { notificationId: number }) {
    const userId = client.data.userId;
    this.logger.log(
      `User ${userId} marking notification ${payload.notificationId} as read`,
    );
    return { event: 'markAsRead', data: { ...payload, userId } };
  }
}
