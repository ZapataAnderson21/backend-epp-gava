import { Module } from '@nestjs/common';
import { ElementRequestResponseService } from './element_request_response.service';
import { ElementRequestResponseController } from './element_request_response.controller';

@Module({
  controllers: [ElementRequestResponseController],
  providers: [ElementRequestResponseService],
})
export class ElementRequestResponseModule {}
