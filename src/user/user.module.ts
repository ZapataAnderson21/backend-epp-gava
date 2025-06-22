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

@Module({
  controllers: [UserController],
  providers: [UserService, UserTypeService, 
              UserUserTypeService, MailService, 
              JwtStrategy],
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: { expiresIn: '3h' },
    })
  ],
})
export class UserModule {}
