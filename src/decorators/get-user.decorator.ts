import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: Record<string, unknown>;
}

export const GetUser = createParamDecorator<string | undefined, unknown>(
  (data, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return null;
    }

    // Si se especifica una propiedad, retornar solo esa propiedad
    if (data) {
      return user[data];
    }

    // Si no, retornar el usuario completo
    return user;
  },
);
