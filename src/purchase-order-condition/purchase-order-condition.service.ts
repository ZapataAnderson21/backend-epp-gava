import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreatePurchaseOrderConditionDto } from './dto/create-purchase-order-condition.dto';
import { FindPurchaseOrderConditionsQueryDto } from './dto/find-purchase-order-conditions-query.dto';

@Injectable()
export class PurchaseOrderConditionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePurchaseOrderConditionDto) {
    const content = this.cleanContent(dto.content);
    const normalizedContent = this.normalizeContent(content);

    const condition = await this.prisma.purchaseOrderCondition.upsert({
      where: {
        type_normalizedContent: {
          type: dto.type,
          normalizedContent,
        },
      },
      create: {
        type: dto.type,
        content,
        normalizedContent,
      },
      update: {
        content,
      },
      select: {
        purchaseOrderConditionId: true,
        type: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Condición guardada para reutilizarla en otras órdenes.',
      data: condition,
    };
  }

  async findAll(query: FindPurchaseOrderConditionsQueryDto) {
    const search = query.search?.trim();
    const conditions = await this.prisma.purchaseOrderCondition.findMany({
      where: {
        type: query.type,
        ...(search
          ? {
              content: {
                contains: search,
                mode: 'insensitive' as const,
              },
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { content: 'asc' }],
      select: {
        purchaseOrderConditionId: true,
        type: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'Condiciones guardadas obtenidas exitosamente.',
      data: conditions,
    };
  }

  private cleanContent(content: string) {
    return content.trim().replace(/\s+/g, ' ');
  }

  private normalizeContent(content: string) {
    return this.cleanContent(content)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-PE');
  }
}
