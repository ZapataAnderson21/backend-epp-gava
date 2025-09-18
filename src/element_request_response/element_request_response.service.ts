import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateElementRequestResponseDto } from './dto/create-element_request_response.dto';
import { UpdateElementRequestResponseDto } from './dto/update-element_request_response.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ElementRequestResponseService {

  private readonly logger = new Logger("ElementRequestResponseService");

  constructor(private readonly prismaService: PrismaService) {}

  async create(createElementRequestResponseDto: CreateElementRequestResponseDto) {
    
    this.logger.log(`Creating ElementRequestResponse with data: ${JSON.stringify(createElementRequestResponseDto)}`);
    const elementRequestResponse = await this.prismaService.elementRequestResponse.create({
      data: createElementRequestResponseDto,
      include: {
        elementRequest: true,
        requestResponse: true,
      },
    });
    
    if (!elementRequestResponse) {
      this.logger.error('Failed to create ElementRequestResponse');
      throw new BadRequestException('Failed to create ElementRequestResponse');
    }

    this.logger.log(`ElementRequestResponse created successfully: ${JSON.stringify(elementRequestResponse)}`);
    return elementRequestResponse;
  }

  async findByRequestResponseId(requestResponseId: number) {

    this.logger.log(`Finding ElementRequestResponses by requestResponseId: ${requestResponseId}`);
    const elementRequestResponses = await this.prismaService.elementRequestResponse.findMany({
      where: { request_response_id: requestResponseId },
      include: {
        elementRequest: true,
        requestResponse: true,
      },
    });

    if (!elementRequestResponses || elementRequestResponses.length === 0) {
      this.logger.warn(`No ElementRequestResponses found for requestResponseId: ${requestResponseId}`);
      return [];
    }

    this.logger.log(`Found ${elementRequestResponses.length} ElementRequestResponses for requestResponseId: ${requestResponseId}`);
    return elementRequestResponses;
  }

  async findOne(id: number) {
    this.logger.log(`Finding ElementRequestResponse by id: ${id}`);
    const elementRequestResponse = await this.prismaService.elementRequestResponse.findUnique({
      where: { element_request_response_id: id },
      include: {
        elementRequest: true,
        requestResponse: true,
      },
    });

    if (!elementRequestResponse) {
      this.logger.warn(`ElementRequestResponse not found for id: ${id}`);
      throw new NotFoundException(`ElementRequestResponse with id ${id} not found`);
    }

    this.logger.log(`ElementRequestResponse found: ${JSON.stringify(elementRequestResponse)}`);
    return elementRequestResponse;
  }

  async update(id: number, updateElementRequestResponseDto: UpdateElementRequestResponseDto) {
    this.logger.log(`Updating ElementRequestResponse with id: ${id}`);
    const updatedElementRequestResponse = await this.prismaService.elementRequestResponse.update({
      where: { element_request_response_id: id },
      data: updateElementRequestResponseDto,
      include: {
        elementRequest: true,
        requestResponse: true,
      },
    });

    if (!updatedElementRequestResponse) {
      this.logger.error(`Failed to update ElementRequestResponse with id: ${id}`);
      throw new BadRequestException(`Failed to update ElementRequestResponse with id: ${id}`);
    }

    this.logger.log(`ElementRequestResponse updated successfully: ${JSON.stringify(updatedElementRequestResponse)}`);
    return updatedElementRequestResponse;
  }
}