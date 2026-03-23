import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { JwtStrategy } from './jwt/jwt-strategy';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './jwt/jwt.constants';
import { UserTypeService } from 'src/user_type/user_type.service';
import { UserUserTypeService } from 'src/user_user_type/user_user_type.service';
import { MailService } from 'src/mail/mail.service';
import { PdfService } from 'src/pdf/pdf.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RateLimitGuard } from 'src/guards/rate-limit.guard';

@Module({
  controllers: [UserController],
  providers: [
    UserService,
    UserTypeService,
    UserUserTypeService,
    MailService,
    PdfService,
    JwtStrategy,
    RateLimitGuard,
  ],
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || jwtConstants.secret,
        signOptions: { expiresIn: '3h' },
      }),
    }),
  ],
})
export class UserModule {}
