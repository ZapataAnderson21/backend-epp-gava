import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Res,
  ParseIntPipe,
  NotFoundException,
  InternalServerErrorException,
  Query,
  HttpStatus,
} from '@nestjs/common';
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
import { NotificationGateway } from 'src/notification/notification.gateway';
import { GetUser } from 'src/decorators/get-user.decorator';
import { ListRequestsQueryDto } from './dto/list-requests-query.dto';

@Controller('request')
export class RequestController {
  constructor(
    private readonly requestService: RequestService,
    private readonly pdfService: PdfService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  @Post()
  async create(@Body() createRequestDto: CreateRequestDto) {
    return await this.requestService.create(createRequestDto);
  }

  @Get()
  async findAll(
    @Query('projectId', new ParseIntPipe({ optional: true }))
    projectId?: number,
    @Query('userId', new ParseIntPipe({ optional: true })) userId?: number,
    @Query('status') status?: RequestStatus,
    @Query('viewerId', new ParseIntPipe({ optional: true })) viewerId?: number, // <-- NUEVO
  ) {
    return await this.requestService.findAll(
      projectId,
      userId,
      status,
      viewerId,
    );
  }

  @Get('paginated')
  async findPaginated(@Query() query: ListRequestsQueryDto) {
    return await this.requestService.findPaginated(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.requestService.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: RequestStatus; actorUserId?: number },
    @GetUser('userId') userId: number,
  ) {
    return await this.requestService.updateStatus(
      id,
      body.status,
      userId || body.actorUserId,
    );
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRequestDto: UpdateRequestDto,
  ) {
    return await this.requestService.update(id, updateRequestDto);
  }

  @Post('sendLogistics')
  async sendToLogistics(
    @GetUser('userId') userId: number,
    @Body()
    body: {
      requestId: number;
      passwordCPanel: string;
      operationId?: string;
      progressUserId?: number;
    },
  ) {
    const requestId = Number(body.requestId);
    const progressUserId = Number(body.progressUserId || 0);
    const operationId = body.operationId || `request-mail-${requestId}`;

    const emitProgress = (
      step: string,
      status: 'running' | 'success' | 'error',
      message: string,
      extra: Record<string, unknown> = {},
    ) => {
      if (!progressUserId) return;

      this.notificationGateway.sendRequestMailProgressToUser(progressUserId, {
        operationId,
        requestId,
        step,
        status,
        message,
        timestamp: new Date().toISOString(),
        ...extra,
      });
    };

    emitProgress(
      'validate-smtp',
      'running',
      'Validando la contrasena con el servidor de correos...',
    );

    const validationResult =
      await this.mailService.validateRequestSmtpCredentials(
        requestId,
        body.passwordCPanel,
      );

    if (validationResult.statusCode !== 200) {
      emitProgress('validate-smtp', 'error', validationResult.message, {
        data: validationResult.data,
      });
      return validationResult;
    }

    emitProgress(
      'validate-smtp',
      'success',
      'Contrasena validada correctamente.',
    );

    try {
      emitProgress(
        'generate-pdf',
        'running',
        'Generando el PDF del requerimiento...',
      );
      await this.pdfService.generateRequestPdf(requestId);
      emitProgress('generate-pdf', 'success', 'PDF generado correctamente.');
    } catch (error: unknown) {
      const message =
        (error instanceof Error ? error.message : '') ||
        'No se pudo generar el PDF del requerimiento antes del envio.';
      emitProgress('generate-pdf', 'error', message);
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        data: null,
      };
    }

    emitProgress('send-email', 'running', 'Enviando correo a logistica...');
    const mailResult = await this.mailService.sendRequestToLogistics(
      requestId,
      body.passwordCPanel,
      { skipVerification: true },
    );

    // Verificar si el envío del correo fue exitoso antes de actualizar el estado
    if (mailResult.statusCode !== 200) {
      emitProgress('send-email', 'error', mailResult.message, {
        data: mailResult.data,
      });
      return mailResult;
    }

    emitProgress('send-email', 'success', 'Correo enviado correctamente.');

    try {
      emitProgress(
        'update-status',
        'running',
        'Actualizando el estado del requerimiento...',
      );
      const result = await this.requestService.updateStatus(
        requestId,
        RequestStatus.inProgress,
        userId || progressUserId || undefined,
      );
      emitProgress(
        'done',
        'success',
        'Requerimiento enviado y actualizado correctamente.',
      );
      return result;
    } catch (error: unknown) {
      const message =
        (error instanceof Error ? error.message : '') ||
        'El correo fue enviado, pero no se pudo actualizar el estado.';
      emitProgress('update-status', 'error', message);
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        data: null,
      };
    }
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.requestService.remove(id);
  }

  @Get('pdf/:id')
  getPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const outputDir =
      this.configService.get<string>('PDF_OUTPUT_DIR') ||
      path.resolve(__dirname, '..', '..', 'output');
    const pdfPath = path.resolve(outputDir, `requerimiento-${id}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      throw new NotFoundException('PDF no encontrado');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename=requerimiento-${id}.pdf`,
    );
    const stream = fs.createReadStream(pdfPath);

    if (!stream) {
      throw new InternalServerErrorException('Error al leer el PDF');
    }

    stream.pipe(res);
  }
}
