import { Injectable } from '@nestjs/common';
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

  async findAll() {
    const elementRequests = await this.prismaService.elementRequest.findMany({
      include: {
        request: true,
        element: true
      }
    });

    if (!elementRequests || elementRequests.length === 0) {
      return [];
    }

    return elementRequests;
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


  async update(element_request_id: number, updateElementRequestDto: UpdateElementRequestDto) {
    const existingElementRequest = await this.prismaService.elementRequest.findUnique({
      where: { element_request_id }
    });

    if (!existingElementRequest) {
      return null;
    }

    const request = await this.prismaService.request.findUnique({
      where: { request_id: existingElementRequest.request_id }
    });

    if (!request) {
      return null;
    }

    const status = request.status;
    
    if (status !== 'draft') {
      return null;
    }

    const updatedRequest = await this.prismaService.elementRequest.update({
      where: { element_request_id },
      data: updateElementRequestDto
    });

    return updatedRequest;
  }


  async remove(element_request_id: number) {
    const existingElementRequest = await this.prismaService.elementRequest.findUnique({
      where: { element_request_id }
    });

    if (!existingElementRequest) {
      return null;
    }

    const request = await this.prismaService.request.findUnique({
      where: { request_id: existingElementRequest.request_id }
    });

    if (!request) {
      return null;
    }

    const status = request.status;
    
    if (status !== 'draft') {
      return null;
    }

    const deletedElementRequest = await this.prismaService.elementRequest.delete({
      where: { element_request_id }
    });

    if (!deletedElementRequest) {
      return null;
    }

    return deletedElementRequest;
  }
}
