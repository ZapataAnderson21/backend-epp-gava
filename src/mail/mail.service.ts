import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

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

    return HttpStatus.OK;
  }

  async findRequestById(request_id: number) {
    this.logger.log(`Searching for request with ID: ${request_id}`);
    const request = await this.prismaService.request.findUnique({
      where: { request_id },
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
      this.logger.warn(`Request with ID: ${request_id} not found`);
      throw new NotFoundException('Request not found');
    }

    this.logger.log(`Request with ID: ${request_id} found successfully`);
    return request;
  }

  async sendRequestToLogistics(request_id: number, passwordCPanel: string): Promise<{ success: boolean; messageId: string; response: string }> {
    const request = await this.findRequestById(request_id);

    const sender = request.user.email;
    const toEmail = 'logistica@gavacyc.com';
    const copyEmail = ['admin@gavacyc.com', 'hgayoso@gavacyc.com'];

    let subjectEmail = `Solicitud de Requerimiento - ${request.project.name}`;
    let type = '';
    switch (request.type) {
      case 'operative':
        subjectEmail = `Solicitud de Requerimiento de Operativo - ${request.project.name}`;
        type = 'Requerimiento de Elementos Operativos';
        break;
      case 'security':
        subjectEmail = `Solicitud de Requerimiento de EPP's - ${request.project.name}`;
        type = 'Requerimiento de Elementos de Protección Personal (EPP)';
        break;
      case 'operative and security':
        subjectEmail = `Solicitud de Requerimiento mixto - ${request.project.name}`;
        type = 'Requerimiento de Elementos Operativos y de Protección Personal (EPP)';
        break;
    }

    const outputDir = this.configService.get<string>('PDF_OUTPUT_DIR') || '/var/www/pdfs';

    const pdfPath = path.resolve(outputDir, `requerimiento-${request_id}.pdf`);

    //const pdfPath = path.resolve(__dirname, '..', '..', 'output', `requerimiento-${request_id}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      throw new NotFoundException(`El archivo PDF no fue encontrado en la ruta: ${pdfPath}`);
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

    const now = new Date();
    const formattedDate = now.toLocaleString('es-PE', { timeZone: 'America/Lima' });
    const formattedDeliveryDueDate = new Date(request.delivery_due_date).toLocaleString('es-PE', { timeZone: 'America/Lima' });

    const mailOptions = {
      from: `"${request.user.name} ${request.user.last_name}" <${sender}>`,
      to: toEmail,
      cc: copyEmail.join(', '),
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
      <p>Estimada señora Gloria, adjunto el presente requerimiento. Agradeceré su pronta atención.</p>
      <p>Saludos cordiales, ${request.user.name} ${request.user.last_name}</p>
      <br>
      <div style="width: 100%; display: flex; align-items: center; justify-content: center; text-align: center;">
        <a href="https://sir.gavacyc.com/admin/requests/${request_id}">
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
      {
        filename: `requerimiento-${request_id}.pdf`,
        path: pdfPath,
        contentType: 'application/pdf',
      },
      ],
    };

    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: result.messageId,
      response: result.response,
    };
  }

}
