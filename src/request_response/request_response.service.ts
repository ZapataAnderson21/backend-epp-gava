import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateRequestResponseDto } from './dto/create-request_response.dto';
import { UpdateRequestResponseDto } from './dto/update-request_response.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RequestResponseService {

  private readonly logger = new Logger("RequestResponseService");

  constructor(private readonly prismaService: PrismaService) {}

  async create(createRequestResponseDto: CreateRequestResponseDto) {
    this.logger.log('Creating request response with data:', createRequestResponseDto);

    const requestResponse = await this.prismaService.requestResponse.create({
      data: createRequestResponseDto
    });

    this.logger.log(`Created request response: ${JSON.stringify(requestResponse)}`);

    if (!requestResponse) {
      this.logger.error('Failed to create request response');
      throw new BadRequestException('Failed to create request response');
    }

    return requestResponse;
  }
  
  async findOne(id: number) {
    this.logger.log(`Finding request response with ID: ${id}`);
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
      this.logger.warn(`Request response not found with ID: ${id}`);
      throw new BadRequestException('Request response not found');
    }

    const returnResponder = {
      user_id: requestResponse.responder ? requestResponse.responder.user_id : null,
      name: requestResponse.responder ? requestResponse.responder.name : null,
      userType: requestResponse.responder ? requestResponse.responder.userUserTypes[0].userType.name : null,
    };

    const returnProjectUser = {
      user_id: requestResponse.request.user ? requestResponse.request.user.user_id : null,
      name: requestResponse.request.user ? requestResponse.request.user.name : null,
      userType: requestResponse.request.user ? requestResponse.request.user.userUserTypes[0].userType.name : null,
    };

    const returnProject = {
      project_id: requestResponse.request.project ? requestResponse.request.project.project_id : null,
      name: requestResponse.request.project ? requestResponse.request.project.name : null,
      code: requestResponse.request.project ? requestResponse.request.project.code : null,
      description: requestResponse.request.project ? requestResponse.request.project.description : null,
      status: requestResponse.request.project ? requestResponse.request.project.status : null,
      user: returnProjectUser,
    };

    const returnData = {
      request_response_id: requestResponse.request_response_id,
      request: requestResponse.request,
      responder: returnResponder,
      project: returnProject,
      createdAt: requestResponse.createdAt,
      description: requestResponse.description,
    };

    this.logger.log(`Found request response: ${JSON.stringify(requestResponse)}`);
    return returnData;
  }

  async findByRequestId(requestId: number) {
    const requestResponse = await this.prismaService.requestResponse.findUnique({
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
    
    if (!requestResponse) {
      this.logger.warn(`No request responses found for request ID: ${requestId}`);
      throw new NotFoundException('No request responses found for the specified request ID');
    }

    return await this.findOne(requestResponse.request_response_id);
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
      this.logger.log('No request responses found');
      throw new NotFoundException('No request responses found');
    }

    const formattedResponses = requestResponses.map((requestResponse) => {
      const returnResponder = {
        user_id: requestResponse.responder ? requestResponse.responder.user_id : null,
        name: requestResponse.responder ? requestResponse.responder.name : null,
        userType: requestResponse.responder ? requestResponse.responder.userUserTypes[0].userType.name : null,
      };

      const returnProjectUser = {
        user_id: requestResponse.request.user ? requestResponse.request.user.user_id : null,
        name: requestResponse.request.user ? requestResponse.request.user.name : null,
        userType: requestResponse.request.user ? requestResponse.request.user.userUserTypes[0].userType.name : null,
      };

      const returnProject = {
        project_id: requestResponse.request.project ? requestResponse.request.project.project_id : null,
        name: requestResponse.request.project ? requestResponse.request.project.name : null,
        code: requestResponse.request.project ? requestResponse.request.project.code : null,
        description: requestResponse.request.project ? requestResponse.request.project.description : null,
        status: requestResponse.request.project ? requestResponse.request.project.status : null,
        user: returnProjectUser,
      };

      const returnData = {
        request_response_id: requestResponse.request_response_id,
        request: requestResponse.request,
        responder: returnResponder,
        project: returnProject,
        createdAt: requestResponse.createdAt,
        description: requestResponse.description,
      };

      return returnData;
    });

    this.logger.log(`Found ${requestResponses.length} request responses`);
    return formattedResponses;
  }

  async update(id: number, updateRequestResponseDto: UpdateRequestResponseDto) {
    const updatedRequestResponse = await this.prismaService.requestResponse.update({
      where: { request_response_id: id },
      data: updateRequestResponseDto,
    });

    if (!updatedRequestResponse) {
      this.logger.error(`Failed to update request response with ID: ${id}`);
      throw new BadRequestException(`Failed to update request response with ID: ${id}`);
    }

    this.logger.log(`Updated request response: ${JSON.stringify(updatedRequestResponse)}`);
    return await this.findOne(id);
  }
}
