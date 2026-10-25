import { Module } from '@nestjs/common';
import { SsomaController } from './ssoma.controller';
import { SsomaService } from './ssoma.service';

@Module({
  controllers: [SsomaController],
  providers: [SsomaService],
})
export class SsomaModule {}
