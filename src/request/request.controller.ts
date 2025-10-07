import { Controller, Get, Post, Body, Patch, Param, Delete, Res, ParseIntPipe, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Response } from 'express';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { MailService } from 'src/mail/mail.service';
import { PdfService } from 'src/pdf/pdf.service';
import * as fs from 'fs';
import * as path from 'path';
import { RequestStatus } from './enum';

@Controller('request')
export class RequestController {
  constructor(private readonly requestService: RequestService,
              private readonly pdfService: PdfService, 
              private readonly mailService: MailService) {}

  @Post()
  async create(@Body() createRequestDto: CreateRequestDto) {
    return await this.requestService.create(createRequestDto);
  }

  @Get()
  async findAll() {
    return await this.requestService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.requestService.findOne(id);
  }

  @Get('project/:project_id')
  async findByProject(@Param('project_id', ParseIntPipe) project_id: number) {
    return await this.requestService.findAllByProjectId(project_id);
  }

  @Get('user/:user_id')
  async findByUser(@Param('user_id', ParseIntPipe) user_id: number) {
    return await this.requestService.findAllByUserId(user_id);
  }
  
  @Get('status/:status')
  async findByStatus(@Param('status') status: RequestStatus) {
    return await this.requestService.findAllByStatus(status);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body() status: { status: RequestStatus }) {
    return await this.requestService.updateStatus(id, status.status);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateRequestDto: UpdateRequestDto) {
      return await this.requestService.update(id, updateRequestDto);
  }

  @Post('send-to-logistics')
  async sendToLogistics(@Body() body : { request_id: number, passwordCPanel: string }) {
    await this.pdfService.generateRequestPdf(body.request_id);

    await this.mailService.sendRequestToLogistics(body.request_id, body.passwordCPanel);

    return await this.requestService.updateStatus(+body.request_id, RequestStatus.inProgress);
  }
  
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
