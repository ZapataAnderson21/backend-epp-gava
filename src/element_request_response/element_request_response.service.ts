import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateElementRequestResponseDto } from './dto/create-element_request_response.dto';
import { UpdateElementRequestResponseDto } from './dto/update-element_request_response.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ElementRequestResponseService {
  private readonly logger = new Logger('ElementRequestResponseService');

  constructor(private readonly prismaService: PrismaService) {}

  async create(
    createElementRequestResponseDto: CreateElementRequestResponseDto,
  ) {
    this.logger.log(
      `Creating ElementRequestResponse with data: ${JSON.stringify(createElementRequestResponseDto)}`,
    );
    const elementRequestResponse =
      await this.prismaService.elementRequestResponse.create({
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

    this.logger.log(
      `ElementRequestResponse created successfully: ${JSON.stringify(elementRequestResponse)}`,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message:
        'La respuesta a la solicitud de elemento ha sido creada exitosamente.',
      data: elementRequestResponse,
    };
  }

  async findByRequestResponseId(requestResponseId: number) {
    this.logger.log(
      `Finding ElementRequestResponses by requestResponseId: ${requestResponseId}`,
    );
    const elementRequestResponses =
      await this.prismaService.elementRequestResponse.findMany({
        where: { requestResponseId: requestResponseId },
        include: {
          elementRequest: true,
          requestResponse: true,
        },
      });

    if (!elementRequestResponses || elementRequestResponses.length === 0) {
      this.logger.warn(
        `No ElementRequestResponses found for requestResponseId: ${requestResponseId}`,
      );
    }

    this.logger.log(
      `Found ${elementRequestResponses.length} ElementRequestResponses for requestResponseId: ${requestResponseId}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes de respuesta a elementos encontradas exitosamente.',
      data: elementRequestResponses,
    };
  }

  async findOne(elementRequestResponseId: number) {
    this.logger.log(
      `Finding ElementRequestResponse by id: ${elementRequestResponseId}`,
    );
    const elementRequestResponse =
      await this.prismaService.elementRequestResponse.findUnique({
        where: { elementRequestResponseId },
        include: {
          elementRequest: true,
          requestResponse: true,
        },
      });

    if (!elementRequestResponse) {
      this.logger.warn(
        `ElementRequestResponse not found for id: ${elementRequestResponseId}`,
      );
      throw new NotFoundException(
        `ElementRequestResponse with id ${elementRequestResponseId} not found`,
      );
    }

    this.logger.log(
      `ElementRequestResponse found: ${JSON.stringify(elementRequestResponse)}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitud de respuesta a elemento encontrada exitosamente.',
      data: elementRequestResponse,
    };
  }

  async update(
    elementRequestResponseId: number,
    updateElementRequestResponseDto: UpdateElementRequestResponseDto,
  ) {
    this.logger.log(
      `Updating ElementRequestResponse with id: ${elementRequestResponseId}`,
    );
    const updatedElementRequestResponse =
      await this.prismaService.elementRequestResponse.update({
        where: { elementRequestResponseId },
        data: updateElementRequestResponseDto,
        include: {
          elementRequest: true,
          requestResponse: true,
        },
      });

    if (!updatedElementRequestResponse) {
      this.logger.error(
        `Failed to update ElementRequestResponse with id: ${elementRequestResponseId}`,
      );
      throw new BadRequestException(
        `Failed to update ElementRequestResponse with id: ${elementRequestResponseId}`,
      );
    }

    this.logger.log(
      `ElementRequestResponse updated successfully: ${JSON.stringify(updatedElementRequestResponse)}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitud de respuesta a elemento actualizada exitosamente.',
      data: updatedElementRequestResponse,
    };
  }
}
