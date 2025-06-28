import { Injectable } from '@nestjs/common';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RequestService {
  
  constructor(private readonly prismaService: PrismaService) {}
  
  async create(createRequestDto: CreateRequestDto) {

    const registration_date = new Date();

    const status = 'draft';

    const requestData = {
      ...createRequestDto,
      registration_date,
      status
    };

    const request = await this.prismaService.request.create({
      data: requestData
    });

    if (!request) {
      return null;
    }

    return request;
  }

  async findAll() {
    const foundRequests = await this.prismaService.request.findMany({
      include: {
        project: true,
        user: true
      }
    });

    if (!foundRequests || foundRequests.length === 0) {
      return [];
    }

    return foundRequests;
  }

  async findOne(request_id: number) {
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
        }
      }
    });

    if (!request) {
      return null;
    }

    return request;
  }

  async findAllByProjectId(project_id: number) {
    const foundRequests = await this.prismaService.request.findMany({
      where: { project_id },
      include: {
        project: true,
        user: true,
      }
    });

    if (!foundRequests || foundRequests.length === 0) {
      return [];
    }

    return foundRequests;
  }

  async findAllByUserId(user_id: number) {
    const foundRequests = await this.prismaService.request.findMany({
      where: { user_id },
      include: {
        project: true,
        user: true
      }
    });

    if (!foundRequests || foundRequests.length === 0) {
      return [];
    }

    return foundRequests;
  }

  async findAllByStatus(status: string) {
    const foundRequests = await this.prismaService.request.findMany({
      where: { status },
      include: {
        project: true,
        user: true
      }
    });

    if (!foundRequests || foundRequests.length === 0) {
      return [];
    }

    return foundRequests;
  }

  async updateStatus(request_id: number, status: string) {
    const updatedRequest = await this.prismaService.request.update({
      where: { request_id },
      data: { status }
    });

    if (!updatedRequest) {
      return null;
    }

    return updatedRequest;
  }

  async update(request_id: number, updateRequestDto: UpdateRequestDto) {
    const existinRequest = await this.prismaService.request.findUnique({
      where: { request_id }
    });

    if (!existinRequest) {
      return null;
    }

    const { status } = existinRequest;

    if (status !== 'draft') {
      throw new Error('Only requests with status "draft" can be updated');
    }

    const updatedRequest = await this.prismaService.request.update({
      where: { request_id },
      data: updateRequestDto
    });
    
    if (!updatedRequest) {
      return null;
    }

    return updatedRequest;
  }

  async remove(request_id: number) {
    const existinRequest = await this.prismaService.request.findUnique({
      where: { request_id }
    });

    if (!existinRequest) {
      return null;
    }

    const { status } = existinRequest;

    if (status !== 'draft') {
      throw new Error('Only requests with status "draft" can be deleted');
    }

    const deletedRequest = await this.prismaService.request.delete({
      where: { request_id }
    });

    if (!deletedRequest) {
      return null;
    }
  }
}
