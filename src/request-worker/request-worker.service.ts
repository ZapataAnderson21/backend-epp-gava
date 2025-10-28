import { BadRequestException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateRequestWorkerDto } from './dto/create-request-worker.dto';
import { UpdateRequestWorkerDto } from './dto/update-request-worker.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RequestStatus } from 'generated/prisma';

@Injectable()
export class RequestWorkerService {

  constructor(private readonly prismaService: PrismaService) {}

  private readonly logger = new Logger('RequestWorkerService');

  async create(createRequestWorkerDto: CreateRequestWorkerDto) {
    
    this.logger.log('Creating request worker', JSON.stringify(createRequestWorkerDto));
    await this.requestExistsAndIsDraft(createRequestWorkerDto.requestId);

    this.logger.log(`Verifying worker with ID: ${createRequestWorkerDto.workerId} exists`);
    await this.verifyWorkerExists(createRequestWorkerDto.workerId);

    const newRequestWorker = await this.prismaService.requestWorker.create({
      data: createRequestWorkerDto
    });

    if (!newRequestWorker) {
      this.logger.error('Failed to create request worker', createRequestWorkerDto);
      throw new BadRequestException('No se pudo crear la solicitud para un trabajador específico.');
    }

    this.logger.log('Request worker created successfully', JSON.stringify(newRequestWorker));
    return {
      statusCode: HttpStatus.CREATED,
      message: 'La solicitud para un trabajador específico ha sido creada exitosamente.',
      data: newRequestWorker
    };
  }

  async findAllByRequestId(requestId: number) {

    this.logger.log(`Finding request workers for request ID: ${requestId}`);
    const requestWorkers = await this.prismaService.requestWorker.findMany({
      where: { requestId },
      include: {
        request: true, 
        worker: true
      }
    });
    
    if (!requestWorkers || requestWorkers.length === 0) {
      this.logger.warn(`No request workers found for request ID: ${requestId}`);
    }

    this.logger.log(`Found ${requestWorkers.length} request workers for request ID: ${requestId}`);
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitudes para trabajadores específicos encontradas exitosamente.',
      data: requestWorkers
    }
  }

  async findOne(requestWorkerId: number) {

    this.logger.log(`Finding request worker with ID: ${requestWorkerId}`);
    const requestWorker = await this.prismaService.requestWorker.findUnique({
      where: { requestWorkerId },
      include: { 
        request: true, 
        worker: true 
      }
    });

    if (!requestWorker) {
      this.logger.error(`Request worker with ID ${requestWorkerId} not found`);
      throw new NotFoundException(`La solicitud para un trabajador específico no fue encontrada.`);
    }

    this.logger.log(`Request worker with ID ${requestWorkerId} found`, JSON.stringify(requestWorker));
    return {
      statusCode: HttpStatus.OK,
      message: 'Solicitud para un trabajador específico encontrada exitosamente.',
      data: requestWorker
    };
  }

  async update(requestWorkerId: number, updateRequestWorkerDto: UpdateRequestWorkerDto) {

    this.logger.log(`Updating request worker with ID: ${requestWorkerId}`, JSON.stringify(updateRequestWorkerDto));
    const existingRequestWorker = await this.findOne(requestWorkerId);

    this.logger.log(`Verifying associated request with ID: ${existingRequestWorker.data.requestId} is in draft status`);
    await this.requestExistsAndIsDraft(existingRequestWorker.data.requestId);

    const updatedRequestWorker = await this.prismaService.requestWorker.update({
      where: { requestWorkerId },
      data: updateRequestWorkerDto,
      include: { 
        request: true, 
        worker: true 
      }
    });

    if (!updatedRequestWorker) {
      this.logger.error(`Failed to update request worker with ID: ${requestWorkerId}`, JSON.stringify(updateRequestWorkerDto));
      throw new BadRequestException('No se pudo actualizar la solicitud para un trabajador específico.');
    }

    this.logger.log(`Request worker with ID ${requestWorkerId} updated successfully`, JSON.stringify(updatedRequestWorker));
    return { 
      statusCode: HttpStatus.OK,
      message: 'La solicitud para un trabajador específico ha sido actualizada exitosamente.',
      data: updatedRequestWorker
    };
  }

  async remove(requestWorkerId: number) {
    this.logger.log(`Removing request worker with ID: ${requestWorkerId}`);
    const existingRequestWorker = await this.findOne(requestWorkerId);

    await this.requestExistsAndIsDraft(existingRequestWorker.data.requestId);

    const deletedRequestWorker = await this.prismaService.requestWorker.delete({
      where: { requestWorkerId },
      include: { 
        request: true, 
        worker: true 
      }
    });

    if (!deletedRequestWorker) {
      this.logger.error(`Failed to delete request worker with ID: ${requestWorkerId}`);
      throw new BadRequestException('No se pudo eliminar la solicitud para un trabajador específico.');
    }
    
    this.logger.log(`Request worker with ID ${requestWorkerId} deleted successfully`, JSON.stringify(deletedRequestWorker));
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud para un trabajador específico ha sido eliminada exitosamente.',
      data: deletedRequestWorker
    };
  }

  async requestExistsAndIsDraft(requestId: number) {

    this.logger.log(`Checking if request exists and is in draft status for ID: ${requestId}`);

    const request = await this.prismaService.request.findUnique({
      where: { requestId },
    });

    if (!request) {
      this.logger.error(`Associated request with ID ${requestId} not found`);
      throw new NotFoundException('La solicitud asociada no fue encontrada.');
    }

    if (request.status !== RequestStatus.draft) {
      this.logger.error(`The operation cannot be performed because the request with ID ${requestId} is not in draft status`);
      throw new BadRequestException('La operación no puede ser realizada porque la solicitud no está en estado de borrador');
    }

    this.logger.log(`Request with ID ${requestId} exists and is in draft status`);
    return {
      statusCode: HttpStatus.OK,
      message: 'La solicitud asociada fue encontrada y está en estado de borrador.',
      data: request
    };
  }

  async verifyWorkerExists(workerId: number) {

    this.logger.log(`Verifying existence of worker ID: ${workerId}`);
    const worker = await this.prismaService.worker.findUnique({
      where: { workerId },
    });

    if (!worker) {
      this.logger.error(`Worker with ID ${workerId} not found`);
      throw new NotFoundException(`El usuario con ID ${workerId} no fue encontrado.`);
    }

    this.logger.log(`Worker with ID ${workerId} found`);
    return {
      statusCode: HttpStatus.OK,
      message: 'El usuario fue encontrado exitosamente.',
      data: worker
    };
  }
}