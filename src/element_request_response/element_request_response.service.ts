import { Injectable } from '@nestjs/common';
import { CreateElementRequestResponseDto } from './dto/create-element_request_response.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ElementRequestResponseService {

  constructor(private readonly prismaService: PrismaService) {}

  async create(createElementRequestResponseDto: CreateElementRequestResponseDto) {
    const elementRequestResponse = await this.prismaService.elementRequestResponse.create({
      data: createElementRequestResponseDto,
    });

    if (!elementRequestResponse) {
      return null;
    }

    return elementRequestResponse;
  }

  async findByRequestResponseId(requestResponseId: number) {
    const elementRequestResponses = await this.prismaService.elementRequestResponse.findMany({
      where: { request_response_id: requestResponseId },
    });

    if (!elementRequestResponses || elementRequestResponses.length === 0) {
      return [];
    }

    return elementRequestResponses;
  }

  async findOne(id: number) {
    const elementRequestResponse = await this.prismaService.elementRequestResponse.findUnique({
      where: { element_request_response_id: id },
    });

    if (!elementRequestResponse) {
      return null;
    }

    return elementRequestResponse;
  }
}