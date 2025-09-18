import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateRequestWorkerDto } from './dto/create-request-worker.dto';
import { UpdateRequestWorkerDto } from './dto/update-request-worker.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RequestWorkerService {

  constructor(private readonly prismaService: PrismaService) {}

  private readonly logger = new Logger('RequestWorkerService');

  async create(createRequestWorkerDto: CreateRequestWorkerDto) {
    
    this.logger.log('Creating request worker', JSON.stringify(createRequestWorkerDto));
    await this.requestExistsAndIsDraft(createRequestWorkerDto.request_id);

    const newRequestWorker = await this.prismaService.requestWorker.create({
      data: createRequestWorkerDto
    });

    if (!newRequestWorker) {
      this.logger.error('Failed to create request worker', createRequestWorkerDto);
      throw new BadRequestException('Failed to create request worker');
    }

    this.logger.log('Request worker created successfully', JSON.stringify(newRequestWorker));
    return newRequestWorker;
  }

  async findAllByRequestId(request_id: number) {

    this.logger.log(`Finding request workers for request ID: ${request_id}`);
    const requestWorkers = await this.prismaService.requestWorker.findMany({
      where: { request_id },
      include: {
        request: true
      }
    });
    
    if (!requestWorkers || requestWorkers.length === 0) {
      this.logger.warn(`No request workers found for request ID: ${request_id}`);
      return [];
    }

    this.logger.log(`Found ${requestWorkers.length} request workers for request ID: ${request_id}`);
    return requestWorkers;
  }

  async findOne(request_worker_id: number) {

    this.logger.log(`Finding request worker with ID: ${request_worker_id}`);
    const requestWorker = await this.prismaService.requestWorker.findUnique({
      where: { request_worker_id },
      include: { request: true }
    });

    if (!requestWorker) {
      this.logger.error(`Request worker with ID ${request_worker_id} not found`);
      throw new NotFoundException('Request worker not found');
    }

    this.logger.log(`Request worker with ID ${request_worker_id} found`, JSON.stringify(requestWorker));
    return requestWorker;
  }

  async update(request_worker_id: number, updateRequestWorkerDto: UpdateRequestWorkerDto) {

    this.logger.log(`Updating request worker with ID: ${request_worker_id}`, JSON.stringify(updateRequestWorkerDto));
    const existingRequestWorker = await this.findOne(request_worker_id);

    this.logger.log(`Verifying associated request with ID: ${existingRequestWorker.request_id} is in draft status`);
    await this.requestExistsAndIsDraft(existingRequestWorker.request_id);

    const updatedRequestWorker = await this.prismaService.requestWorker.update({
      where: { request_worker_id },
      data: updateRequestWorkerDto
    });

    if (!updatedRequestWorker) {
      this.logger.error(`Failed to update request worker with ID: ${request_worker_id}`, JSON.stringify(updateRequestWorkerDto));
      throw new BadRequestException('Failed to update request worker');
    }

    this.logger.log(`Request worker with ID ${request_worker_id} updated successfully`, JSON.stringify(updatedRequestWorker));
    return updatedRequestWorker;
  }

  async remove(request_worker_id: number) {
    this.logger.log(`Removing request worker with ID: ${request_worker_id}`);
    const existingRequestWorker = await this.findOne(request_worker_id);

    await this.requestExistsAndIsDraft(existingRequestWorker.request_id);

    const deletedRequestWorker = await this.prismaService.requestWorker.delete({
      where: { request_worker_id },
    });

    if (!deletedRequestWorker) {
      this.logger.error(`Failed to delete request worker with ID: ${request_worker_id}`);
      throw new BadRequestException('Failed to delete request worker');
    }
    
    this.logger.log(`Request worker with ID ${request_worker_id} deleted successfully`, JSON.stringify(deletedRequestWorker));
    return deletedRequestWorker;
  }

  async requestExistsAndIsDraft(request_id: number) {

    this.logger.log(`Checking if request exists and is in draft status for ID: ${request_id}`);

    const request = await this.prismaService.request.findUnique({
      where: { request_id },
    });

    if (!request) {
      this.logger.error(`Associated request with ID ${request_id} not found`);
      throw new NotFoundException('Associated request not found');
    }

    if (request.status !== 'draft') {
      this.logger.error(`The operation cannot be performed because the request with ID ${request_id} is not in draft status`);
      throw new BadRequestException('The operation cannot be performed because the request is not in draft status');
    }

    this.logger.log(`Request with ID ${request_id} exists and is in draft status`);
    return request;
  }
}