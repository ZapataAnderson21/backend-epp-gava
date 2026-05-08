import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConstants } from './jwt.constants';
import { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || jwtConstants.secret,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const token = req.headers.authorization?.replace('Bearer ', '').trim();

    const blacklistedToken = await this.prisma.blacklistedToken.findFirst({
      where: { token },
    });

    if (blacklistedToken) {
      throw new UnauthorizedException(
        'La sesión ha expirado. Por favor, inicie sesión de nuevo.',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: {
        userId: payload.userId,
        deletedAt: null,
      },
      select: {
        userId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'El usuario se encuentra deshabilitado o ya no existe.',
      );
    }

    return { userId: payload.userId, email: payload.email };
  }
}
