import { Injectable } from '@nestjs/common';
import { CreateElementRequestResponseDto } from './dto/create-element_request_response.dto';
import { UpdateElementRequestResponseDto } from './dto/update-element_request_response.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ElementRequestResponseService {

  constructor(private readonly prismaService: PrismaService) {}

  async create(createElementRequestResponseDto: CreateElementRequestResponseDto) {
    const elementRequestResponse = await this.prismaService.elementRequestResponse.create({
      data: createElementRequestResponseDto,
      include: {
        elementRequest: true,
        requestResponse: true,
      },
    });

    if (!elementRequestResponse) {
      return null;
    }

    return elementRequestResponse;
  }

  async findByRequestResponseId(requestResponseId: number) {
    const elementRequestResponses = await this.prismaService.elementRequestResponse.findMany({
      where: { request_response_id: requestResponseId },
      include: {
        elementRequest: true,
        requestResponse: true,
      },
    });

    if (!elementRequestResponses || elementRequestResponses.length === 0) {
      return [];
    }

    return elementRequestResponses;
  }

  async findOne(id: number) {
    const elementRequestResponse = await this.prismaService.elementRequestResponse.findUnique({
      where: { element_request_response_id: id },
      include: {
        elementRequest: true,
        requestResponse: true,
      },
    });

    if (!elementRequestResponse) {
      return null;
    }

    return elementRequestResponse;
  }

  async update(id: number, updateElementRequestResponseDto: UpdateElementRequestResponseDto) {
    const updatedElementRequestResponse = await this.prismaService.elementRequestResponse.update({
      where: { element_request_response_id: id },
      data: updateElementRequestResponseDto,
      include: {
        elementRequest: true,
        requestResponse: true,
      },
    });

    if (!updatedElementRequestResponse) {
      return null;
    }

    return updatedElementRequestResponse;
  }
}