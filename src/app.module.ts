import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './user/user.module';
import { UserTypeModule } from './user_type/user_type.module';
import { ProjectModule } from './project/project.module';
import { ElementModule } from './element/element.module';
import { RequestModule } from './request/request.module';
import { ElementRequestModule } from './element_request/element_request.module';
import { RequestResponseModule } from './request_response/request_response.module';
import { ElementRequestResponseModule } from './element_request_response/element_request_response.module';
import { MailService } from './mail/mail.service';
import { PdfService } from './pdf/pdf.service';
import { EmergencyModule } from './emergency/emergency.module';
import { RequestWorkerModule } from './request-worker/request-worker.module';

@Module({
  imports: [UserModule, UserTypeModule, ProjectModule, ElementModule, RequestModule, 
            ElementRequestModule, RequestResponseModule, ElementRequestResponseModule,
            ConfigModule.forRoot({ isGlobal: true}),
            EmergencyModule,
            RequestWorkerModule
          ],
  controllers: [],
  providers: [MailService, PdfService],
})
export class AppModule {}
