import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';

// Mock nodemailer
jest.mock('nodemailer');
jest.mock('fs');

describe('MailService', () => {
  let service: MailService;
  let prismaService: PrismaService;
  let configService: ConfigService;

  const mockPrismaService = {
    request: {
      findUnique: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockTransporter = {
    verify: jest.fn(),
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    prismaService = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendRequestToLogistics', () => {
    const mockRequest = {
      requestId: 1,
      type: 'epp',
      deliveryDueDate: new Date('2026-01-10'),
      project: { name: 'Proyecto Test' },
      user: {
        email: 'usuario@test.com',
        name: 'Juan',
        lastName: 'Pérez',
        userUserTypes: [{ userType: { name: 'INGENIERO' } }],
      },
    };

    const defaultConfigValues = {
      MAIL_LOGISTICS_TO: 'logistica@test.com',
      MAIL_LOGISTICS_CC: 'copia1@test.com,copia2@test.com',
      MAIL_HOST: 'mail.test.com',
      MAIL_PORT: 465,
      PDF_OUTPUT_DIR: '/var/www/pdfs',
      APP_URL: 'https://sir.gavacyc.com',
    };

    beforeEach(() => {
      mockConfigService.get.mockImplementation((key: string) => defaultConfigValues[key]);
      mockPrismaService.request.findUnique.mockResolvedValue(mockRequest);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      mockTransporter.verify.mockResolvedValue(true);
      mockTransporter.sendMail.mockResolvedValue({
        messageId: '<test-message-id>',
        response: '250 OK',
      });
    });

    it('should send email successfully for EPP request', async () => {
      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(200);
      expect(result.message).toBe('Correo enviado correctamente.');
      expect(result.data.messageId).toBe('<test-message-id>');
      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(mockTransporter.sendMail).toHaveBeenCalled();

      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain("EPP's");
      expect(mailOptions.to).toBe('logistica@test.com');
      expect(mailOptions.cc).toEqual(['copia1@test.com', 'copia2@test.com']);
    });

    it('should send email successfully for operative request', async () => {
      mockPrismaService.request.findUnique.mockResolvedValue({
        ...mockRequest,
        type: 'operative',
      });

      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(200);
      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain('Operativo');
    });

    it('should send email successfully for mixed request (EPP and Operative)', async () => {
      mockPrismaService.request.findUnique.mockResolvedValue({
        ...mockRequest,
        type: 'eppAndOperative',
      });

      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(200);
      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.subject).toContain('mixto');
    });

    it('should return 500 when request is not found', async () => {
      mockPrismaService.request.findUnique.mockResolvedValue(null);

      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Request not found');
    });

    it('should return 404 when PDF file does not exist', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(404);
      expect(result.message).toContain('El archivo PDF no fue encontrado');
    });

    it('should return 401 for SMTP authentication error', async () => {
      const authError = new Error('Authentication failed');
      (authError as any).code = 'EAUTH';
      (authError as any).response = 'Invalid credentials';
      mockTransporter.verify.mockRejectedValue(authError);

      const result = await service.sendRequestToLogistics(1, 'wrongpassword');

      expect(result.statusCode).toBe(401);
      expect(result.message).toBe('Error de autenticación SMTP: credenciales inválidas.');
    });

    it('should return 503 when SMTP server is not reachable (ENOTFOUND)', async () => {
      const connectionError = new Error('Server not found');
      (connectionError as any).code = 'ENOTFOUND';
      mockTransporter.verify.mockRejectedValue(connectionError);

      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(503);
      expect(result.message).toBe('No se pudo conectar con el servidor SMTP.');
    });

    it('should return 503 when SMTP connection is refused (ECONNREFUSED)', async () => {
      const connectionError = new Error('Connection refused');
      (connectionError as any).code = 'ECONNREFUSED';
      mockTransporter.verify.mockRejectedValue(connectionError);

      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(503);
      expect(result.message).toBe('No se pudo conectar con el servidor SMTP.');
    });

    it('should return 500 for unknown errors', async () => {
      const unknownError = new Error('Unknown error occurred');
      mockTransporter.sendMail.mockRejectedValue(unknownError);

      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(500);
      expect(result.message).toBe('Unknown error occurred');
    });

    it('should throw HttpException when mail configuration is incomplete', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MAIL_HOST') return undefined;
        return defaultConfigValues[key];
      });

      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(500);
    });

    it('should send email without CC when MAIL_LOGISTICS_CC is not configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'MAIL_LOGISTICS_CC') return undefined;
        return defaultConfigValues[key];
      });

      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(200);
      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.cc).toBeUndefined();
    });

    it('should use default PDF_OUTPUT_DIR when not configured', async () => {
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'PDF_OUTPUT_DIR') return undefined;
        return defaultConfigValues[key];
      });

      await service.sendRequestToLogistics(1, 'password123');

      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('requerimiento-1.pdf'),
      );
    });

    it('should include PDF attachment in email', async () => {
      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(200);
      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.attachments).toHaveLength(1);
      expect(mailOptions.attachments[0].filename).toBe('requerimiento-1.pdf');
    });

    it('should format dates correctly in the email', async () => {
      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(200);
      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('Fecha y hora de solicitud:');
      expect(mailOptions.html).toContain('Fecha y hora de entrega:');
    });

    it('should include the correct sender information', async () => {
      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(200);
      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.from).toBe('"Juan Pérez" <usuario@test.com>');
    });

    it('should include view request button with correct URL', async () => {
      const result = await service.sendRequestToLogistics(1, 'password123');

      expect(result.statusCode).toBe(200);
      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('https://sir.gavacyc.com/admin/requests/1');
      expect(mailOptions.html).toContain('Ver Requerimiento');
    });
  });
});
