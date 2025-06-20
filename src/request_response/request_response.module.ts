import { Module } from '@nestjs/common';
import { RequestResponseService } from './request_response.service';
import { RequestResponseController } from './request_response.controller';

@Module({
  controllers: [RequestResponseController],
  providers: [RequestResponseService],
})
export class RequestResponseModule {}
