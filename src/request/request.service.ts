import { BadRequestException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RequestService {
  
  private readonly logger = new Logger('RequestService');

  constructor(private readonly prismaService: PrismaService) {}
  
  async create(createRequestDto: CreateRequestDto) {

    this.logger.log(`Creating request with data: ${JSON.stringify(createRequestDto)}`);

    const status = 'draft';

    const requestData = {
      ...createRequestDto,
      delivery_due_date: new Date(createRequestDto.delivery_due_date),
      status
    };

    const request = await this.prismaService.request.create({
      data: requestData
    });

    if (!request) {
      this.logger.error('Failed to create request', createRequestDto);
      throw new BadRequestException('Failed to create request');
    }

    this.logger.log(`Request created successfully: ${JSON.stringify(request)}`);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'La solicitud ha sido creada exitosamente.',
      data: request
    };
  }
  
  async findAll() {
    this.logger.log('Retrieving all requests');
    const foundRequests = (await this.prismaService.request.findMany({
      include: {
        project: true,
        user: true
      }
    })).sort((a, b) => b.request_id - a.request_id);

    if (!foundRequests || foundRequests.length === 0) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado solicitudes.',
        data: []
      };
    }

    this.logger.log(`Found ${foundRequests.length} requests`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes encontradas exitosamente.',
      data: foundRequests
    };
  }

  async findOne(request_id: number) {
    this.logger.log(`Finding request with ID: ${request_id}`);
    const request = await this.prismaService.request.findUnique({
      where: { request_id },
      include: {
        project: true,
        user: {
          include: {
            userUserTypes: {
              include: {
                userType: true
              }
            }
          }
        },
        elementRequests: {
          include: {
            element: true,
            elementRequestResponses: {
              include: {
                requestResponse: true
              }
            }
          }
        },
      }
    });

    if (!request) {
      this.logger.warn(`Request not found with ID: ${request_id}`);
      throw new BadRequestException('Request not found');
    }

    this.logger.log(`Request found: ${JSON.stringify(request)}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitud encontrada exitosamente.',
      data: request
    };
  }

  async findAllByProjectId(project_id: number) {
    this.logger.log(`Finding all requests for project ID: ${project_id}`);
    const foundRequests = await this.prismaService.request.findMany({
      where: { project_id },
      include: {
        project: true,
        user: true,
      }
    });

    if (!foundRequests || foundRequests.length === 0) {
      this.logger.warn(`No requests found for project ID: ${project_id}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado solicitudes para este proyecto.',
        data: []
      };
    }

    this.logger.log(`Found ${foundRequests.length} requests for project ID: ${project_id}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes encontradas exitosamente.',
      data: foundRequests
    };
  }

  async findAllByUserId(user_id: number) {
    this.logger.log(`Finding all requests for user ID: ${user_id}`);
    const foundRequests = (await this.prismaService.request.findMany({
      where: { user_id },
      include: {
        project: true,
        user: true
      }
    })).sort((a, b) => a.request_id - b.request_id);

    if (!foundRequests || foundRequests.length === 0) {
      this.logger.warn(`No requests found for user ID: ${user_id}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado solicitudes para este usuario.',
        data: []
      };
    }

    this.logger.log(`Found ${foundRequests.length} requests for user ID: ${user_id}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes encontradas exitosamente.',
      data: foundRequests
    };
  }

  async findAllByStatus(status: string) {
    this.logger.log(`Finding all requests with status: ${status}`);
    const foundRequests = (await this.prismaService.request.findMany({
      where: { status },
      include: {
        project: true,
        user: true
      }
    })).sort((a, b) => b.request_id - a.request_id);

    if (!foundRequests || foundRequests.length === 0) {
      this.logger.warn(`No requests found with status: ${status}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado solicitudes con este estado.',
        data: []
      };
    }

    this.logger.log(`Found ${foundRequests.length} requests with status: ${status}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes encontradas exitosamente.',
      data: foundRequests
    };
  }

  async updateStatus(request_id: number, status: string) {

    this.logger.log(`Updating status of request ID ${request_id} to ${status}`);

    this.logger.log(`Verifying existence of request ID: ${request_id}`);
    await this.findOne(request_id)

    this.logger.log(`Request ID ${request_id} exists. Proceeding to update status.`);
    const updatedRequest = await this.prismaService.request.update({
      where: { request_id },
      data: { status }
    });

    if (!updatedRequest) {
      this.logger.error(`Failed to update status for request ID: ${request_id}`);
      throw new BadRequestException('Failed to update request status');
    }

    this.logger.log(`Request ID ${request_id} status updated successfully to ${status}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'El estado de la solicitud ha sido actualizado exitosamente.',
      data: updatedRequest
    };
  }

  async update(request_id: number, updateRequestDto: UpdateRequestDto) {
    
    this.logger.log(`Updating request ID ${request_id} with data: ${JSON.stringify(updateRequestDto)}`);
    const existingRequest = (await this.findOne(request_id)).data;

    const { status } = existingRequest;
    if (status !== 'draft') {
      this.logger.error(`Cannot update request ID ${request_id} because its status is not 'draft'`);
      throw new BadRequestException('Only requests with status "draft" can be updated');
    }

    const updatedRequest = await this.prismaService.request.update({
      where: { request_id },
      data: updateRequestDto
    });
    
    if (!updatedRequest) {
      this.logger.error(`Failed to update request ID ${request_id}`);
      throw new BadRequestException('Failed to update request');
    }

    this.logger.log(`Request ID ${request_id} updated successfully: ${JSON.stringify(updatedRequest)}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud ha sido actualizada exitosamente.',
      data: updatedRequest
    };
  }

  async remove(request_id: number) {
    const existingRequest = (await this.findOne(request_id)).data;

    const { status } = existingRequest;

    if (status !== 'draft') {
      this.logger.error(`Cannot delete request ID ${request_id} because its status is not 'draft'`);
      throw new BadRequestException('Only requests with status "draft" can be deleted');
    }

    const deletedRequest = await this.prismaService.request.delete({
      where: { request_id }
    });

    if (!deletedRequest) {
      this.logger.error(`Failed to delete request ID ${request_id}`);
      throw new BadRequestException('Failed to delete request');
    }

    this.logger.log(`Request ID ${request_id} deleted successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud ha sido eliminada exitosamente.',
      data: deletedRequest
    };
  }
}
