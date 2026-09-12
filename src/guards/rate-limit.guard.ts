import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { createHash } from 'crypto';
import {
  RATE_LIMIT_KEY,
  RateLimitOptions,
} from 'src/decorators/rate-limit.decorator';
import { PrismaService } from 'src/prisma/prisma.service';

type BucketResult = { count: number; resetAt: Date };

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const route = `${request.method}:${request.path}`;
    const normalizedEmail = this.getNormalizedEmail(request);
    const identifiers = [
      `ip:${request.ip || request.socket.remoteAddress || 'unknown'}`,
      ...(normalizedEmail ? [`account:${normalizedEmail}`] : []),
    ];

    for (const identifier of identifiers) {
      const bucket = await this.incrementBucket(
        this.hashKey(`${route}:${identifier}`),
        options.windowMs,
      );
      if (bucket.count > options.limit) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((bucket.resetAt.getTime() - Date.now()) / 1000),
        );
        throw new HttpException(
          `Demasiadas solicitudes. Intente nuevamente en ${retryAfterSeconds} segundos.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    return true;
  }

  private async incrementBucket(
    key: string,
    windowMs: number,
  ): Promise<BucketResult> {
    const now = new Date();
    const newResetAt = new Date(now.getTime() + windowMs);
    const rows = await this.prisma.$queryRaw<BucketResult[]>`
      INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
      VALUES (${key}, 1, ${newResetAt}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
          ELSE "RateLimitBucket"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${newResetAt}
          ELSE "RateLimitBucket"."resetAt"
        END,
        "updatedAt" = ${now}
      RETURNING "count", "resetAt"
    `;
    return rows[0];
  }

  private getNormalizedEmail(request: Request): string | null {
    const body = request.body as { email?: unknown } | undefined;
    return typeof body?.email === 'string'
      ? body.email.trim().toLowerCase().slice(0, 254)
      : null;
  }

  private hashKey(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
