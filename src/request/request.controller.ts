import { Controller, Get, Post, Body, Patch, Param, Delete, Res, ParseIntPipe, NotFoundException, InternalServerErrorException, Query } from '@nestjs/common';
import { Response } from 'express';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { MailService } from 'src/mail/mail.service';
import { PdfService } from 'src/pdf/pdf.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { RequestStatus } from './enum';

@Controller('request')
export class RequestController {
  constructor(private readonly requestService: RequestService,
              private readonly pdfService: PdfService, 
              private readonly mailService: MailService,
              private readonly configService: ConfigService) {}

  @Post()
  async create(@Body() createRequestDto: CreateRequestDto) {
    return await this.requestService.create(createRequestDto);
  }

  @Get()
async findAll(
  @Query('projectId', new ParseIntPipe({ optional: true })) projectId?: number,
  @Query('userId', new ParseIntPipe({ optional: true })) userId?: number,
  @Query('status') status?: RequestStatus,
  @Query('viewerId', new ParseIntPipe({ optional: true })) viewerId?: number, // <-- NUEVO
) {
  return await this.requestService.findAll(projectId, userId, status, viewerId);
}


  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.requestService.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body() status: { status: RequestStatus }) {
    return await this.requestService.updateStatus(id, status.status);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateRequestDto: UpdateRequestDto) {
      return await this.requestService.update(id, updateRequestDto);
  }

  @Post('sendLogistics')
  async sendToLogistics(@Body() body : { requestId: number, passwordCPanel: string }) {
    await this.pdfService.generateRequestPdf(body.requestId);

    const mailResult = await this.mailService.sendRequestToLogistics(body.requestId, body.passwordCPanel);
    
    // Verificar si el envío del correo fue exitoso antes de actualizar el estado
    if (mailResult.statusCode !== 200) {
      return mailResult; // Retornar el error del servicio de correo
    }
    
    return await this.requestService.updateStatus(+body.requestId, RequestStatus.inProgress);
  }
  
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.requestService.remove(id);
  }

  @Get('pdf/:id')
  async getPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const outputDir = this.configService.get<string>('PDF_OUTPUT_DIR') || path.resolve(__dirname, '..', '..', 'output');
    const pdfPath = path.resolve(outputDir, `requerimiento-${id}.pdf`);

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
