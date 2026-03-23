import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

describe('PdfService', () => {
  let service: PdfService;

  const mockPrismaService = {};
  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
