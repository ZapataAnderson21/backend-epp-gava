import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class MailService {

  constructor(private readonly prismaService: PrismaService){}

  async sendPasswordResetEmail( toEmail: string, token: string): Promise<void> {
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

    const resetLink = `https://localhost:5173/reset-password?token=${token}`;

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
  }

  
  async sendRequestToLogistics(request_id: number, passwordCPanel: string): Promise<{ success: boolean; messageId: string; response: string }> {
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

    console.log("MAIL-SERVICE:")
    console.log("Request:" + request)

    if (!request) {
      throw new Error('Request not found');
    }

    const sender = request.user.email;
    const toEmail = 'az.sistema@gavacyc.com';
    const copyEmail = ['zapataascencioanderson@gmail.com', 'moralove2002@gmail.com'];

    let subjectEmail = '';
    let type = '';
    switch (request.type) {
      case 'operative':
        subjectEmail = `Solicitud de Requerimiento de Elementos Operativos - ${request.project.name}`;
        type = 'Requerimiento de Elementos Operativos';
        break;
      case 'security':
        subjectEmail = `Solicitud de Requerimiento de Elementos de Seguridad - ${request.project.name}`;
        type = 'Requerimiento de Elementos de Protección Personal (EPP)';
        break;
      case 'operative and security':
        subjectEmail = `Solicitud de Requerimiento de Elementos Operativos y de Seguridad - ${request.project.name}`;
        type = 'Requerimiento de Elementos Operativos y de Protección Personal (EPP)';
        break;
    }

    const pdfPath = path.resolve(__dirname, '..', '..', 'output', `requerimiento-${request_id}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      throw new Error(`El archivo PDF no fue encontrado en la ruta: ${pdfPath}`);
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

    const mailOptions = {
      from: `"${request.user.name} ${request.user.last_name}" <${sender}>`,
      to: toEmail,
      cc: copyEmail.join(', '),
      subject: subjectEmail,
      html: `
      <p>Estimado Ing. Henrry Gayoso y equipo de logística,</p>
      <p>Por medio de la presente, se remite la solicitud de requerimiento de elementos para el proyecto <strong>${request.project.name}</strong>.</p>
      <p>Detalles de la solicitud:</p>
      <ul>
        <li><strong>Descripción:</strong> ${request.description}</li>
        <li><strong>Tipo:</strong> ${type}</li>
        <li><strong>Fecha y hora de solicitud:</strong> ${formattedDate}</li>
      </ul>
      <p>Saludos cordiales,<br>${request.user.name} ${request.user.last_name}</p>
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
