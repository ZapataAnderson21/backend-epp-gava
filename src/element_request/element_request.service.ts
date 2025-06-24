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
      throw new Error('Failed to create Element Request');
    }

    return newElementRequest;
  }

  async findAll() {
    return `This action returns all elementRequest`;
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

  async findOne(id: number) {
    return `This action returns a #${id} elementRequest`;
  }

  async update(id: number, updateElementRequestDto: UpdateElementRequestDto) {
    return `This action updates a #${id} elementRequest`;
  }

  remove(id: number) {
    return `This action removes a #${id} elementRequest`;
  }
}
