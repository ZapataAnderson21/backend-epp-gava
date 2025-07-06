import { Injectable } from '@nestjs/common';
import { CreateRequestResponseDto } from './dto/create-request_response.dto';
import { UpdateRequestResponseDto } from './dto/update-request_response.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RequestResponseService {

  constructor(private readonly prismaService: PrismaService) {}

  async create(createRequestResponseDto: CreateRequestResponseDto) {
    console.log('SERVICE: Creating request response with data:', createRequestResponseDto);

    const requestResponse = await this.prismaService.requestResponse.create({
      data: createRequestResponseDto
    });
    
    console.log('SERVICE: Created request response:', requestResponse);
    
    if (!requestResponse) {
      return null;
    }

    return requestResponse;
  }
  
  async findOne(id: number) {
    const requestResponse = await this.prismaService.requestResponse.findUnique({
      where: { request_response_id: id },
      include: {
        request: {
          include: {
            project: true,
            user: {
              include: {
                userUserTypes: {
                  include: {
                    userType: true,
                  },
                },
              },
            },
          },
        },
        responder: {
          include: {
            userUserTypes: {
              include: {
                userType: true,
              },
            },
          },
        },
      },
    });

    if (!requestResponse) {
      return null;
    }

    return requestResponse;
  }

  async findByRequestId(requestId: number) {
    const requestResponses = await this.prismaService.requestResponse.findUnique({
      where: { request_id: requestId },
      include: {
        request: {
          include: {
            project: true,
            user: {
              include: {
                userUserTypes: {
                  include: {
                    userType: true,
                  },
                },
              },
            },
          },
        },
        responder: {
          include: {
            userUserTypes: {
              include: {
                userType: true,
              },
            },
          },
        },
      },
    });

    if (!requestResponses) {
      return null;
    }

    return requestResponses;
  }

  async findAll() {
    const requestResponses = await this.prismaService.requestResponse.findMany({
      include: {
        request: {
          include: {
            project: true,
            user: {
              include: {
                userUserTypes: {
                  include: {
                    userType: true,
                  },
                },
              },
            },
          },
        },
        responder: {
          include: {
            userUserTypes: {
              include: {
                userType: true,
              },
            },
          },
        },
      },
    });

    if (!requestResponses || requestResponses.length === 0) {
      return [];
    }

    return requestResponses;
  }
}
