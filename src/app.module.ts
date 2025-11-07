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
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { SupplierModule } from './supplier/supplier.module';
import { WorkerModule } from './worker/worker.module';
import { CategoryResourceModule } from './category-resource/category-resource.module';
import { ResourceModule } from './resource/resource.module';
import { ResourcePurchaseOrderModule } from './resource-purchase-order/resource-purchase-order.module';
import { PettyCashModule } from './petty-cash/petty-cash.module';
import { ServiceSaleModule } from './service-sale/service-sale.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './user/jwt/jwt.auth.guard';
import { UserTypesGuard } from './guards/user-types.guard';

@Module({
  imports: [UserModule, UserTypeModule, ProjectModule, ElementModule, RequestModule, 
            ElementRequestModule, RequestResponseModule, ElementRequestResponseModule,
            ConfigModule.forRoot({ isGlobal: true}),
            EmergencyModule,
            RequestWorkerModule,
            PurchaseOrderModule,
            SupplierModule,
            WorkerModule,
            CategoryResourceModule,
            ResourceModule,
            ResourcePurchaseOrderModule,
            PettyCashModule,
            ServiceSaleModule
          ],
  controllers: [],
  providers: [MailService, 
              PdfService,
              { provide: APP_GUARD, useClass: JwtAuthGuard },
              { provide: APP_GUARD, useClass: UserTypesGuard },
            ],
})
export class AppModule {}
