import { Module } from '@nestjs/common';
import { ElementService } from './element.service';
import { ElementController } from './element.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ElementController],
  providers: [ElementService, PrismaService],
})
export class ElementModule {}
