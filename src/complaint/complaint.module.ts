import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ComplaintController } from './complaint.controller';
import { ComplaintService } from './complaint.service';

@Module({
  imports: [PrismaModule],
  controllers: [ComplaintController],
  providers: [ComplaintService],
})
export class ComplaintModule {}
