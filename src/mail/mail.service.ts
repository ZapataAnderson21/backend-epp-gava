// src/mail/mail.service.ts
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {

  async sendPasswordResetEmail(
    toEmail: string,
    token: string
  ): Promise<void> {
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
}
