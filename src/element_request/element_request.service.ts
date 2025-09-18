import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateElementRequestDto } from './dto/create-element_request.dto';
import { UpdateElementRequestDto } from './dto/update-element_request.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ElementRequest } from 'src/element_request/entities/element_request.entity';

@Injectable()
export class ElementRequestService {

  private readonly logger = new Logger("ElementRequestService");

  constructor(private readonly prismaService: PrismaService) {}

  
  async create(createElementRequestDto: CreateElementRequestDto) {
   
    await this.requestExistsAndIsDraft(createElementRequestDto.request_id);

    this.logger.log(`Creating Element Request with data: ${JSON.stringify(createElementRequestDto)}`);
    const newElementRequest = await this.prismaService.elementRequest.create({
      data: createElementRequestDto,
      include: {
        request: true,
        element: true 
      }
    });

    if (!newElementRequest) {
      this.logger.error(`Failed to create Element Request`);
      throw new BadRequestException('Failed to create Element Request');
    }

    this.logger.log(`Element Request created successfully: ${JSON.stringify(newElementRequest)}`);
    return newElementRequest;
  }


  async findAllByRequestId(request_id: number): Promise<ElementRequest[]> {

    this.logger.log(`Fetching Element Requests for request_id: ${request_id}`);
    const foundElementRequests = await this.prismaService.elementRequest.findMany({
      where: { request_id },
      include: {
        request: true,
        element: true 
      }
    });

    if (!foundElementRequests || foundElementRequests.length === 0) {
      this.logger.warn(`No Element Requests found for request_id: ${request_id}`);
      return [];
    }

    this.logger.log(`Found ${foundElementRequests.length} Element Requests for request_id: ${request_id}`);
    return foundElementRequests;
  }


  async findOne(element_request_id: number) {
    this.logger.log(`Fetching Element Request with ID: ${element_request_id}`);
    const elementRequest = await this.prismaService.elementRequest.findUnique({
      where: { element_request_id },
      include: {
        request: true,
        element: true
      }
    });

    if (!elementRequest) {
      this.logger.warn(`Element Request with ID ${element_request_id} not found`);
      throw new NotFoundException('Element request not found');
    }

    this.logger.log(`Element Request found: ${JSON.stringify(elementRequest)}`);
    return elementRequest;
  }


  async update(element_request_id: number, updateElementRequestDto: UpdateElementRequestDto) {

    const existingElementRequest = await this.findOne(element_request_id);

    await this.requestExistsAndIsDraft(existingElementRequest.request_id);

    this.logger.log(`Updating Element Request with ID: ${element_request_id}`);
    const updatedRequest = await this.prismaService.elementRequest.update({
      where: { element_request_id },
      data: updateElementRequestDto
    });

    return updatedRequest;
  }


  async remove(element_request_id: number) {

    
    const existingElementRequest = await this.findOne(element_request_id);

    await this.requestExistsAndIsDraft(existingElementRequest.request_id);

    this.logger.log(`Deleting Element Request with ID: ${element_request_id}`);
    const deletedElementRequest = await this.prismaService.elementRequest.delete({
      where: { element_request_id }
    });

    if (!deletedElementRequest) {
      this.logger.error(`Failed to delete Element Request with ID: ${element_request_id}`);
      throw new BadRequestException('Failed to delete Element Request');
    }

    this.logger.log(`Element Request with ID: ${element_request_id} deleted successfully`);
    return deletedElementRequest;
  }

  async requestExistsAndIsDraft(request_id: number) {
    const request = await this.prismaService.request.findUnique({
      where: { request_id },
    });

    if (!request) {
      this.logger.error(`Associated request with ID ${request_id} not found`);
      throw new NotFoundException('Associated request not found');
    }

    if (request.status !== 'draft') {
      this.logger.error(`Request with ID ${request_id} is not in draft status`);
      throw new BadRequestException('The operation cannot be performed because the request is not in draft status');
    }

    this.logger.log(`Request with ID ${request_id} is in draft status`);
    return request;
  }
}
