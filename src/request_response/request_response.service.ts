import { Injectable } from '@nestjs/common';
import { CreateRequestResponseDto } from './dto/create-request_response.dto';
import { UpdateRequestResponseDto } from './dto/update-request_response.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RequestResponseService {

  constructor(private readonly prismaService: PrismaService) {}

  async create(createRequestResponseDto: CreateRequestResponseDto) {

    const response_date = new Date();

    const requestResponse = await this.prismaService.requestResponse.create({
      data: {
        ...createRequestResponseDto,
        response_date,
      },
    });

    if (!requestResponse) {
      return null;
    }

    return requestResponse;
  }
  
  async findOne(id: number) {
    const requestResponse = await this.prismaService.requestResponse.findUnique({
      where: { request_response_id: id },
    });

    if (!requestResponse) {
      return null;
    }

    return requestResponse;
  }

  async findByRequestId(requestId: number) {
    const requestResponses = await this.prismaService.requestResponse.findUnique({
      where: { request_id: requestId },
    });

    if (!requestResponses) {
      return null;
    }

    return requestResponses;
  }
}
