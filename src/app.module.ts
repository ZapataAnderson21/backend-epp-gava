import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { UserTypeModule } from './user_type/user_type.module';
import { UserUserTypeModule } from './user_user_type/user_user_type.module';
import { ProjectModule } from './project/project.module';
import { ElementModule } from './element/element.module';
import { RequestModule } from './request/request.module';
import { ElementRequestModule } from './element_request/element_request.module';
import { RequestResponseModule } from './request_response/request_response.module';
import { ElementRequestResponseModule } from './element_request_response/element_request_response.module';
import { MailService } from './mail/mail.service';

@Module({
  imports: [UserModule, UserTypeModule, UserUserTypeModule, ProjectModule, ElementModule, RequestModule, 
            ElementRequestModule, RequestResponseModule, ElementRequestResponseModule],
  controllers: [],
  providers: [MailService],
})
export class AppModule {}
