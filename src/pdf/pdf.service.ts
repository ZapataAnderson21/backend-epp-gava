import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PdfPrinter from 'pdfmake/src/printer';
import type {
  Content,
  CustomTableLayout,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import { PrismaService } from 'src/prisma/prisma.service';
import { logo, logoPO, sgs, iso9001, hodelpe } from './images';
import {
  credit_cardIcon,
  locationIcon,
  mailIcon,
  phoneIcon,
  webIcon,
} from './icons';
import { ConfigService } from '@nestjs/config';
import { RequestStatus, RequestType } from 'src/request/enum';
import {
  PaymentMethodLabelEs,
  PurchaseOrderTypeLabelEs,
} from 'src/purchase-order/enum';
import { CurrencyLabelEs } from 'src/supplier/enum/currency.enum';

@Injectable()
export class PdfService {
  private readonly logger = new Logger('PdfService');

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async generatePurchaseOrderPdf(purchaseOrderId: number) {
    // === 1) Obtener la OC con todos los datos necesarios ===
    const purchaseOrder = await this.prismaService.purchaseOrder.findUnique({
      where: { purchaseOrderId },
      include: {
        project: true,
        supplier: true,
        resources: {
          include: {
            resource: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      this.logger.error('Purchase Order not found');
      throw new NotFoundException('Purchase Order not found');
    }

    // === 2) Helpers locales ===
    const getCurrencySymbol = (currency?: string) => {
      if (!currency) return 'S/.';
      const c = currency.toUpperCase();
      return c === 'SOLES' || c === 'PEN' ? 'S/.' : '$';
    };
    const sanitizeFileName = (value: string) => {
      // Replace reserved characters and collapse whitespace
      return value
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
    };
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    const fmtUnit = (n: number) =>
      new Intl.NumberFormat('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    const roundMoney = (value: number) =>
      Math.round((value + Number.EPSILON) * 100) / 100;
    const lineAmount = (quantity: unknown, unitPrice: unknown) =>
      roundMoney((Number(quantity) || 0) * (Number(unitPrice) || 0));
    const formatDate = (d: Date | string | number) => {
      const date = new Date(d);
      const dd = date.getDate().toString().padStart(2, '0');
      const mm = (date.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const currencySym = getCurrencySymbol(purchaseOrder.supplier?.currency);
    const nowStr = formatDate(new Date());

    const igvRate = 0.18;

    const orderedResources = [...(purchaseOrder.resources || [])].sort(
      (a, b) => {
        const aOrder = a.orderNumber ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.orderNumber ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (
          (a.resourcePurchaseOrderId ?? 0) - (b.resourcePurchaseOrderId ?? 0)
        );
      },
    );

    // Calculos base (sin IGV). Deben coincidir con la suma visible
    // de los parciales redondeados a 2 decimales.
    const subtotalVenta = roundMoney(
      orderedResources.reduce(
        (acc, it) => acc + lineAmount(it.quantity, it.unitPurchasePrice),
        0,
      ),
    );

    const igv = roundMoney(subtotalVenta * igvRate);
    const total = roundMoney(subtotalVenta + igv);

    const borderColor = '#cbd5e1';

    // === 3) Fuentes y logos ===
    const fonts = {
      Roboto: {
        normal: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Regular.ttf'),
        bold: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Bold.ttf'),
        italics: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Italic.ttf'),
        bolditalics: path.join(
          process.cwd(),
          'src/pdf/fonts/Roboto-BoldItalic.ttf',
        ),
      },
    };
    const printer = new PdfPrinter(fonts);

    // === 4) Construcción del contenido ===
    const headingBlue = '#14519d';

    const HEADER_HEIGHT = 80;
    const CERT_SIZE = 50;
    const CERT_GAP = 10;
    const CERT_MARGIN_TOP = Math.max(0, (HEADER_HEIGHT - CERT_SIZE) / 2);

    const headerBlock = [
      {
        table: {
          widths: [300, '*'],
          body: [
            [
              // celda izquierda: logo principal
              {
                image: logoPO,
                fit: [300, HEADER_HEIGHT],
                alignment: 'left',
                margin: [0, 0, 10, 0],
              },

              // celda derecha: certificaciones centradas verticalmente
              {
                margin: [0, CERT_MARGIN_TOP, 0, 0],
                columns: [
                  { width: '*', text: '' },
                  {
                    image: iso9001,
                    fit: [CERT_SIZE, CERT_SIZE],
                    width: 'auto',
                  },
                  {
                    image: sgs,
                    fit: [CERT_SIZE, CERT_SIZE],
                    width: 'auto',
                    margin: [CERT_GAP, 0, 0, 0],
                  },
                  {
                    image: hodelpe,
                    fit: [CERT_SIZE, CERT_SIZE],
                    width: 'auto',
                    margin: [CERT_GAP, 0, 0, 0],
                  },
                ],
                columnGap: 0,
              },
            ],
          ],
        },
        layout: { defaultBorder: false },
      },
      {
        text: (purchaseOrder.project?.name || '').toUpperCase(),
        style: 'titleProject',
        margin: [0, 6, 0, 0],
      },
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: `ORDEN DE COMPRA ${purchaseOrder.code?.toUpperCase() || ''}`,
                style: 'ocTitle',
                color: 'white',
                alignment: 'center',
                margin: [4, 5, 4, 5],
              },
            ],
          ],
        },
        layout: {
          fillColor: () => '#14519d',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 0,
          paddingRight: () => 0,
        },
        margin: [0, 6, 0, 0],
      },
      {
        text: [{ text: 'Fecha: ', bold: true }, nowStr],
        alignment: 'right',
        margin: [0, 4, 0, 0],
      },
    ];

    const infoHeaderCell = (text: string) => ({
      text,
      style: 'sectionHeader',
      color: 'white',
      fillColor: headingBlue,
      border: [false, false, false, false],
    });

    const infoBodyCell = (stack: Content[]) => ({
      stack,
      border: [true, false, true, true],
      margin: [4, 4, 4, 4],
    });

    const infoGapCell = () => ({
      text: '',
      border: [false, false, false, false],
    });

    // Una sola tabla mantiene los tres bloques con exactamente la misma altura,
    // incluso cuando algún dato se divide en más de una línea.
    const purchaseOrderInfoTable = {
      table: {
        widths: ['*', 8, '*', 8, '*'],
        body: [
          [
            infoHeaderCell('DATOS DEL PROVEEDOR'),
            infoGapCell(),
            infoHeaderCell('DATOS DE ENTREGA O ENVÍO'),
            infoGapCell(),
            infoHeaderCell('CONDICIONES DE PAGO'),
          ],
          [
            infoBodyCell([
              {
                text: [
                  { text: 'Proveedor: ', bold: true },
                  purchaseOrder.supplier?.name || '',
                ],
                lineHeight: 1.75,
              },
              {
                text: [
                  { text: 'RUC: ', bold: true },
                  purchaseOrder.supplier?.ruc || '',
                ],
                lineHeight: 1.75,
              },
              {
                text: [
                  { text: 'Contacto: ', bold: true },
                  purchaseOrder.supplier?.contactName || '',
                ],
                lineHeight: 1.75,
              },
              {
                text: [
                  { text: 'Correo: ', bold: true },
                  purchaseOrder.supplier?.email || '',
                ],
                lineHeight: 1.75,
              },
              {
                text: [
                  { text: 'Teléfono: ', bold: true },
                  purchaseOrder.supplier?.phone || '',
                ],
                lineHeight: 1.75,
              },
              {
                text: [
                  { text: 'Cotización: ', bold: true },
                  purchaseOrder.quotation || '',
                ],
                lineHeight: 1.75,
              },
            ]),
            infoGapCell(),
            infoBodyCell([
              {
                text: [
                  { text: 'Lugar de entrega: ', bold: true },
                  purchaseOrder.deliveryLocation || '',
                ],
                lineHeight: 1.75,
              },
              {
                text: [
                  { text: 'Destino: ', bold: true },
                  purchaseOrder.destination || '',
                ],
                lineHeight: 1.75,
              },
              {
                text: [
                  { text: 'Atención: ', bold: true },
                  purchaseOrder.carePerson || '',
                ],
                lineHeight: 1.75,
              },
              {
                text: [
                  { text: 'DNI: ', bold: true },
                  purchaseOrder.dniCarePerson || '',
                ],
                lineHeight: 1.75,
              },
              {
                text: [
                  { text: 'Observación: ', bold: true },
                  purchaseOrder.observations || '',
                ],
                lineHeight: 1.75,
              },
            ]),
            infoGapCell(),
            infoBodyCell([
              {
                text: [
                  { text: 'Crédito: ', bold: true },
                  purchaseOrder.paymentConditions || '',
                ],
                lineHeight: 1.75,
              },
              {
                text: [
                  { text: 'Método de pago: ', bold: true },
                  PaymentMethodLabelEs[purchaseOrder.paymentMethod] || '',
                ],
                lineHeight: 1.75,
              },
              {
                text: [
                  { text: 'Cta. cte: ', bold: true },
                  `${purchaseOrder.supplier?.bank || ''} (${CurrencyLabelEs[purchaseOrder.supplier?.currency] || ''}) - ${purchaseOrder.supplier?.accountNumber || ''}`,
                ],
                lineHeight: 1.75,
              },
            ]),
          ],
        ],
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => borderColor,
        vLineColor: () => borderColor,
        paddingLeft: (columnIndex: number) =>
          columnIndex === 1 || columnIndex === 3 ? 0 : 8,
        paddingRight: (columnIndex: number) =>
          columnIndex === 1 || columnIndex === 3 ? 0 : 8,
        paddingTop: (rowIndex: number) => (rowIndex === 0 ? 8 : 6),
        paddingBottom: (rowIndex: number) => (rowIndex === 0 ? 8 : 6),
      },
      margin: [0, 10, 0, 0],
    };

    // Texto introductorio antes de la tabla
    const introRecursos = [
      {
        text: [
          { text: 'Señores: ', bold: true },
          purchaseOrder.supplier?.name || '',
        ],
        margin: [0, 6, 0, 2],
      },
      {
        text: `Sírvase a suministrarnos los ${PurchaseOrderTypeLabelEs[purchaseOrder.purchaseOrderType].toLowerCase() || ''} solicitados siguientes:`,
        margin: [0, 0, 0, 4],
      },
    ];

    // Tabla de recursos (V UNIT y V PARC sin IGV)
    const recursosHeader = [
      { text: 'ID', bold: true, color: 'white' },
      { text: 'DESCRIPCIÓN', bold: true, color: 'white' },
      { text: 'UND', bold: true, color: 'white' },
      { text: 'CANT', bold: true, color: 'white' },
      { text: 'V UNIT', bold: true, color: 'white' },
      { text: 'V PARC', bold: true, color: 'white' },
    ];

    const recursosRows = orderedResources.map((item, idx) => {
      const unit = Number(item.unitPurchasePrice || 0);
      const qty = Number(item.quantity || 0);
      const parc = lineAmount(qty, unit);

      return [
        { text: String(idx + 1) },
        { text: item.resource?.description || '' },
        { text: item.resource?.unit || '' },
        { text: String(qty) },
        { text: `${currencySym} ${fmtUnit(unit)}` },
        { text: `${currencySym} ${fmt(parc)}`, fillColor: '#f3f4f6' },
      ];
    });

    const recursosTable = [
      {
        table: {
          headerRows: 1,
          widths: [30, '*', 45, 45, 70, 70],
          body: [recursosHeader, ...recursosRows],
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? headingBlue : null,
          hLineColor: () => '#9ca3af',
          vLineColor: () => '#9ca3af',
        },
      },
    ];

    // Totales
    const boxedLayout: CustomTableLayout = {
      hLineWidth: (i, node) =>
        i === 0 || i === node.table.body.length ? 1 : 0,
      vLineWidth: (i, node) =>
        i === 0 || i === (node.table.widths?.length ?? 0) ? 1 : 0,
      hLineColor: () => '#9ca3af',
      vLineColor: () => '#9ca3af',
    };

    const totalesTable = [
      {
        table: {
          widths: ['*', 80],
          body: [
            [
              {
                text: 'SUBTOTAL',
                alignment: 'right',
                bold: true,
                margin: [0, 4, 8, 4],
              },
              {
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        text: `${currencySym} ${fmt(subtotalVenta)}`,
                        alignment: 'right',
                        margin: [6, 4, 6, 4],
                      },
                    ],
                  ],
                },
                layout: boxedLayout,
              },
            ],
            [
              {
                text: 'IGV',
                alignment: 'right',
                bold: true,
                margin: [0, 4, 8, 4],
              },
              {
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        text: `${currencySym} ${fmt(igv)}`,
                        alignment: 'right',
                        margin: [6, 4, 6, 4],
                      },
                    ],
                  ],
                },
                layout: boxedLayout,
              },
            ],
            [
              {
                text: 'TOTAL',
                alignment: 'right',
                bold: true,
                margin: [0, 4, 8, 4],
              },
              {
                table: {
                  widths: ['*'],
                  body: [
                    [
                      {
                        text: `${currencySym} ${fmt(total)}`,
                        alignment: 'right',
                        margin: [6, 4, 6, 4],
                        fillColor: '#1f2937',
                        color: 'white',
                      },
                    ],
                  ],
                },
                layout: {
                  ...boxedLayout,
                  hLineColor: () => '#1f2937',
                  vLineColor: () => '#1f2937',
                },
              },
            ],
          ],
        },
        // Sin bordes ni padding en la tabla exterior
        layout: {
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
          hLineWidth: () => 0,
          vLineWidth: () => 0,
        },
        margin: [0, 4, 0, 0],
      },
    ];

    // Firmas
    const firmasTable = [
      {
        table: {
          widths: ['*', '*', '*'],
          body: [
            [
              {
                text: 'Elaboración',
                alignment: 'center',
                bold: true,
                color: 'white',
              },
              {
                text: 'Autorización',
                alignment: 'center',
                bold: true,
                color: 'white',
              },
              {
                text: 'Seguimiento y Control',
                alignment: 'center',
                bold: true,
                color: 'white',
              },
            ],
            [
              {
                text: 'Angi Gonzales Cotrina',
                alignment: 'center',
                margin: [0, 4, 0, 4],
              },
              {
                text: 'Henrry Gayoso Valdera',
                alignment: 'center',
                margin: [0, 4, 0, 4],
              },
              {
                text: 'Angi Gonzales Cotrina',
                alignment: 'center',
                margin: [0, 4, 0, 4],
              },
            ],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? headingBlue : null,
          hLineColor: () => '#9ca3af',
          vLineColor: () => '#9ca3af',
        },
        margin: [0, 8, 0, 0],
      },
    ];

    // Listas de condiciones
    const generalConditions = (purchaseOrder.generalConditions || '')
      .split('|')
      .map((s) => s?.trim())
      .filter(Boolean);
    const qualityConditions = (purchaseOrder.qualityConditions || '')
      .split('|')
      .map((s) => s?.trim())
      .filter(Boolean);

    const condicionesBlock: Content[] = [];
    if (generalConditions.length > 0) {
      condicionesBlock.push(
        {
          text: 'CONDICIONES COMERCIALES',
          style: 'listTitle',
          margin: [0, 8, 0, 3],
          fontSize: 8,
        },
        { ol: generalConditions, margin: [0, 0, 0, 4] },
      );
    }
    if (qualityConditions.length > 0) {
      condicionesBlock.push(
        {
          text: 'CONDICIONES DE CALIDAD',
          style: 'listTitle',
          margin: [0, 4, 0, 3],
          fontSize: 8,
        },
        { ol: qualityConditions },
      );
    }

    // === 5) Definición del documento ===

    // Calcular factor de escala dinámico basado en cantidad de recursos
    const itemCount = purchaseOrder.resources?.length || 0;
    let scaleFactor = 1;

    // Si hay muchos recursos, reducir el tamaño proporcionalmente
    if (itemCount > 10) {
      scaleFactor = 0.85;
    } else if (itemCount > 15) {
      scaleFactor = 0.75;
    } else if (itemCount > 20) {
      scaleFactor = 0.65;
    }

    const baseFontSize = 8 * scaleFactor;
    const titleProjectSize = 11 * scaleFactor;
    const ocTitleSize = 14 * scaleFactor;
    const sectionHeaderSize = 10 * scaleFactor;
    const listTitleSize = 9 * scaleFactor;

    const docDefinition = {
      pageSize: 'LETTER',
      pageMargins: [30, 30, 30, 30],
      compress: true,
      content: [
        ...headerBlock,
        purchaseOrderInfoTable,
        ...introRecursos,
        ...recursosTable,
        ...totalesTable,
        ...firmasTable,
        ...condicionesBlock,
      ],
      styles: {
        titleProject: {
          fontSize: titleProjectSize,
          bold: true,
          alignment: 'center',
        },
        ocTitle: { fontSize: ocTitleSize, bold: true },
        sectionHeader: { fontSize: sectionHeaderSize, bold: true },
        listTitle: { fontSize: listTitleSize, bold: true },
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: baseFontSize,
      },
    };

    // === 6) Crear archivo ===
    try {
      const outputDir =
        this.configService.get<string>('PDF_OUTPUT_DIR') ||
        path.resolve(__dirname, '..', '..', 'output');
      if (!fs.existsSync(outputDir))
        fs.mkdirSync(outputDir, { recursive: true });

      const rawCode = purchaseOrder.code || '';
      const safeCode = sanitizeFileName(rawCode) || 'SIN-CODIGO';
      const fileName = `OC-${safeCode}.pdf`;
      const outputPath = path.resolve(outputDir, fileName);

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const stream = fs.createWriteStream(outputPath);
      pdfDoc.pipe(stream);
      pdfDoc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      return { outputPath, fileName }; // ✅ ahora sí, el archivo está completo
    } catch (error) {
      this.logger.error('Error generating PDF:', error);
      throw new InternalServerErrorException('Error generating PDF');
    }
  }

  async generateQuotationPdf(quotationId: number) {
    const quotation = await this.prismaService.quotation.findUnique({
      where: { quotationId },
      include: {
        client: true,
        items: {
          orderBy: [{ orderNumber: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!quotation) {
      this.logger.error('Quotation not found');
      throw new NotFoundException('Quotation not found');
    }

    const sanitizeFileName = (value: string) => {
      return value
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
    };
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-PE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(n);
    const formatDate = (d: Date | string | number) => {
      const date = new Date(d);
      const dd = date.getDate().toString().padStart(2, '0');
      const mm = (date.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const company = {
      ruc: '20480347138',
      bank: 'BBVA',
      accountNumber: '0011-0216-0100000630',
      interbankAccount: '0112160001000000630 92',
      detractionAccount: '230-003181',
      phone: '978 994 903 / 950 528 865',
      web: 'www.gavacyelectricidad.com',
      email: 'logistica@gavacyc.com, admin@gavacyc.com',
      address1: 'Calle Vicente de la Vega No 1488 - 5to piso, Chiclayo',
      address2:
        'Mz C Dpto 206 Torre 4 Condominio Garden 360. Urb Las Palmeras del Chipre, Piura.',
    };

    const issuedAtStr = formatDate(quotation.createdAt || new Date());
    const headingRed = '#b00000';

    const fonts = {
      Roboto: {
        normal: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Regular.ttf'),
        bold: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Bold.ttf'),
        italics: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Italic.ttf'),
        bolditalics: path.join(
          process.cwd(),
          'src/pdf/fonts/Roboto-BoldItalic.ttf',
        ),
      },
    };
    const printer = new PdfPrinter(fonts);

    const HEADER_HEIGHT = 80;
    const CERT_SIZE = 50;
    const CERT_GAP = 10;
    const CERT_MARGIN_TOP = Math.max(0, (HEADER_HEIGHT - CERT_SIZE) / 2);

    const headerBlock = [
      {
        table: {
          widths: [300, '*'],
          body: [
            [
              {
                image: logo,
                fit: [300, HEADER_HEIGHT],
                alignment: 'left',
                margin: [0, 0, 10, 0],
              },
              {
                margin: [0, CERT_MARGIN_TOP, 0, 0],
                columns: [
                  { width: '*', text: '' },
                  {
                    image: iso9001,
                    fit: [CERT_SIZE, CERT_SIZE],
                    width: 'auto',
                  },
                  {
                    image: hodelpe,
                    fit: [CERT_SIZE, CERT_SIZE],
                    width: 'auto',
                    margin: [CERT_GAP, 0, 0, 0],
                  },
                  {
                    image: sgs,
                    fit: [CERT_SIZE, CERT_SIZE],
                    width: 'auto',
                    margin: [CERT_GAP, 0, 0, 0],
                  },
                ],
                columnGap: 0,
              },
            ],
          ],
        },
        layout: { defaultBorder: false },
      },
      {
        columns: [
          {
            width: '60%',
            text: [{ text: 'RUC: ', bold: true }, company.ruc],
            margin: [0, 2, 0, 0],
          },
          { width: '40%', text: '' },
        ],
      },
      {
        text: '“Seguridad y Calidad a su Servicio”',
        fontSize: 14,
        alignment: 'center',
        italics: true,
        bold: true,
        color: '#1f4b99',
        margin: [0, 4, 0, 10],
      },
      {
        text: 'COTIZACIÓN',
        alignment: 'center',
        fontSize: 18,
        bold: true,
        color: headingRed,
        margin: [0, 2, 0, 4],
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 1,
            lineColor: headingRed,
          },
        ],
        margin: [0, 0, 0, 8],
      },
      {
        text: quotation.code || '',
        alignment: 'center',
        bold: true,
        color: headingRed,
        fontSize: 12,
        margin: [0, 0, 0, 10],
      },
      {
        text: [{ text: 'Fecha: ', bold: true }, issuedAtStr],
        alignment: 'right',
        margin: [0, 0, 0, 8],
      },
    ];

    const preTableInfoBlock = {
      columns: [
        {
          width: '50%',
          stack: [
            {
              text: [
                { text: 'Servicio: ', bold: true },
                quotation.serviceDescription || '',
              ],
              margin: [0, 0, 0, 10],
            },
            {
              text: [
                { text: 'Nombre del Cliente: ', bold: true },
                quotation.client?.name || '',
              ],
            },
          ],
        },
        {
          width: '50%',
          stack: [
            {
              text: [
                { text: 'RUC: ', bold: true },
                quotation.client?.ruc || '',
              ],
              margin: [0, 0, 0, 10],
            },
            {
              text: [
                { text: 'Atención: ', bold: true },
                quotation.client?.contactName || '',
              ],
            },
          ],
        },
      ],
      columnGap: 16,
      margin: [0, 12, 0, 12],
    };

    const itemsHeader = [
      { text: 'Ítem', bold: true, color: 'white' },
      { text: 'Descripción', bold: true, color: 'white' },
      { text: 'Unidad', bold: true, color: 'white' },
      { text: 'Cantidad', bold: true, color: 'white' },
      { text: 'V Venta Unit S/', bold: true, color: 'white' },
      { text: 'V Venta Parc S/', bold: true, color: 'white' },
    ];

    const itemsRows = (quotation.items || []).map((item, idx) => [
      String(idx + 1),
      item.description || '',
      item.unit || '',
      fmt(Number(item.quantity || 0)),
      fmt(Number(item.unitPrice || 0)),
      fmt(Number(item.lineTotal || 0)),
    ]);

    const itemsTable = {
      table: {
        headerRows: 1,
        widths: [30, '*', 50, 60, 75, 75],
        body: [itemsHeader, ...itemsRows],
      },
      layout: {
        fillColor: (rowIndex: number) => (rowIndex === 0 ? headingRed : null),
        vLineWidth: () => 0,
        hLineWidth: (i: number) => (i === 0 ? 0 : 1),
        hLineColor: (i: number) => (i === 0 ? 'transparent' : '#B5B5B5'),
      },
      margin: [0, 0, 0, 6],
    };

    const totalsTable = {
      columns: [
        { width: '*', text: '' },
        {
          width: 280,
          table: {
            widths: [190, 90],
            body: [
              [
                {
                  text: 'COSTO DIRECTO',
                  alignment: 'right',
                  bold: true,
                  margin: [0, 4, 8, 4],
                },
                {
                  text: fmt(Number(quotation.costDirectAmount || 0)),
                  alignment: 'right',
                  margin: [6, 4, 6, 4],
                },
              ],
              [
                {
                  text: 'IGV (18%)',
                  alignment: 'right',
                  bold: true,
                  margin: [0, 4, 8, 4],
                },
                {
                  text: fmt(Number(quotation.igvAmount || 0)),
                  alignment: 'right',
                  margin: [6, 4, 6, 4],
                },
              ],
              [
                {
                  text: 'TOTAL (S/)',
                  alignment: 'right',
                  bold: true,
                  color: headingRed,
                  margin: [0, 4, 8, 4],
                },
                {
                  text: fmt(Number(quotation.totalAmount || 0)),
                  alignment: 'right',
                  color: headingRed,
                  bold: true,
                  margin: [6, 4, 6, 4],
                },
              ],
            ],
          },
          layout: {
            hLineWidth: (i: number) => (i === 2 ? 1 : 0),
            hLineColor: (i: number) => (i === 2 ? headingRed : 'transparent'),
            vLineWidth: () => 0,
          },
        },
      ],
      margin: [0, 0, 0, 8],
    };

    const conditions = (quotation.commercialTerms || '')
      .split('|')
      .map((s) => s?.trim())
      .filter(Boolean);

    const conditionsBlock =
      conditions.length > 0
        ? [
            {
              text: 'Condiciones Comerciales:',
              bold: true,
              margin: [0, 8, 0, 4],
            },
            { ol: conditions, margin: [0, 0, 0, 8] },
          ]
        : [];

    const iconLine = (icon: string, text: string, marginBottom = 4) => ({
      table: {
        widths: [18, '*'],
        body: [
          [
            { image: icon, fit: [11, 11], margin: [0, 1, 0, 0] },
            { text, color: 'white' },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
      margin: [0, 0, 0, marginBottom],
    });

    const footerBlock = {
      table: {
        widths: ['55%', '45%'],
        body: [
          [
            {
              stack: [
                {
                  text: 'INFORMACIÓN BANCARIA:',
                  bold: true,
                  color: 'white',
                  margin: [0, 0, 0, 6],
                },
                iconLine(
                  credit_cardIcon,
                  `N° Cuenta BBVA: ${company.accountNumber}`,
                ),
                iconLine(
                  credit_cardIcon,
                  `N° Cuenta Interbancaria: ${company.interbankAccount}`,
                ),
                iconLine(
                  credit_cardIcon,
                  `N° Cuenta de detracción B. NACIÓN: ${company.detractionAccount}`,
                  10,
                ),
                {
                  text: 'DIRECCIÓN:',
                  bold: true,
                  color: 'white',
                  margin: [0, 0, 0, 6],
                },
                iconLine(locationIcon, company.address1),
                iconLine(locationIcon, company.address2, 0),
              ],
            },
            {
              stack: [
                {
                  text: 'CONTACTO:',
                  bold: true,
                  color: 'white',
                  margin: [0, 0, 0, 6],
                },
                iconLine(phoneIcon, `Teléfono: ${company.phone}`),
                iconLine(webIcon, `Página web: ${company.web}`),
                iconLine(mailIcon, `Correo: ${company.email}`, 0),
              ],
            },
          ],
        ],
      },
      layout: {
        fillColor: () => headingRed,
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 12,
        paddingRight: () => 12,
        paddingTop: () => 10,
        paddingBottom: () => 10,
      },
      margin: [0, 0, 0, 0],
    };

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 30, 40, 170],
      compress: true,
      content: [
        ...headerBlock,
        preTableInfoBlock,
        itemsTable,
        totalsTable,
        ...conditionsBlock,
      ],
      footer: () => ({
        ...footerBlock,
        margin: [40, 0, 40, 20],
      }),
      defaultStyle: {
        font: 'Roboto',
        fontSize: 9,
      },
    };

    try {
      const outputDir =
        this.configService.get<string>('PDF_OUTPUT_DIR') ||
        path.resolve(__dirname, '..', '..', 'output');
      if (!fs.existsSync(outputDir))
        fs.mkdirSync(outputDir, { recursive: true });

      const rawCode = quotation.code || '';
      const safeCode = sanitizeFileName(rawCode) || 'SIN-CODIGO';
      const fileName = `COT-${safeCode}.pdf`;
      const outputPath = path.resolve(outputDir, fileName);

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const stream = fs.createWriteStream(outputPath);
      pdfDoc.pipe(stream);
      pdfDoc.end();

      await new Promise<void>((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
      });

      return { outputPath, fileName };
    } catch (error) {
      this.logger.error('Error generating PDF:', error);
      throw new InternalServerErrorException('Error generating PDF');
    }
  }

  async generateRequestPdf(requestId: number) {
    // 1) Traer la solicitud (con proyecto y usuario/cargo)
    const request = await this.prismaService.request.findUnique({
      where: { requestId },
      include: {
        project: true,
        user: {
          include: {
            userUserTypes: { include: { userType: true } },
          },
        },
      },
    });

    this.logger.log('Request with ID found.');

    if (!request) {
      this.logger.error('Request not found');
      throw new NotFoundException('Request not found');
    }

    // Solo impedir envío si NO está en draft (la generación del PDF sí la permitimos aquí)
    if (request.status !== RequestStatus.draft) {
      this.logger.error('Request status is not draft');
      throw new BadRequestException(
        'Only requests with status "draft" can be sent',
      );
    }

    const type = request.type;

    this.logger.log(`Request type: ${type}`);

    // 2) Traer elementos y trabajadores seleccionados
    const elementRequests = await this.prismaService.elementRequest.findMany({
      where: { requestId },
      include: {
        request: true,
        element: true,
        fallProtectionGroup: {
          include: {
            harnessElement: true,
            anchorBandElement: true,
            lifelineElement: true,
            positioningLanyardElement: true,
          },
        },
      },
      orderBy: { elementRequestId: 'asc' },
    });

    const requestWorkers = await this.prismaService.requestWorker.findMany({
      where: { requestId },
      include: { worker: true },
      orderBy: { requestWorkerId: 'asc' },
    });

    const fallProtectionElementIds = elementRequests
      .filter((line) => {
        const family = line.element?.family?.trim?.().toLowerCase?.();
        const elementType = line.element?.type?.trim?.().toLowerCase?.();
        const controlType = line.element?.controlType?.trim?.().toLowerCase?.();
        return (
          line.fallProtectionGroup ||
          line.fallProtectionGroupId ||
          family === 'harness' ||
          (elementType === RequestType.Operative &&
            controlType === 'individual')
        );
      })
      .map((line) => line.elementId);

    const legacyFallProtectionGroups =
      fallProtectionElementIds.length > 0
        ? await this.prismaService.fallProtectionGroup.findMany({
            where: {
              deletedAt: null,
              OR: [
                { harnessElementId: { in: fallProtectionElementIds } },
                { anchorBandElementId: { in: fallProtectionElementIds } },
                { lifelineElementId: { in: fallProtectionElementIds } },
                {
                  positioningLanyardElementId: { in: fallProtectionElementIds },
                },
              ],
            },
            include: {
              harnessElement: true,
              anchorBandElement: true,
              lifelineElement: true,
              positioningLanyardElement: true,
            },
          })
        : [];

    type RequestLine = (typeof elementRequests)[number];
    type LegacyFallProtectionGroup =
      (typeof legacyFallProtectionGroups)[number];
    const legacyFallProtectionGroupByElementId = new Map<
      number,
      LegacyFallProtectionGroup
    >();
    legacyFallProtectionGroups.forEach((group) => {
      [
        group.harnessElementId,
        group.anchorBandElementId,
        group.lifelineElementId,
        group.positioningLanyardElementId,
      ].forEach((elementId) => {
        if (!legacyFallProtectionGroupByElementId.has(elementId)) {
          legacyFallProtectionGroupByElementId.set(elementId, group);
        }
      });
    });

    this.logger.log('Element Requests:', elementRequests);
    this.logger.log('Request Workers:', requestWorkers);

    // Permitir cualquiera de los dos; solo rechazar si no hay ninguno
    if (
      (elementRequests?.length ?? 0) === 0 &&
      (requestWorkers?.length ?? 0) === 0
    ) {
      throw new NotFoundException(
        'No se encontraron Element Requests ni Request Workers.',
      );
    }

    // 3) Datos para cabecera
    const sender = `${request.user.name} ${request.user.lastName}`;
    const jobTitle = request.user.userUserTypes?.[0]?.userType?.name ?? '—';
    const to2 = (n: number) => n.toString().padStart(2, '0');

    const createdAt = new Date(request.createdAt);
    const dateCreatedAt = `${to2(createdAt.getDate())}/${to2(createdAt.getMonth() + 1)}/${createdAt.getFullYear()} ${to2(createdAt.getHours())}:${to2(createdAt.getMinutes())}`;

    const deliveryDueDate = new Date(request.deliveryDueDate);
    const formattedDeliveryDueDate = `${to2(deliveryDueDate.getDate())}/${to2(deliveryDueDate.getMonth() + 1)}/${deliveryDueDate.getFullYear()} ${to2(deliveryDueDate.getHours())}:${to2(deliveryDueDate.getMinutes())}`;

    const description = request.description || 'Sin descripción.';
    const projectName = request.project.name;

    type RequestLineFamily =
      | 'epp'
      | 'epi'
      | 'uniform'
      | 'ese'
      | 'harness'
      | 'officematerial'
      | 'ssomasupply';

    const resolveLineFamily = (line: RequestLine): RequestLineFamily => {
      if (
        line.fallProtectionGroup ||
        line.fallProtectionGroupId ||
        legacyFallProtectionGroupByElementId.has(line.elementId)
      ) {
        return 'harness';
      }

      const family = line.element?.family?.trim?.().toLowerCase?.();
      switch (family) {
        case 'epp':
        case 'epi':
        case 'uniform':
        case 'ese':
        case 'harness':
        case 'officematerial':
        case 'ssomasupply':
          return family;
      }

      const elementType = line.element?.type?.trim?.().toLowerCase?.();
      const controlType = line.element?.controlType?.trim?.().toLowerCase?.();

      if (elementType === RequestType.Operative) {
        return controlType === 'individual' ? 'harness' : 'ese';
      }

      if (controlType === 'consumable') return 'uniform';
      if (controlType === 'individual') return 'epi';
      return 'epp';
    };

    const formatElementNameWithCode = (
      element?: RequestLine['element'] | null,
    ) => {
      if (!element) return 'Pendiente';
      return element.code ? `${element.name} - ${element.code}` : element.name;
    };

    const getLineFallProtectionGroup = (line: RequestLine) =>
      line.fallProtectionGroup ??
      legacyFallProtectionGroupByElementId.get(line.elementId) ??
      null;

    const getLineDescription = (line: RequestLine) => {
      const fallProtectionGroup = getLineFallProtectionGroup(line);
      if (fallProtectionGroup) {
        return fallProtectionGroup.code;
      }

      if (resolveLineFamily(line) === 'ese') {
        return line.element?.name ?? `Elemento ${line.elementId}`;
      }

      return line.element?.code
        ? `${line.element.name} - ${line.element.code}`
        : (line.element?.name ?? `Elemento ${line.elementId}`);
    };

    const getFallProtectionParts = (line: RequestLine) => {
      const group = getLineFallProtectionGroup(line);
      if (!group) return null;

      return [
        `Arnes: ${formatElementNameWithCode(group.harnessElement)}`,
        `Banda de anclaje: ${formatElementNameWithCode(group.anchorBandElement)}`,
        `Linea de vida: ${formatElementNameWithCode(group.lifelineElement)}`,
        `Eslinga de posicionamiento: ${formatElementNameWithCode(group.positioningLanyardElement)}`,
      ].join('\n');
    };

    const buildRequestTableRows = (lines: RequestLine[]): TableCell[][] =>
      lines.map((line, idx) => {
        const parts = getFallProtectionParts(line);
        const descriptionCell = parts
          ? {
              stack: [
                { text: getLineDescription(line), bold: true },
                { text: parts, fontSize: 8, color: '#4b5563' },
              ],
            }
          : getLineDescription(line);

        return [
          idx + 1,
          descriptionCell,
          line.unit,
          line.quantityRequested.toString(),
        ];
      });

    // 4) Título y footer por tipo
    let title = '',
      footer = '';
    switch (type) {
      case RequestType.Operative:
        title = 'SOLICITUD DE REQUERIMIENTO DE ELEMENTOS OPERATIVOS';
        footer =
          'Agradecemos de antemano su atención a esta solicitud y quedamos atentos a su aprobación para proceder con las gestiones correspondientes.';
        break;
      case RequestType.Epp:
        title =
          'SOLICITUD DE REQUERIMIENTO DE ELEMENTOS DE PROTECCIÓN PERSONAL (EPP)';
        footer =
          'Agradecemos de antemano su atención a esta solicitud. Quedamos atentos a su aprobación y a la gestión correspondiente para la adquisición de los EPP requeridos.';
        break;
      case RequestType.EppAndOperative:
        title = 'SOLICITUD DE REQUERIMIENTO DE EPP Y ELEMENTOS OPERATIVOS';
        footer =
          'Agradecemos su atención a esta solicitud y quedamos atentos a su aprobación para proceder con las gestiones necesarias.';
        break;
    }

    // 5) PDFMake: fuentes y printer
    const fonts = {
      Roboto: {
        normal: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Regular.ttf'),
        bold: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Bold.ttf'),
        italics: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Italic.ttf'),
        bolditalics: path.join(
          process.cwd(),
          'src/pdf/fonts/Roboto-BoldItalic.ttf',
        ),
      },
    };
    const printer = new PdfPrinter(fonts);

    // 6) Contenido base
    const docContent: Content[] = [
      {
        columns: [
          { width: '*', text: '' },
          { width: 100, image: logo, fit: [100, 100], alignment: 'right' },
        ],
      },
      { text: title, style: 'header', margin: [0, 10, 0, 20] },
      { text: [{ text: 'De: ', bold: true }, { text: `Ing. ${sender}` }] },
      {
        text: [{ text: `${jobTitle} – GAVA C&C`, bold: true }],
        margin: [0, 0, 0, 10],
      },
      {
        text: [{ text: 'Para: ', bold: true }, { text: 'Equipo de Logística' }],
      },
      {
        text: [{ text: 'Proyecto: ', bold: true }, { text: projectName }],
        margin: [0, 0, 0, 10],
      },
      {
        text: [
          { text: 'Fecha y Hora de Solicitud: ', bold: true },
          { text: dateCreatedAt },
        ],
      },
      {
        text: [
          { text: 'Fecha y Hora de Entrega: ', bold: true },
          { text: formattedDeliveryDueDate },
        ],
        margin: [0, 0, 0, 10],
      },
    ];

    const addRequestSection = (sectionTitle: string, lines: RequestLine[]) => {
      if (lines.length === 0) return;

      docContent.push(
        {
          text: sectionTitle,
          style: 'subheader',
          margin: [0, 20, 0, 10],
        },
        {
          table: {
            widths: ['auto', '*', 'auto', 'auto'],
            body: [
              ['N° ITEM', 'DESCRIPCIÓN', 'UNIDAD', 'CANTIDAD'],
              ...buildRequestTableRows(lines),
            ],
          },
        },
      );
    };

    // 7) Tablas de ELEMENTOS (si hay)
    if ((elementRequests?.length ?? 0) > 0) {
      const protectionElements = elementRequests.filter((line) =>
        ['epp', 'epi', 'uniform'].includes(resolveLineFamily(line)),
      );
      const safetyElements = elementRequests.filter(
        (line) => resolveLineFamily(line) === 'ese',
      );
      const fallProtectionElements = elementRequests.filter(
        (line) => resolveLineFamily(line) === 'harness',
      );
      const officeMaterialElements = elementRequests.filter(
        (line) => resolveLineFamily(line) === 'officematerial',
      );
      const ssomaSupplyElements = elementRequests.filter(
        (line) => resolveLineFamily(line) === 'ssomasupply',
      );

      addRequestSection(
        'DETALLE DEL REQUERIMIENTO DE ELEMENTOS DE PROTECCION',
        protectionElements,
      );
      addRequestSection(
        'DETALLE DEL REQUERIMIENTO DE EQUIPOS DE SEGURIDAD Y EMERGENCIA',
        safetyElements,
      );
      addRequestSection(
        'DETALLE DEL REQUERIMIENTO DE EQUIPOS DE PROTECCION ANTICAIDA',
        fallProtectionElements,
      );
      addRequestSection(
        'DETALLE DEL REQUERIMIENTO DE MATERIALES DE OFICINA',
        officeMaterialElements,
      );
      addRequestSection(
        'DETALLE DEL REQUERIMIENTO DE INSUMOS SSOMA',
        ssomaSupplyElements,
      );
    }

    // 8) Tabla de TRABAJADORES (si hay)
    if ((requestWorkers?.length ?? 0) > 0) {
      docContent.push(
        {
          text: 'DETALLE DE PERSONAL Y TALLAS',
          style: 'subheader',
          margin: [0, 20, 0, 10],
        },
        {
          table: {
            widths: ['auto', '*', 'auto', 'auto', 'auto'],
            body: [
              ['N°', 'TRABAJADOR', 'ZAPATO', 'PANTALÓN', 'POLO'],
              ...requestWorkers.map((rw, idx) => [
                idx + 1, // índice 1..n
                rw.worker?.fullName ?? '—',
                (rw.shoeSize ?? '—').toString().toUpperCase(),
                (rw.pantsSize ?? '—').toString().toUpperCase(),
                (rw.shirtSize ?? '—').toString().toUpperCase(),
              ]),
            ],
          },
        },
      );
    }

    // 9) Descripción + cierre
    docContent.push(
      { text: 'Descripción:', style: 'subheader', margin: [0, 20, 0, 10] },
      { text: description, margin: [0, 10], alignment: 'justify' },
      { text: footer, margin: [0, 20], alignment: 'justify' },
      {
        text: [
          { text: 'Atentamente,\n\n', bold: true },
          { text: `Ing. ${sender}` },
        ],
        alignment: 'left',
        margin: [0, 10, 0, 0],
      },
    );

    const docDefinition: TDocumentDefinitions = {
      pageMargins: [60, 40, 60, 40],
      content: docContent,
      styles: {
        header: { fontSize: 14, bold: true, alignment: 'center' },
        subheader: { fontSize: 12, bold: true },
      },
      defaultStyle: { font: 'Roboto', fontSize: 10 },
    };

    // 10) Generar y guardar
    try {
      const outputDir =
        this.configService.get<string>('PDF_OUTPUT_DIR') ||
        path.resolve(__dirname, '..', '..', 'output');

      // Crear el directorio si no existe
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const fileName = `requerimiento-${requestId}.pdf`;
      const outputPath = path.resolve(outputDir, fileName);

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const stream = fs.createWriteStream(outputPath);

      pdfDoc.pipe(stream);
      pdfDoc.end();

      return new Promise<string>((resolve, reject) => {
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', (err) => reject(err));
      });
    } catch (error) {
      this.logger.error('Error generating PDF:', error);
      throw new InternalServerErrorException('Error generating PDF');
    }
  }
}
