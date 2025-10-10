import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RequestType } from 'src/request/enum/request-type.enum';

@Injectable()
export class MailService {

  private readonly logger = new Logger("MailService");

  constructor(private readonly prismaService: PrismaService,
              private readonly configService: ConfigService){}

  async sendPasswordResetEmail( toEmail: string, token: string) {
    const fromEmail = 'az.sistema@gavacyc.com';
    const fromPassword = 'sistema2025@';

    const transporter = nodemailer.createTransport({
      host: 'mail.gavacyc.com',
      port: 465,
      secure: true,
      auth: {
        user: fromEmail,
        pass: fromPassword
      }
    });

    const resetLink = `https://sir.gavacyc.com/reset-password?token=${token}`;

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
      `
    };

    await transporter.sendMail(mailOptions);

    return {
      statusCode: HttpStatus.OK,
      message: 'Correo de recuperación de contraseña enviado.'
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
                userType: true
              }
            }
          }
        }
      }
    });

    if (!request) {
      this.logger.warn(`Request with ID: ${requestId} not found`);
      throw new NotFoundException('Request not found');
    }

    this.logger.log(`Request with ID: ${requestId} found successfully`);
    return request;
  }

  async sendRequestToLogistics(requestId: number, passwordCPanel: string) {
    try {
      const request = await this.findRequestById(requestId);

      const sender = request.user.email;
      const toEmail = 'zapataascencioanderson@gmail.com';
      const copyEmail = ['loco.21libra@gmail.com'];

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
          type = 'Requerimiento de Elementos Operativos y de Protección Personal (EPP)';
          break;
      }

      //const outputDir = this.configService.get<string>('PDF_OUTPUT_DIR') || '/var/www/pdfs';

      //const pdfPath = path.resolve(outputDir, `requerimiento-${requestId}.pdf`);

      const pdfPath = path.resolve(__dirname, '..', '..', 'output', `requerimiento-${requestId}.pdf`);

      if (!fs.existsSync(pdfPath)) {
        return {
          statusCode: 404,
          message: `El archivo PDF no fue encontrado en la ruta: ${pdfPath}`,
          data: null,
        };
      }

      const transporter = nodemailer.createTransport({
        host: 'mail.gavacyc.com',
        port: 465,
        secure: true,
        auth: {
          user: sender,
          pass: passwordCPanel,
        },
      });

      // 💥 Verifica autenticación antes de enviar
      await transporter.verify();

      const now = new Date();
      const formattedDate = now.toLocaleString('es-PE', { timeZone: 'America/Lima' });
      const formattedDeliveryDueDate = new Date(request.deliveryDueDate).toLocaleString('es-PE', { timeZone: 'America/Lima' });

      const mailOptions = {
        from: `"${request.user.name} ${request.user.lastName}" <${sender}>`,
        to: 'zapataascencioanderson@gmail.com',
        subject: `Solicitud de Requerimiento - ${request.project.name}`,
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
            <a href="https://sir.gavacyc.com/admin/requests/${requestId}">
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
        attachments: [{ filename: `requerimiento-${requestId}.pdf`, path: pdfPath }],
      };

      const result = await transporter.sendMail(mailOptions);

      return {
        statusCode: 200,
        message: 'Correo enviado correctamente.',
        data: {
          messageId: result.messageId,
          response: result.response,
        },
      };

    } catch (error: any) {
      // 💥 Captura errores de login SMTP u otros
      if (error.code === 'EAUTH') {
        return {
          statusCode: 401,
          message: 'Error de autenticación SMTP: credenciales inválidas.',
          data: error.response || null,
        };
      }

      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return {
          statusCode: 503,
          message: 'No se pudo conectar con el servidor SMTP.',
          data: error.message,
        };
      }

      // Error general
      return {
        statusCode: 500,
        message: error.message || 'Error desconocido al enviar el correo.',
        data: error.stack || null,
      };
    }
  }
}
