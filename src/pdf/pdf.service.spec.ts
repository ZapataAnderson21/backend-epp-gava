import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Currency } from 'src/supplier/enum/currency.enum';
import {
  PurchaseOrderStatus,
  PurchaseOrderType,
} from 'src/purchase-order/enum';

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

  it('generates the filtered purchase order summary as a PDF buffer', async () => {
    const result = await service.generatePurchaseOrderSummaryPdf(
      {
        project: { projectId: 1, code: 'P-001', name: 'Proyecto Norte' },
        filters: {
          search: null,
          supplierId: 10,
          supplierName: 'Proveedor A',
          currency: Currency.PEN,
          status: null,
          purchaseOrderType: PurchaseOrderType.Materials,
        },
        totals: {
          totalOrders: 1,
          activeOrders: 1,
          cancelledOrders: 0,
          byCurrency: {
            PEN: { purchaseAmount: 1000, saleAmount: 1400, margin: 400 },
            USD: { purchaseAmount: 0, saleAmount: 0, margin: 0 },
            EUR: { purchaseAmount: 0, saleAmount: 0, margin: 0 },
          },
        },
        orders: [
          {
            purchaseOrderId: 1,
            code: 'No 001-2026/OC/PROV',
            supplierId: 10,
            supplierName: 'Proveedor A',
            purchaseOrderType: PurchaseOrderType.Materials,
            purchaseOrderTypeLabel: 'Materiales',
            currency: Currency.PEN,
            purchaseAmount: 1000,
            saleAmount: 1400,
            margin: 400,
            status: PurchaseOrderStatus.Authorized,
            statusLabel: 'Autorizada',
          },
        ],
      },
      'usuario@gava.test',
    );

    expect(result.fileName).toBe('resumen-ordenes-P-001.pdf');
    expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(result.buffer.length).toBeGreaterThan(1_000);
  });
});
