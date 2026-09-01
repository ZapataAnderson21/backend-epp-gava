import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RequestType } from 'src/request/enum/request-type.enum';

interface SmtpErrorDetails {
  code?: string;
  command?: string;
  responseCode?: number;
  response?: string;
  message?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger('MailService');

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async sendDocumentExpiryAlert(input: {
    recipients: string[];
    title: string;
    categoryName: string;
    expirationDate: Date;
    daysRemaining: number;
    referenceDescription: string;
    storageSpace: string;
    storagePath?: string | null;
    storageDescription?: string | null;
  }) {
    const sender = this.configService.get<string>('MAIL_FROM');
    const password = this.configService.get<string>('MAIL_PASSWORD');
    const mailHost = this.configService.get<string>('MAIL_HOST');
    const mailPort = Number(this.configService.get<number>('MAIL_PORT') || 465);

    if (!sender || !password || !mailHost || input.recipients.length === 0) {
      throw new Error(
        'No se ha configurado el remitente SMTP o los destinatarios de vencimientos.',
      );
    }

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    const formattedDate = input.expirationDate.toLocaleDateString('es-PE', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'long',
      day: '2-digit',
    });
    const urgency = input.daysRemaining < 0
      ? `vencio hace ${Math.abs(input.daysRemaining)} dia(s)`
      : input.daysRemaining === 0
        ? 'vence hoy'
        : `vence en ${input.daysRemaining} dia(s)`;
    const appUrl = this.configService.get<string>('APP_URL') || 'https://sir.gavacyc.com';
    const transporter = this.createSmtpTransporter(sender, password, mailHost, mailPort);

    try {
      const result = await transporter.sendMail({
        from: `"SIR GAVA - Vencimientos" <${sender}>`,
        to: input.recipients,
        subject: `Aviso de vencimiento: ${input.title} (${urgency})`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#30343b">
            <h2 style="color:#0047a3">Aviso de vencimiento documental</h2>
            <p>El documento <strong>${escapeHtml(input.title)}</strong> ${escapeHtml(urgency)}.</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px;border:1px solid #ddd"><strong>Categoria</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(input.categoryName)}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd"><strong>Vencimiento</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(formattedDate)}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd"><strong>Relacionado con</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(input.referenceDescription)}</td></tr>
              <tr><td style="padding:8px;border:1px solid #ddd"><strong>Almacenamiento</strong></td><td style="padding:8px;border:1px solid #ddd">${escapeHtml([input.storageSpace, input.storagePath, input.storageDescription].filter(Boolean).join(' - '))}</td></tr>
            </table>
            <p style="margin-top:24px"><a href="${appUrl}/admin/document-expirations" style="background:#0047a3;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Ver documentos</a></p>
          </div>`,
      });
      return result;
    } finally {
      transporter.close();
    }
  }

  private createSmtpTransporter(
    sender: string,
    password: string,
    mailHost: string,
    mailPort: number,
  ) {
    const normalizedMailPort = Number(mailPort || 465);
    const isImplicitTls = normalizedMailPort === 465;

    const options: SMTPTransport.Options = {
      host: mailHost,
      port: normalizedMailPort,
      secure: isImplicitTls,
      requireTLS: normalizedMailPort === 587,
      name: mailHost,
      auth: {
        user: sender,
        pass: password,
      },
      tls: {
        servername: mailHost,
      },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
    };

    return nodemailer.createTransport(options);
  }

  private normalizeSmtpError(error: unknown): SmtpErrorDetails {
    if (!(error instanceof Error)) return {};
    return error as Error & SmtpErrorDetails;
  }

  private buildSmtpErrorData(error: unknown) {
    const smtpError = this.normalizeSmtpError(error);
    return {
      code: smtpError.code || null,
      command: smtpError.command || null,
      responseCode: smtpError.responseCode || null,
      response: smtpError.response || smtpError.message || null,
    };
  }

  private formatSmtpError(error: unknown) {
    const smtpError = this.normalizeSmtpError(error);
    const response = this.buildSmtpErrorData(error);

    if (smtpError.code === 'EAUTH' || smtpError.responseCode === 535) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message:
          'La contrasena del servidor de correos no es valida. Verifica la contrasena e intenta nuevamente.',
        data: response,
      };
    }

    if (
      smtpError.code &&
      ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKET'].includes(
        smtpError.code,
      )
    ) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          'No se pudo conectar con el servidor de correos. Verifique host, puerto, conexión del VPS o firewall.',
        data: response,
      };
    }

    if (typeof smtpError.responseCode === 'number') {
      return {
        statusCode: HttpStatus.BAD_GATEWAY,
        message: `El servidor de correos respondió con el código ${smtpError.responseCode}.`,
        data: response,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: smtpError.message || 'Error desconocido al validar el correo.',
      data: response,
    };
  }

  async validateRequestSmtpCredentials(
    requestId: number,
    passwordCPanel: string,
  ) {
    if (!passwordCPanel) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'La contraseña del sistema de correos es requerida.',
        data: null,
      };
    }

    try {
      const request = await this.findRequestById(requestId);
      const sender = request.user.email;
      const mailHost = this.configService.get<string>('MAIL_HOST');
      const mailPort = Number(this.configService.get<number>('MAIL_PORT') || 465);

      if (!sender) {
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'El usuario solicitante no tiene correo registrado.',
          data: null,
        };
      }

      if (!mailHost) {
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Configuración de correo incompleta. Falta MAIL_HOST.',
          data: null,
        };
      }

      const transporter = this.createSmtpTransporter(
        sender,
        passwordCPanel,
        mailHost,
        mailPort,
      );

      await transporter.verify();
      transporter.close();

      return {
        statusCode: HttpStatus.OK,
        message: 'Contraseña validada correctamente con el servidor de correos.',
        data: null,
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: error.message,
          data: null,
        };
      }

      if (error instanceof HttpException) {
        return {
          statusCode: error.getStatus(),
          message: error.message,
          data: null,
        };
      }

      return this.formatSmtpError(error);
    }
  }

  async sendPasswordResetEmail(toEmail: string, token: string) {
    const fromEmail = this.configService.get<string>('MAIL_FROM');
    const fromPassword = this.configService.get<string>('MAIL_PASSWORD');
    const mailHost = this.configService.get<string>('MAIL_HOST');
    const mailPort = Number(this.configService.get<number>('MAIL_PORT') || 465);
    const resetPasswordUrl =
      this.configService.get<string>('RESET_PASSWORD_URL');

    if (!fromEmail || !fromPassword || !mailHost) {
      throw new HttpException(
        'Configuración de correo incompleta. Verifique las variables de entorno.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const transporter = this.createSmtpTransporter(
      fromEmail,
      fromPassword,
      mailHost,
      mailPort,
    );

    const resetLink = `${resetPasswordUrl}?token=${token}`;

    const mailOptions = {
      from: `"Sistema GAVA" <${fromEmail}>`,
      to: toEmail,
      subject: 'Recuperación de contraseña',
      html: `
        <p>Hola,</p>
        <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Este enlace expirará en 1 hora.</p>
        <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
        <p>Saludos,<br>Equipo GAVA</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: HttpStatus.OK,
      message: 'Correo de recuperación de contraseña enviado.',
    };
  }

  async findRequestById(requestId: number) {
    this.logger.log(`Searching for request with ID: ${requestId}`);
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
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
    });

    if (!request) {
      this.logger.warn(`Request with ID: ${requestId} not found`);
      throw new NotFoundException('Request not found');
    }

    this.logger.log(`Request with ID: ${requestId} found successfully`);
    return request;
  }

  async sendRequestToLogistics(
    requestId: number,
    passwordCPanel: string,
    options: { skipVerification?: boolean } = {},
  ) {
    this.logger.log(
      `Preparing to send request ID: ${requestId} to logistics via email`,
    );
    try {
      const request = await this.findRequestById(requestId);
      this.logger.log(
        `Request ID: ${requestId} found. Project: ${request.project.name}, User: ${request.user.email}`,
      );

      const sender = request.user.email;
      const toEmail = this.configService.get<string>('MAIL_LOGISTICS_TO');
      const copyEmails =
        this.configService.get<string>('MAIL_LOGISTICS_CC')?.split(',') || [];
      const mailHost = this.configService.get<string>('MAIL_HOST');
      const mailPort = Number(this.configService.get<number>('MAIL_PORT') || 465);

      this.logger.debug(
        `Mail config - Host: ${mailHost}, Port: ${mailPort}, To: ${toEmail}, CC: ${copyEmails.join(', ') || 'none'}`,
      );

      if (!mailHost || !toEmail) {
        this.logger.error(
          'Incomplete mail configuration. MAIL_HOST or MAIL_LOGISTICS_TO is missing.',
        );
        throw new HttpException(
          'Configuración de correo incompleta. Verifique las variables de entorno.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      let subjectEmail = `Solicitud de Requerimiento - ${request.project.name}`;
      let type = '';
      switch (request.type) {
        case 'operative':
          subjectEmail = `Solicitud de Requerimiento de Operativo - ${request.project.name}`;
          type = 'Requerimiento de Elementos Operativos';
          break;
        case RequestType.Epp:
          subjectEmail = `Solicitud de Requerimiento de EPP's - ${request.project.name}`;
          type = 'Requerimiento de Elementos de Protección Personal (EPP)';
          break;
        case RequestType.EppAndOperative:
          subjectEmail = `Solicitud de Requerimiento mixto - ${request.project.name}`;
          type =
            'Requerimiento de Elementos Operativos y de Protección Personal (EPP)';
          break;
      }
      this.logger.log(
        `Request type: ${request.type} - Subject: ${subjectEmail}`,
      );

      const outputDir =
        this.configService.get<string>('PDF_OUTPUT_DIR') || '/var/www/pdfs';
      const pdfPath = path.resolve(outputDir, `requerimiento-${requestId}.pdf`);
      this.logger.debug(`PDF path: ${pdfPath}`);

      if (!fs.existsSync(pdfPath)) {
        this.logger.warn(`PDF file not found at path: ${pdfPath}`);
        return {
          statusCode: 404,
          message: `El archivo PDF no fue encontrado en la ruta: ${pdfPath}`,
          data: null,
        };
      }
      this.logger.log(`PDF file found at: ${pdfPath}`);

      this.logger.log(`Creating SMTP transporter for sender: ${sender}`);
      const transporter = this.createSmtpTransporter(
        sender,
        passwordCPanel,
        mailHost,
        mailPort,
      );

      if (!options.skipVerification) {
        this.logger.log('Verifying SMTP authentication...');
        await transporter.verify();
        this.logger.log('SMTP authentication successful');
      }

      const now = new Date();
      const formattedDate = now.toLocaleString('es-PE', {
        timeZone: 'America/Lima',
      });
      const formattedDeliveryDueDate = new Date(
        request.deliveryDueDate,
      ).toLocaleString('es-PE', { timeZone: 'America/Lima' });

      const appUrl =
        this.configService.get<string>('APP_URL') || 'https://sir.gavacyc.com';

      const mailOptions = {
        from: `"${request.user.name} ${request.user.lastName}" <${sender}>`,
        to: toEmail,
        cc: copyEmails.length > 0 ? copyEmails : undefined,
        subject: subjectEmail,
        html: `
          <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #353535; 
                background-color: #f9f9f9; padding: 24px; border-radius: 8px; max-width: 600px; 
                margin: auto;">
          <h2 style="text-align: center; text-transform: uppercase; font-weight: bold; color: black;">${subjectEmail}</h2>
          <p>
            <strong>Tipo de Requerimiento:</strong> ${type}
          </p>
          <p>
            <strong>Fecha y hora de solicitud:</strong> ${formattedDate}
          </p>
          <p>
            <strong>Fecha y hora de entrega:</strong> ${formattedDeliveryDueDate}
          </p>
          <p>Estimado equipo de logística, adjunto el presente requerimiento. Agradeceré su pronta atención.</p>
          <p>Saludos cordiales, ${request.user.name} ${request.user.lastName}</p>
          <br>
          <div style="width: 100%; display: flex; align-items: center; justify-content: center; text-align: center;">
            <a href="${appUrl}/admin/requests/${requestId}">
              <button style="
                background-color: #0047a3;
                color: white;
                padding-left: 1.5rem;
                padding-right: 1.5rem;
                padding-top: 1rem;
                padding-bottom: 1rem;
                border-radius: 0.375rem;
                transition: background-color 0.2s;
                cursor: pointer;
                border: none;
                font-weight: bold;
              "
              onmouseover="this.style.backgroundColor='#003a80'"
              onmouseout="this.style.backgroundColor='#0047a3'"
              >Ver Requerimiento</button>
            </a>
          </div>
        </div>
          `,
        attachments: [
          { filename: `requerimiento-${requestId}.pdf`, path: pdfPath },
        ],
      };

      this.logger.log(`Sending email from ${sender} to ${toEmail}...`);
      const result = await transporter.sendMail(mailOptions);
      transporter.close();
      this.logger.log(
        `Email sent successfully. MessageId: ${result.messageId}`,
      );

      return {
        statusCode: 200,
        message: 'Correo enviado correctamente.',
        data: {
          messageId: result.messageId,
          response: result.response,
        },
      };
    } catch (error: unknown) {
      if (error instanceof NotFoundException) {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: error.message,
          data: null,
        };
      }

      if (error instanceof HttpException) {
        return {
          statusCode: error.getStatus(),
          message: error.message,
          data: null,
        };
      }

      const smtpError = this.normalizeSmtpError(error);

      if (smtpError.code === 'EAUTH') {
        this.logger.error(
          `SMTP authentication error for request ID: ${requestId}. Response: ${smtpError.response}`,
        );
        return this.formatSmtpError(error);
      }

      if (
        smtpError.code === 'ENOTFOUND' ||
        smtpError.code === 'ECONNREFUSED' ||
        smtpError.code === 'ETIMEDOUT' ||
        smtpError.code === 'ESOCKET'
      ) {
        this.logger.error(
          `SMTP connection error for request ID: ${requestId}. Code: ${smtpError.code}, Message: ${smtpError.message}`,
        );
        return this.formatSmtpError(error);
      }

      this.logger.error(
        `Unexpected error sending email for request ID: ${requestId}. Error: ${smtpError.message ?? 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: smtpError.message || 'Error desconocido al enviar el correo.',
        data: error instanceof Error ? error.stack || null : null,
      };
    }
  }
}
