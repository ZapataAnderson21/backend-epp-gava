import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSecurityRecords(): Promise<void> {
    const now = new Date();
    const usedBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [blacklisted, resetTokens, rateLimits] =
      await this.prisma.$transaction([
        this.prisma.blacklistedToken.deleteMany({
          where: { expiresAt: { lte: now } },
        }),
        this.prisma.passwordResetToken.deleteMany({
          where: {
            OR: [
              { expiresAt: { lte: now } },
              { used: true, usedAt: { lte: usedBefore } },
            ],
          },
        }),
        this.prisma.rateLimitBucket.deleteMany({
          where: { resetAt: { lte: now } },
        }),
      ]);

    const removed = blacklisted.count + resetTokens.count + rateLimits.count;
    if (removed > 0) {
      this.logger.log(
        `Registros de seguridad expirados eliminados: ${removed}`,
      );
    }
  }
}
