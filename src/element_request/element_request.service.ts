import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateElementRequestDto } from './dto/create-element_request.dto';
import { UpdateElementRequestDto } from './dto/update-element_request.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ElementRequestService {
  private readonly logger = new Logger('ElementRequestService');

  constructor(private readonly prismaService: PrismaService) {}

  async create(createElementRequestDto: CreateElementRequestDto) {
    await this.requestExists(createElementRequestDto.requestId);

    this.logger.log(
      `Creating Element Request with data: ${JSON.stringify(createElementRequestDto)}`,
    );
    const newElementRequest = await this.prismaService.elementRequest.create({
      data: createElementRequestDto,
      include: {
        request: true,
        element: {
          include: {
            category: true,
          },
        },
        epiPlans: {
          include: {
            requestWorker: {
              include: {
                worker: true,
              },
            },
          },
        },
      },
    });

    if (!newElementRequest) {
      this.logger.error(`Failed to create Element Request`);
      throw new BadRequestException('Failed to create Element Request');
    }

    this.logger.log(
      `Element Request created successfully: ${JSON.stringify(newElementRequest)}`,
    );
    return {
      statusCode: HttpStatus.CREATED,
      message: 'La solicitud de elemento ha sido creada exitosamente.',
      data: newElementRequest,
    };
  }

  async findAllByRequestId(requestId: number) {
    this.logger.log(`Fetching Element Requests for requestId: ${requestId}`);
    const foundElementRequests =
      await this.prismaService.elementRequest.findMany({
        where: { requestId },
        include: {
          request: true,
          element: {
            include: {
              category: true,
            },
          },
          epiPlans: {
            include: {
              requestWorker: {
                include: {
                  worker: true,
                },
              },
            },
          },
        },
      });

    if (!foundElementRequests || foundElementRequests.length === 0) {
      this.logger.warn(`No Element Requests found for requestId: ${requestId}`);
    }

    this.logger.log(
      `Found ${foundElementRequests.length} Element Requests for requestId: ${requestId}`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes de elementos encontradas exitosamente.',
      data: foundElementRequests,
    };
  }

  async findOne(elementRequestId: number) {
    this.logger.log(`Fetching Element Request with ID: ${elementRequestId}`);
    const elementRequest = await this.prismaService.elementRequest.findUnique({
      where: { elementRequestId },
      include: {
        request: true,
        element: {
          include: {
            category: true,
          },
        },
        epiPlans: {
          include: {
            requestWorker: {
              include: {
                worker: true,
              },
            },
          },
        },
      },
    });

    if (!elementRequest) {
      this.logger.warn(`Element Request with ID ${elementRequestId} not found`);
      throw new NotFoundException('Element request not found');
    }

    this.logger.log(`Element Request found: ${JSON.stringify(elementRequest)}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitud de elemento encontrada exitosamente.',
      data: elementRequest,
    };
  }

  async update(
    elementRequestId: number,
    updateElementRequestDto: UpdateElementRequestDto,
  ) {
    const existingElementRequest = await this.findOne(elementRequestId);

    await this.requestExistsAndIsDraft(existingElementRequest.data.requestId);

    this.logger.log(`Updating Element Request with ID: ${elementRequestId}`);
    const updatedRequest = await this.prismaService.elementRequest.update({
      where: { elementRequestId },
      data: updateElementRequestDto,
      include: {
        request: true,
        element: {
          include: {
            category: true,
          },
        },
        epiPlans: {
          include: {
            requestWorker: {
              include: {
                worker: true,
              },
            },
          },
        },
      },
    });

    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud de elemento ha sido actualizada exitosamente.',
      data: updatedRequest,
    };
  }

  async remove(elementRequestId: number) {
    const existingElementRequest = await this.findOne(elementRequestId);

    await this.requestExistsAndIsDraft(existingElementRequest.data.requestId);

    this.logger.log(`Deleting Element Request with ID: ${elementRequestId}`);
    const deletedElementRequest =
      await this.prismaService.elementRequest.delete({
        where: { elementRequestId },
      });

    if (!deletedElementRequest) {
      this.logger.error(
        `Failed to delete Element Request with ID: ${elementRequestId}`,
      );
      throw new BadRequestException('Failed to delete Element Request');
    }

    this.logger.log(
      `Element Request with ID: ${elementRequestId} deleted successfully`,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud de elemento ha sido eliminada exitosamente.',
      data: deletedElementRequest,
    };
  }

  async requestExists(requestId: number) {
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
    });

    if (!request) {
      this.logger.error(`Associated request with ID ${requestId} not found`);
      throw new NotFoundException('Associated request not found');
    }

    this.logger.log(`Associated request with ID ${requestId} found`);
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud asociada fue encontrada exitosamente.',
      data: request,
    };
  }

  async requestExistsAndIsDraft(requestId: number) {
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
    });

    if (!request) {
      this.logger.error(`Associated request with ID ${requestId} not found`);
      throw new NotFoundException('Associated request not found');
    }

    if (request.status !== 'draft') {
      this.logger.error(`Request with ID ${requestId} is not in draft status`);
      throw new BadRequestException(
        'The operation cannot be performed because the request is not in draft status',
      );
    }

    this.logger.log(`Request with ID ${requestId} is in draft status`);
    return {
      statusCode: HttpStatus.OK,
      message:
        'La solicitud asociada fue encontrada y está en estado de borrador.',
      data: request,
    };
  }
}
