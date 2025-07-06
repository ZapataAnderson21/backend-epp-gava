import { Controller, Get, Post, Body, Patch, Param, Delete, Res, HttpStatus, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { Public } from 'src/user/jwt/public.decorator';
import { MailService } from 'src/mail/mail.service';
import { PdfService } from 'src/pdf/pdf.service';
import * as fs from 'fs';
import * as path from 'path';

@Controller('request')
export class RequestController {
  constructor(private readonly requestService: RequestService,
              private readonly pdfService: PdfService, 
              private readonly mailService: MailService) {}

  @Public()
  @ApiBody({ type: CreateRequestDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Request created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid status. Must be "draft" or "pending".' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to create request' })
  @Post()
  async create(@Body() createRequestDto: CreateRequestDto) {
    try {

      console.log('CONTROLLER: Creating request with data:', createRequestDto);

      const request = await this.requestService.create(createRequestDto);

      if(!request) {
        throw new HttpException('Request creation failed', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        statusCode: HttpStatus.CREATED,
        message: 'Request created successfully',
        data: request,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to create request',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Requests retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No requests found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve requests' })
  @Get()
  async findAll() {
    try {
      const requests = await this.requestService.findAll();

      if (!requests || requests.length === 0) {
        return {
          statusCode: HttpStatus.OK,
          message: 'No requests found',
          data: [],
        };
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Requests retrieved successfully',
        data: requests,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve requests',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Request retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve request' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      if (isNaN(+id)) {
        throw new HttpException('Invalid request ID', HttpStatus.BAD_REQUEST);
      }

      const request = await this.requestService.findOne(+id);

      if (!request) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Request retrieved successfully',
        data: request,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve request',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Requests for project retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No requests found for the project' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve requests for project' })
  @Get('project/:project_id')
  async findByProject(@Param('project_id') project_id: string) {
    try {
      if (isNaN(+project_id)) {
        throw new HttpException('Invalid project ID', HttpStatus.BAD_REQUEST);
      }

      const requests = await this.requestService.findAllByProjectId(+project_id);

      if (!requests || requests.length === 0) {
        throw new HttpException('No requests found for the project', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Requests for project retrieved successfully',
        data: requests,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve requests for project',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Requests for user retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No requests found for the user' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve requests for user' })
  @Get('user/:user_id')
  async findByUser(@Param('user_id') user_id: string) {
    try {
      if (isNaN(+user_id)) {
        throw new HttpException('Invalid user ID', HttpStatus.BAD_REQUEST);
      }

      const requests = await this.requestService.findAllByUserId(+user_id);

      if (!requests || requests.length === 0) {
        throw new HttpException('No requests found for the user', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Requests for user retrieved successfully',
        data: requests,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve requests for user',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Requests by status retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No requests found with the specified status' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve requests by status' })
  @Get('status/:status')
  async findByStatus(@Param('status') status: string) {
    try {
      const requests = await this.requestService.findAllByStatus(status);

      if (!requests || requests.length === 0) {
        throw new HttpException('No requests found with the specified status', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Requests by status retrieved successfully',
        data: requests,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to retrieve requests by status',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } })
  @ApiResponse({ status: HttpStatus.OK, description: 'Request updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to update request' })
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() status: { status: string }) {
    try {
      if (isNaN(+id)) {
        throw new HttpException('Invalid request ID', HttpStatus.BAD_REQUEST);
      }

      const updatedRequest = await this.requestService.updateStatus(+id, status.status);

      if (!updatedRequest) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Request updated successfully',
        data: updatedRequest,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to update request',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiBody({ type: UpdateRequestDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Request updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid request ID' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to update request' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateRequestDto: UpdateRequestDto) {
    try {
      if (isNaN(+id)) {
        throw new HttpException('Invalid request ID', HttpStatus.BAD_REQUEST);
      }

      const updatedRequest = await this.requestService.update(+id, updateRequestDto);

      if (!updatedRequest) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Request updated successfully',
        data: updatedRequest,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to update request',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' }, passwordCPanel: { type: 'string' } }, required: ['id', 'passwordCPanel'] } })
  @ApiResponse({ status: HttpStatus.OK, description: 'Request sent to logistics successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid request ID or request type' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to send request to logistics' })
  @Post('send-to-logistics')
  async sendToLogistics(@Body() body : { request_id: number, passwordCPanel: string }) {
    try {
      if (isNaN(+body.request_id)) {
        throw new HttpException('Invalid request ID', HttpStatus.BAD_REQUEST);
      }

      const request = await this.requestService.findOne(+body.request_id);

      if (!request) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      if (request.status !== 'draft') {
        throw new HttpException('Only requests with status "draft" can be sent', HttpStatus.BAD_REQUEST);
      }

      if( request.type !== 'operative' && request.type !== 'security' && request.type !== 'operative and security') {
        throw new HttpException('Request type must be "operative", "security", or "operative and security"', HttpStatus.BAD_REQUEST);
      }

      const pdf = await this.pdfService.generateRequestPdf(request.request_id, request.type);

      if (!pdf) {
        throw new HttpException('Failed to generate PDF', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const emailSentToLogistics = await this.mailService.sendRequestToLogistics(request.request_id, body.passwordCPanel);

      if (!emailSentToLogistics || !emailSentToLogistics.success) {
        throw new HttpException('Failed to send email to logistics', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const updatedRequest = await this.requestService.updateStatus(+body.request_id, 'pending');

      return {
        statusCode: HttpStatus.OK,
        message: 'Request sent successfully',
        data: updatedRequest,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to send request',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Request removed successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to remove request' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      if (isNaN(+id)) {
        throw new HttpException('Invalid request ID', HttpStatus.BAD_REQUEST);
      }

      const existingRequest = await this.requestService.findOne(+id);

      if (!existingRequest) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      if (existingRequest.status !== 'draft') {
        throw new HttpException('Only requests with status "draft" can be removed', HttpStatus.BAD_REQUEST);
      }

      const removedRequest = await this.requestService.remove(+id);

      if (!removedRequest) {
        throw new HttpException('Request not found', HttpStatus.NOT_FOUND);
      }

      return {
        statusCode: HttpStatus.OK,
        message: 'Request removed successfully',
        data: removedRequest,
      };
    } catch (error) {
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Failed to remove request',
        error: error.message || 'Internal Server Error',
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Public()
  @Get('pdf/:id')
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfPath = path.join(__dirname, `../../output/requerimiento-${id}.pdf`);

    try {
      if (!fs.existsSync(pdfPath)) {
        throw new HttpException('PDF not found', HttpStatus.NOT_FOUND);
      }

      // Devuelve el PDF como attachment o inline
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=requerimiento-' + id + '.pdf');
      const stream = fs.createReadStream(pdfPath);
      stream.pipe(res);
    } catch (error) {
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to fetch PDF',
          error: error.message || 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
