import { Module } from '@nestjs/common';
import { ElementRequestService } from './element_request.service';
import { ElementRequestController } from './element_request.controller';

@Module({
  controllers: [ElementRequestController],
  providers: [ElementRequestService],
})
export class ElementRequestModule {}
