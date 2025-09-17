import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateElementRequestDto } from './dto/create-element_request.dto';
import { UpdateElementRequestDto } from './dto/update-element_request.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { ElementRequest } from 'src/element_request/entities/element_request.entity';

@Injectable()
export class ElementRequestService {

  constructor(private readonly prismaService: PrismaService) {}

  async create(createElementRequestDto: CreateElementRequestDto) {

    const newElementRequest = await this.prismaService.elementRequest.create({
      data: createElementRequestDto,
      include: {
        request: true,
        element: true 
      }
    });

    if (!newElementRequest) {
      return null;
    }

    return newElementRequest;
  }

  async findAllByRequestId(request_id: number): Promise<ElementRequest[]> {

    const foundElementRequests = await this.prismaService.elementRequest.findMany({
      where: { request_id },
      include: {
        request: true,
        element: true 
      }
    });

    if (!foundElementRequests || foundElementRequests.length === 0) {
      return [];
    }

    return foundElementRequests;
  }

  async findOne(element_request_id: number) {
    const elementRequest = await this.prismaService.elementRequest.findUnique({
      where: { element_request_id },
      include: {
        request: true,
        element: true
      }
    });

    if (!elementRequest) {
      throw new HttpException('Element request not found', HttpStatus.NOT_FOUND);
    }

    return elementRequest;
  }

  async update(element_request_id: number, updateElementRequestDto: UpdateElementRequestDto) {

    const existingElementRequest = await this.findOne(element_request_id);

    this.requestExistsAndIsDraft(existingElementRequest.request_id);

    const updatedRequest = await this.prismaService.elementRequest.update({
      where: { element_request_id },
      data: updateElementRequestDto
    });

    return updatedRequest;
  }


  async remove(element_request_id: number) {
    
    const existingElementRequest = await this.findOne(element_request_id);

    this.requestExistsAndIsDraft(existingElementRequest.request_id);

    const deletedElementRequest = await this.prismaService.elementRequest.delete({
      where: { element_request_id }
    });

    if (!deletedElementRequest) {
      return null;
    }

    return deletedElementRequest;
  }

  async requestExistsAndIsDraft(request_id: number) {
    const request = await this.prismaService.request.findUnique({
      where: { request_id },
    });

    if (!request) {
      throw new HttpException('Associated request not found', HttpStatus.NOT_FOUND);
    }

    if (request.status !== 'draft') {
      throw new HttpException('The operation cannot be performed because the request is not in draft status', HttpStatus.BAD_REQUEST);
    }

    return request;
  }
}
