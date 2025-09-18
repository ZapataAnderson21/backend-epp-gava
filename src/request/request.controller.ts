import { Controller, Get, Post, Body, Patch, Param, Delete, Res, HttpStatus, HttpException, Req, ParseIntPipe, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Response } from 'express';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { ApiBody, ApiResponse } from '@nestjs/swagger';
import { Public } from 'src/user/jwt/public.decorator';
import { MailService } from 'src/mail/mail.service';
import { PdfService } from 'src/pdf/pdf.service';
import { RequestStatus } from 'src/request/entities/request.entity';
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
    return await this.requestService.create(createRequestDto);
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Requests retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No requests found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve requests' })
  @Get()
  async findAll() {
    return await this.requestService.findAll();
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Request retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve request' })
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.requestService.findOne(id);
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Requests for project retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No requests found for the project' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve requests for project' })
  @Get('project/:project_id')
  async findByProject(@Param('project_id', ParseIntPipe) project_id: number) {
    return await this.requestService.findAllByProjectId(project_id);
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Requests for user retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No requests found for the user' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve requests for user' })
  @Get('user/:user_id')
  async findByUser(@Param('user_id', ParseIntPipe) user_id: number) {
    return await this.requestService.findAllByUserId(user_id);
  }

  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Requests by status retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'No requests found with the specified status' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to retrieve requests by status' })
  @Get('status/:status')
  async findByStatus(@Param('status') status: string) {
    return await this.requestService.findAllByStatus(status);
  }

  @Public()
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } })
  @ApiResponse({ status: HttpStatus.OK, description: 'Request updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to update request' })
  @Patch(':id/status')
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body() status: { status: string }) {
    return await this.requestService.updateStatus(id, status.status);
  }

  @Public()
  @ApiBody({ type: UpdateRequestDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Request updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid request ID' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to update request' })
  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateRequestDto: UpdateRequestDto) {
      return await this.requestService.update(id, updateRequestDto);
  }

  @Public()
  @ApiBody({ schema: { type: 'object', properties: { id: { type: 'number' }, passwordCPanel: { type: 'string' } }, required: ['id', 'passwordCPanel'] } })
  @ApiResponse({ status: HttpStatus.OK, description: 'Request sent to logistics successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid request ID or request type' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to send request to logistics' })
  @Post('send-to-logistics')
  async sendToLogistics(@Body() body : { request_id: number, passwordCPanel: string }) {
    await this.pdfService.generateRequestPdf(body.request_id);

    await this.mailService.sendRequestToLogistics(body.request_id, body.passwordCPanel);

    return await this.requestService.updateStatus(+body.request_id, RequestStatus.InProgress);
  }
  
  @Public()
  @ApiResponse({ status: HttpStatus.OK, description: 'Request removed successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Request not found' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Failed to remove request' })
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.requestService.remove(id);
  }

  @Get('pdf/:id')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    //const pdfPath = path.resolve(__dirname, '..', '..', 'output', `requerimiento-${id}.pdf`);
    const pdfPath = path.resolve('/var/www/pdfs', `requerimiento-${id}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      throw new NotFoundException('PDF no encontrado');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=requerimiento-${id}.pdf`);
    const stream = fs.createReadStream(pdfPath);
    
    if(!stream) {
      throw new InternalServerErrorException('Error al leer el PDF');
    }

    stream.pipe(res);
  }
}
