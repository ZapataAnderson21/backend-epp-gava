import { BadRequestException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestStatus, RequestStatusLabelEs } from './enum';

@Injectable()
export class RequestService {
  
  private readonly logger = new Logger('RequestService');

  constructor(private readonly prismaService: PrismaService) {}
  
  async create(createRequestDto: CreateRequestDto) {

    this.logger.log(`Creating request with data: ${JSON.stringify(createRequestDto)}`);
    
    const requestData = {
      ...createRequestDto,
      deliveryDueDate: new Date(createRequestDto.deliveryDueDate)
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
  
  async findAll(
    projectId?: number,
    userId?: number,                 // filtro “duro” (para usuarios normales)
    status?: RequestStatus,
    viewerId?: number                // quién está mirando (siempre)
  ) {
    this.logger.log('Retrieving all requests');

    // Caso 1: si me piden explícitamente solo “draft”, forzamos mis borradores.
    if (status === RequestStatus.draft) {
      const found = await this.prismaService.request.findMany({
        where: {
          projectId,
          status: RequestStatus.draft,
          ...(userId ? { userId } : viewerId ? { userId: viewerId } : {}), // si no hay userId, usamos viewerId
        },
        include: { project: true, user: true },
        orderBy: { requestId: 'desc' },
      });

      const processed = found.map(req => ({
        ...req,
        status: RequestStatusLabelEs[req.status as keyof typeof RequestStatusLabelEs] || req.status,
      }));

      return {
        statusCode: processed.length ? HttpStatus.OK : HttpStatus.NOT_FOUND,
        message: processed.length ? 'Solicitudes encontradas exitosamente.' : 'No se han encontrado solicitudes.',
        data: processed,
      };
    }

    // Caso 2: si me pasan userId (usuario normal), mantenemos comportamiento actual
    if (userId) {
      const found = await this.prismaService.request.findMany({
        where: { projectId, userId, ...(status ? { status } : {}) },
        include: { project: true, user: true },
        orderBy: { requestId: 'desc' },
      });

      const processed = found.map(req => ({
        ...req,
        status: RequestStatusLabelEs[req.status as keyof typeof RequestStatusLabelEs] || req.status,
      }));

      return {
        statusCode: processed.length ? HttpStatus.OK : HttpStatus.NOT_FOUND,
        message: processed.length ? 'Solicitudes encontradas exitosamente.' : 'No se han encontrado solicitudes.',
        data: processed,
      };
    }

    // Caso 3 (GERENTE/ADMINISTRADORA):
    // - incluir TODO lo NO-draft
    // - y SOLO mis borradores (viewerId)
    const found = await this.prismaService.request.findMany({
      where: {
        projectId,
        ...(status
          ? { status } // si filtran por un estado distinto a draft, respetamos el filtro
          : {
              OR: [
                { status: { not: RequestStatus.draft } },
                ...(viewerId ? [{ AND: [{ status: RequestStatus.draft }, { userId: viewerId }] }] : []),
              ],
            }),
      },
      include: { project: true, user: true },
      orderBy: { requestId: 'desc' },
    });

    const processed = found.map(req => ({
      ...req,
      status: RequestStatusLabelEs[req.status as keyof typeof RequestStatusLabelEs] || req.status,
    }));

    return {
      statusCode: processed.length ? HttpStatus.OK : HttpStatus.NOT_FOUND,
      message: processed.length ? 'Solicitudes encontradas exitosamente.' : 'No se han encontrado solicitudes.',
      data: processed,
    };
  }

  async findOne(requestId: number) {
    this.logger.log(`Finding request with ID: ${requestId}`);
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
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
      this.logger.warn(`Request not found with ID: ${requestId}`);
      throw new BadRequestException('Request not found');
    }

    const processedRequest = { 
      ...request,
      status: RequestStatusLabelEs[request.status as keyof typeof RequestStatusLabelEs] || request.status
    };

    this.logger.log(`Request with ID ${requestId} found`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitud encontrada exitosamente.',
      data: processedRequest
    };
  }

  async findAllByProjectId(projectId: number) {
    this.logger.log(`Finding all requests for project ID: ${projectId}`);
    const foundRequests = await this.prismaService.request.findMany({
      where: { projectId },
      include: {
        project: true,
        user: true,
      }
    });

    if (!foundRequests || foundRequests.length === 0) {
      this.logger.warn(`No requests found for project ID: ${projectId}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado solicitudes para este proyecto.',
        data: []
      };
    }

    const processedRequests = foundRequests.map(request => {
      const requestObj = { 
        ...request,
        status: RequestStatusLabelEs[request.status as keyof typeof RequestStatusLabelEs] || request.status
      };
      return requestObj;
    });

    this.logger.log(`Found ${foundRequests.length} requests for project ID: ${projectId}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes encontradas exitosamente.',
      data: processedRequests
    };
  }

  async findAllByUserId(userId: number) {
    this.logger.log(`Finding all requests for user ID: ${userId}`);
    const foundRequests = (await this.prismaService.request.findMany({
      where: { userId },
      include: {
        project: true,
        user: true
      }
    })).sort((a, b) => a.requestId - b.requestId);

    if (!foundRequests || foundRequests.length === 0) {
      this.logger.warn(`No requests found for user ID: ${userId}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado solicitudes para este usuario.',
        data: []
      };
    }

    const processedRequests = foundRequests.map(request => {
      const requestObj = {
        ...request,
        status: RequestStatusLabelEs[request.status as keyof typeof RequestStatusLabelEs] || request.status
      };
      return requestObj;
    });

    this.logger.log(`Found ${foundRequests.length} requests for user ID: ${userId}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes encontradas exitosamente.',
      data: processedRequests
    };
  }

  async findAllByStatus(status: RequestStatus) {
    this.logger.log(`Finding all requests with status: ${status}`);
    const foundRequests = (await this.prismaService.request.findMany({
      where: { status },
      include: {
        project: true,
        user: true
      }
    })).sort((a, b) => b.requestId - a.requestId);

    if (!foundRequests || foundRequests.length === 0) {
      this.logger.warn(`No requests found with status: ${status}`);
      return {
        statusCode: HttpStatus.NOT_FOUND,
        message: 'No se han encontrado solicitudes con este estado.',
        data: []
      };
    }

    const processedRequests = foundRequests.map(request => {
      const requestObj = { 
        ...request,
        status: RequestStatusLabelEs[request.status as keyof typeof RequestStatusLabelEs] || request.status
      };
      return requestObj;
    });

    this.logger.log(`Found ${foundRequests.length} requests with status: ${status}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes encontradas exitosamente.',
      data: processedRequests
    };
  }

  async updateStatus(requestId: number, status: RequestStatus) {
    this.logger.log(`Updating status of request ID ${requestId} to ${status}`);

    this.logger.log(`Verifying existence of request ID: ${requestId}`);
    await this.findOne(requestId)

    this.logger.log(`Request ID ${requestId} exists. Proceeding to update status.`);
    const updatedRequest = await this.prismaService.request.update({
      where: { requestId },
      data: { status }
    });

    if (!updatedRequest) {
      this.logger.error(`Failed to update status for request ID: ${requestId}`);
      throw new BadRequestException('Failed to update request status');
    }

    this.logger.log(`Request ID ${requestId} status updated successfully to ${status}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'El estado de la solicitud ha sido actualizado exitosamente.',
      data: updatedRequest
    };
  }

  async update(requestId: number, updateRequestDto: UpdateRequestDto) {
    this.logger.log(`Updating request ID ${requestId} with data: ${JSON.stringify(updateRequestDto)}`);
    
    if (!this.requestIsDraft(requestId)) {
      this.logger.error(`Cannot update request ID ${requestId} because its status is not 'draft'`);
      throw new BadRequestException('Only requests with status "draft" can be updated');
    }

    const updatedRequest = await this.prismaService.request.update({
      where: { requestId },
      data: updateRequestDto
    });
    
    if (!updatedRequest) {
      this.logger.error(`Failed to update request ID ${requestId}`);
      throw new BadRequestException('Failed to update request');
    }

    this.logger.log(`Request ID ${requestId} updated successfully: ${JSON.stringify(updatedRequest)}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud ha sido actualizada exitosamente.',
      data: updatedRequest
    };
  }

  async remove(requestId: number) {
    const existingRequest = (await this.findOne(requestId)).data;

    const { status } = existingRequest;

    if (status !== 'draft') {
      this.logger.error(`Cannot delete request ID ${requestId} because its status is not 'draft'`);
      throw new BadRequestException('Only requests with status "draft" can be deleted');
    }

    const deletedRequest = await this.prismaService.request.delete({
      where: { requestId }
    });

    if (!deletedRequest) {
      this.logger.error(`Failed to delete request ID ${requestId}`);
      throw new BadRequestException('Failed to delete request');
    }

    this.logger.log(`Request ID ${requestId} deleted successfully`);
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud ha sido eliminada exitosamente.',
      data: deletedRequest
    };
  }

  async requestIsDraft(requestId: number) {
    this.logger.log(`Verifying existence of request ID: ${requestId} and checking if its status is 'draft'`);
    const request = await this.prismaService.request.findUnique({
      where: { requestId }
    });

    if (!request) {
      this.logger.error(`Request ID ${requestId} not found`);
      throw new NotFoundException('La solicitud no fue encontrada');
    }

    if (request.status !== 'draft') {
      this.logger.error(`Request ID ${requestId} is not in 'draft' status`);
      return false;
    }

    this.logger.log(`Request ID ${requestId} exists and is in 'draft' status`);
    return true;
  }
}
