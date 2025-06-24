import { Module } from '@nestjs/common';
import { ElementRequestService } from './element_request.service';
import { ElementRequestController } from './element_request.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ElementRequestController],
  providers: [ElementRequestService, PrismaService],
})
export class ElementRequestModule {}
