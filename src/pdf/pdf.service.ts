import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as PdfPrinter from 'pdfmake';
import { PrismaService } from 'src/prisma/prisma.service';
import { logoBase64 } from './logoBase64';
import { ConfigService } from '@nestjs/config';
import { RequestStatus, RequestType } from 'src/request/enum';
import { PurchaseOrderTypeLabelEs } from 'src/purchase-order/enum';
import { CurrencyLabelEs } from 'src/supplier/enum/currency.enum';

@Injectable()
export class PdfService {

  private readonly logger = new Logger("PdfService");

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
    const fmt = (n: number) =>
      new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    const formatDate = (d: Date | string | number) => {
      const date = new Date(d);
      const dd = date.getDate().toString().padStart(2, '0');
      const mm = (date.getMonth() + 1).toString().padStart(2, '0');
      const yyyy = date.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    const currencySym = getCurrencySymbol(purchaseOrder.supplier?.currency);
    const nowStr = formatDate(new Date());

    // Cálculos SOLO con precios de venta
    const subtotalVenta = purchaseOrder.resources?.reduce((acc, it) => {
      const unit = Number(it.unitSalesPrice || 0);
      const qty = Number(it.quantity || 0);
      return acc + unit * qty;
    }, 0) || 0;

    const igv = subtotalVenta * 0.18;
    const total = subtotalVenta + igv;

    const borderColor = '#cbd5e1';

    // === 3) Fuentes y logos ===
    const fonts = {
      Roboto: {
        normal: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Regular.ttf'),
        bold: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Bold.ttf'),
        italics: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Italic.ttf'),
        bolditalics: path.join(process.cwd(), 'src/pdf/fonts/Roboto-BoldItalic.ttf'),
      },
    };
    const printer = new PdfPrinter(fonts);

    // Si tienes estos logos en base64, impórtalos como hiciste con logoBase64.
    // Alternativa: leer archivo: { image: path.resolve('src/pdf/img/Logo-ISO9001.jpg') }
    const iso9001Base64 = '';   // TODO: pega tu base64 si lo tienes
    const sgsBase64 = '';       // TODO: pega tu base64 si lo tienes
    const hodelpeBase64 = '';   // TODO: pega tu base64 si lo tienes

    // === 4) Construcción del contenido ===
    const headingBlue = '#14519d';

    // Bloque: Encabezado con logos
    const headerBlock = [
      {
        columns: [
          // Logo principal
          {
            width: 'auto',
            image: logoBase64,
            fit: [260, 120], // similar a tu img grande
            alignment: 'left',
            margin: [0, 0, 10, 0],
          },
          // Certificaciones
          {
            width: '*',
            alignment: 'right',
            margin: [0, 0, 0, 0],
            columns: [
              {
                width: 'auto',
                stack: [
                  iso9001Base64
                    ? { image: iso9001Base64, fit: [80, 60], margin: [5, 0, 5, 5] }
                    : {},
                  sgsBase64
                    ? { image: sgsBase64, fit: [80, 60], margin: [5, 0, 5, 5] }
                    : {},
                  hodelpeBase64
                    ? { image: hodelpeBase64, fit: [80, 60], margin: [5, 0, 5, 5] }
                    : {},
                ].filter(Boolean),
              },
            ],
          },
        ],
      },
      { text: (purchaseOrder.project?.name || '').toUpperCase(), style: 'titleProject', margin: [0, 10, 0, 0] },
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
                margin: [6, 8, 6, 8],
              },
            ],
          ],
        },
        layout: {
          fillColor: () => headingBlue,
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 0,
          paddingRight: () => 0,
        },
        margin: [0, 10, 0, 0],
      },
      {
        text: [{ text: 'Fecha: ', bold: true }, nowStr],
        alignment: 'right',
        margin: [0, 6, 0, 0],
      },
    ];

    // Bloque: Datos del proveedor
    const proveedorBlock = [
      {
        table: {
          widths: ['*'],
          body: [[{ text: 'DATOS DEL PROVEEDOR', style: 'sectionHeader', color: 'white' }]],
        },
        layout: {
          fillColor: () => headingBlue,
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
        margin: [0, 14, 0, 0],
      },
      // ⬇️ CONTENIDO CON BORDE
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: [{ text: 'Proveedor: ', bold: true }, purchaseOrder.supplier?.name || '' ], lineHeight: 1.8 },
                  { text: [{ text: 'RUC: ', bold: true }, purchaseOrder.supplier?.ruc || '' ], lineHeight: 1.8 },
                  { text: [{ text: 'Contacto: ', bold: true }, purchaseOrder.supplier?.contactName || '' ], lineHeight: 1.8 },
                  { text: [{ text: 'Correo: ', bold: true }, purchaseOrder.supplier?.email || '' ], lineHeight: 1.8 },
                  { text: [{ text: 'Teléfono: ', bold: true }, purchaseOrder.supplier?.phone || '' ], lineHeight: 1.8 },
                  { text: [{ text: 'Cotización: ', bold: true }, purchaseOrder.quotation || '' ], lineHeight: 1.8 },
                ],
                margin: [6, 8, 6, 8],
              },
            ],
          ],
        },
        layout: {
          // borde “caja”: solo líneas exteriores
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0),
          vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 1 : 0),
          hLineColor: () => borderColor,
          vLineColor: () => borderColor,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 0,
        },
      },
    ];

    // Bloque: Datos de entrega/envío
    const envioBlock = [
      {
        table: {
          widths: ['*'],
          body: [[{ text: 'DATOS DE ENTREGA O ENVÍO', style: 'sectionHeader', color: 'white' }]],
        },
        layout: {
          fillColor: () => headingBlue,
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
        margin: [0, 14, 0, 0],
      },
      // ⬇️ CONTENIDO CON BORDE
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  { text: [{ text: 'Lugar de entrega: ', bold: true }, purchaseOrder.deliveryLocation || '' ], lineHeight: 1.8 },
                  { text: [{ text: 'Destino: ', bold: true }, purchaseOrder.destination || '' ], lineHeight: 1.8 },
                  { text: [{ text: 'Atención: ', bold: true }, purchaseOrder.carePerson || '' ], lineHeight: 1.8 },
                  { text: [{ text: 'DNI: ', bold: true }, purchaseOrder.dniCarePerson || '' ], lineHeight: 1.8 },
                  { text: [{ text: 'Observación: ', bold: true }, purchaseOrder.observations || '' ], lineHeight: 1.8 },
                ],
                margin: [6, 8, 6, 22],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0),
          vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 1 : 0),
          hLineColor: () => borderColor,
          vLineColor: () => borderColor,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },
    ];


    // Bloque: Condiciones de pago
    const pagoBlock = [
      {
        table: {
          widths: ['*'],
          body: [[{ text: 'CONDICIONES DE PAGO', style: 'sectionHeader', color: 'white' }]],
        },
        layout: {
          fillColor: () => headingBlue,
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
        margin: [0, 14, 0, 0],
      },
      // Condiciones (línea gruesa exterior)
      {
        table: {
          widths: ['*'],
          body: [[{ text: purchaseOrder.paymentConditions || '', bold: true, margin: [6, 6, 6, 6], lineHeight: 1.4 }]],
        },
        layout: {
          // borde caja EXCEPTO el borde inferior
          hLineWidth: (i, node) => {
            const isTop = i === 0;
            const isBottom = i === node.table.body.length;
            if (isTop) return 1;
            if (isBottom) return 0; // <- quitamos borde inferior
            return 0;
          },
          vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 1 : 0),
          hLineColor: () => borderColor,
          vLineColor: () => borderColor,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
      },
      // Método de pago + cta cte (mantener borde superior, quitar doblez)
      {
        table: {
          widths: ['*', '*'],
          body: [[
            { text: [{ text: 'Método de pago: ', bold: true }, purchaseOrder.paymentMethod || '' ], margin: [6, 6, 6, 6], lineHeight: 1.35 },
            { text: [{ text: 'Cta. cte: ', bold: true }, `${purchaseOrder.supplier?.bank || ''} (${CurrencyLabelEs[purchaseOrder.supplier?.currency] || ''}) - ${purchaseOrder.supplier?.accountNumber || ''}` ], margin: [6, 6, 6, 6], lineHeight: 1.35 },
          ]],
        },
        layout: {
          // borde caja completo; como arriba no pinta línea inferior, aquí el superior actúa como línea única
          hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0),
          vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 1 : 0),
          hLineColor: () => borderColor,
          vLineColor: () => borderColor,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
      },
    ];


    // Texto introductorio antes de la tabla
    const introRecursos = [
      {
        text: [
          { text: 'Señores: ', bold: true },
          purchaseOrder.supplier?.name || '',
        ],
        margin: [0, 12, 0, 4],
      },
      {
        text: `Sírvase a suministrarnos los ${PurchaseOrderTypeLabelEs[purchaseOrder.purchaseOrderType].toLowerCase() || ''} solicitados siguientes:`,
        margin: [0, 0, 0, 8],
      },
    ];

    // Tabla de recursos (SOLO precios de venta)
    const recursosHeader = [
      { text: 'ID', bold: true, color: 'white' },
      { text: 'DESCRIPCIÓN', bold: true, color: 'white' },
      { text: 'UND', bold: true, color: 'white' },
      { text: 'CANT', bold: true, color: 'white' },
      { text: 'PR UNIT', bold: true, color: 'white' },
      { text: 'PR PARC', bold: true, color: 'white' },
    ];

    const recursosRows = (purchaseOrder.resources || []).map((item, idx) => {
      const unit = Number(item.unitSalesPrice || 0);
      const qty = Number(item.quantity || 0);
      const parc = unit * qty;

      return [
        { text: String(idx + 1) },
        { text: item.resource?.description || '' },
        { text: item.resource?.unit || '' },
        { text: String(qty) },
        { text: `${currencySym} ${fmt(unit)}` },
        { text: `${currencySym} ${fmt(parc)}`, fillColor: '#f3f4f6' },
      ];
    });

    const recursosTable = [
      {
        table: {
          headerRows: 1,
          widths: [30, '*', 45, 45, 70, 70],
          body: [
            recursosHeader,
            ...recursosRows,
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? headingBlue : null),
          hLineColor: () => '#9ca3af',
          vLineColor: () => '#9ca3af',
        },
      },
    ];

    // Totales
    const boxedLayout = {
      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length ? 1 : 0),
      vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length ? 1 : 0),
      hLineColor: () => '#9ca3af',
      vLineColor: () => '#9ca3af',
    };

    const totalesTable = [
      {
        table: {
          widths: ['*', 80],
          body: [
            [
              { text: 'SUBTOTAL', alignment: 'right', bold: true, margin: [0, 4, 8, 4] },
              {
                table: { widths: ['*'], body: [[
                  { text: `${currencySym} ${fmt(subtotalVenta)}`, alignment: 'right', margin: [6, 4, 6, 4] }
                ]]},
                layout: boxedLayout
              },
            ],
            [
              { text: 'IGV', alignment: 'right', bold: true, margin: [0, 4, 8, 4] },
              {
                table: { widths: ['*'], body: [[
                  { text: `${currencySym} ${fmt(igv)}`, alignment: 'right', margin: [6, 4, 6, 4] }
                ]]},
                layout: boxedLayout
              },
            ],
            [
              { text: 'TOTAL', alignment: 'right', bold: true, margin: [0, 4, 8, 4] },
              {
                table: { widths: ['*'], body: [[
                  { text: `${currencySym} ${fmt(total)}`, alignment: 'right', margin: [6, 4, 6, 4], fillColor: '#1f2937', color: 'white' }
                ]]},
                layout: {
                  ...boxedLayout,
                  hLineColor: () => '#1f2937',
                  vLineColor: () => '#1f2937',
                }
              },
            ],
          ],
        },
        // Sin bordes ni padding en la tabla exterior
        layout: {
          ...((PdfPrinter as any) && {}), // noop, solo para claridad
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
          hLineWidth: () => 0,
          vLineWidth: () => 0,
        },
        margin: [0, 6, 0, 0],
      },
    ];

    // Firmas
    const firmasTable = [
      {
        table: {
          widths: ['*', '*', '*'],
          body: [
            [
              { text: 'Elaboración', alignment: 'center', bold: true, color: 'white' },
              { text: 'Autorización', alignment: 'center', bold: true, color: 'white' },
              { text: 'Seguimiento y Control', alignment: 'center', bold: true, color: 'white' },
            ],
            [
              { text: 'Angi Gonzales Cotrina', alignment: 'center', margin: [0, 6, 0, 6] },
              { text: 'Henrry Gayoso Valdera', alignment: 'center', margin: [0, 6, 0, 6] },
              { text: 'Morayma Lloja Fernandez', alignment: 'center', margin: [0, 6, 0, 6] },
            ],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? headingBlue : null),
          hLineColor: () => '#9ca3af',
          vLineColor: () => '#9ca3af',
        },
        margin: [0, 14, 0, 0],
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

    const condicionesBlock = [
      { text: 'CONDICIONES COMERCIALES', style: 'listTitle', margin: [0, 14, 0, 6] },
      {
        ol: generalConditions.length ? generalConditions : [{ text: '—', opacity: 0.6 }],
        margin: [0, 0, 0, 8],
      },
      { text: 'CONDICIONES DE CALIDAD', style: 'listTitle', margin: [0, 8, 0, 6] },
      {
        ol: qualityConditions.length ? qualityConditions : [{ text: '—', opacity: 0.6 }],
      },
    ];

    // === 5) Definición del documento ===
    const docDefinition: any = {
      pageMargins: [40, 40, 40, 40],
      content: [
        ...headerBlock,
        // Dos columnas para “Datos del proveedor” y “Datos de entrega”
        {
          columns: [
            { width: '50%', stack: proveedorBlock },
            { width: '50%', stack: envioBlock },
          ],
          columnGap: 14,
          margin: [0, 10, 0, 0],
        },
        ...pagoBlock,
        ...introRecursos,
        ...recursosTable,
        ...totalesTable,
        ...firmasTable,
        ...condicionesBlock,
      ],
      styles: {
        titleProject: { fontSize: 14, bold: true, alignment: 'center' },
        ocTitle: { fontSize: 18, bold: true },
        sectionHeader: { fontSize: 14, bold: true },
        listTitle: { fontSize: 12, bold: true },
      },
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
      },
    };

    // === 6) Crear archivo ===
    try {
      const outputDir = this.configService.get<string>('PDF_OUTPUT_DIR') || path.resolve(__dirname, '..', '..', 'output');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const fileName = `orden-compra-${purchaseOrderId}.pdf`;
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


  async generateRequestPdf(requestId: number) {

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

    this.logger.log("Request with ID fonund.");

    if (!request) {
      this.logger.error('Request not found');
      throw new NotFoundException('Request not found');
    }

    this.logger.log('Request found:', request);

    if (request.status !== RequestStatus.draft) {
      throw new BadRequestException('Only requests with status "draft" can be sent');
    }

    if(!request.type || !Object.values(RequestType).includes(request.type.toLowerCase() as RequestType)) {
      throw new BadRequestException('Invalid request type');
    }

    const type = request.type;

    const elementRequests = await this.prismaService.elementRequest.findMany({
      where: { requestId },
      include: {
        request: true,
        element: true 
      }
    });

    console.log("PDF-SERVICE:")
    console.log("Element Requests: " + elementRequests)

    if (!elementRequests || elementRequests.length === 0) {
      throw new NotFoundException('Element Requests not found');
    }

    console.log('Element Requests found:', elementRequests);

    const sender = `${request.user.name} ${request.user.lastName}`;
    const jobTitle = request.user.userUserTypes[0].userType.name;
    const dateObj = new Date(request.createdAt);
    const dateCreatedAt = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
    const deliveryDueDate = new Date(request.deliveryDueDate);
    const formattedDeliveryDueDate = `${deliveryDueDate.getDate().toString().padStart(2, '0')}/${(deliveryDueDate.getMonth() + 1).toString().padStart(2, '0')}/${deliveryDueDate.getFullYear()} ${deliveryDueDate.getHours().toString().padStart(2, '0')}:${deliveryDueDate.getMinutes().toString().padStart(2, '0')}`;
    const description = request.description || 'No description provided';
    const projectName = request.project.name;

    let title = '', footer = '';

    switch (type) {
      case RequestType.Operative:
        title = 'SOLICITUD DE REQUERIMIENTO DE ELEMENTOS OPERATIVOS';
        footer = `Agradecemos de antemano su atención a esta solicitud y quedamos atentos a su aprobación para proceder con las gestiones correspondientes.`;
        break;
      case RequestType.Epp:
        title = 'SOLICITUD DE REQUERIMIENTO DE ELEMENTOS DE PROTECCIÓN PERSONAL (EPP)';
        footer = `Agradecemos de antemano su atención a esta solicitud. Quedamos atentos a su aprobación y a la gestión correspondiente para la adquisición de los EPP requeridos.`;
        break;
      case RequestType.EppAndOperative:
        title = 'SOLICITUD DE REQUERIMIENTO DE EPP Y ELEMENTOS OPERATIVOS';
        footer = `Agradecemos su atención a esta solicitud y quedamos atentos a su aprobación para proceder con las gestiones necesarias.`;
        break;
    }

    const fonts = {
      Roboto: {
        normal: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Regular.ttf'),
        bold: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Bold.ttf'),
        italics: path.join(process.cwd(), 'src/pdf/fonts/Roboto-Italic.ttf'),
        bolditalics: path.join(process.cwd(), 'src/pdf/fonts/Roboto-BoldItalic.ttf'),
      },
    };

    const printer = new PdfPrinter(fonts);

    let docContent: any[] = [
      {
      columns: [
        { width: '*', text: '' },
        {
        width: 100,
        image: logoBase64,
        fit: [100, 100],
        alignment: 'right',
        },
      ],
      },
      { text: title, style: 'header', margin: [0, 10, 0, 20] },
      {
      text: [
        { text: 'De: ', bold: true },
        { text: `Ing. ${sender}` },
      ],
      },
      {
      text: [
        { text: `${jobTitle} – GAVA C&C`, bold: true },
      ],
      margin: [0, 0, 0, 10],
      },
      {
      text: [
        { text: 'Para: ', bold: true },
        { text: 'Equipo de Logística' },
      ],
      },
      {
      text: [
        { text: 'Proyecto: ', bold: true },
        { text: `${projectName}` },
      ],
      margin: [0, 0, 0, 10],
      },
      {
      text: [
        { text: 'Fecha y Hora de Solicitud: ', bold: true },
        { text: `${dateCreatedAt}` },
      ]
      },
      {
      text: [
        { text: 'Fecha y Hora de Entrega: ', bold: true },
        { text: `${formattedDeliveryDueDate}` },
      ],
      margin: [0, 0, 0, 10],
      },
    ];

    if (type === RequestType.EppAndOperative) {
      // Separar los elementos por tipo
      const operativeElements = elementRequests.filter(el => el.element.type === RequestType.Operative);
      const securityElements = elementRequests.filter(el => el.element.type === RequestType.Epp);

      if (operativeElements.length > 0) {
      docContent.push(
        { text: 'DETALLE DEL REQUERIMIENTO OPERATIVO', style: 'subheader', margin: [0, 20, 0, 10] },
        {
        table: {
          widths: ['auto', '*', 'auto', 'auto'],
          body: [
          ['N° ITEM', 'Descripción', 'UNIDAD', 'CANTIDAD'],
          ...operativeElements.map((el, index) => [
            index + 1,
            el.element.name,
            el.unit,
            el.quantityRequested.toString()
          ]),
          ],
        },
        }
      );
      }

      if (securityElements.length > 0) {
      docContent.push(
        { text: 'DETALLE DEL REQUERIMIENTO EPP', style: 'subheader', margin: [0, 20, 0, 10] },
        {
        table: {
          widths: ['auto', '*', 'auto', 'auto'],
          body: [
          ['N° ITEM', 'Descripción', 'UNIDAD', 'CANTIDAD'],
          ...securityElements.map((el, index) => [
            index + 1,
            el.element.name,
            el.unit,
            el.quantityRequested.toString()
          ]),
          ],
        },
        }
      );
      }
    } else {
      docContent.push(
      { text: 'DETALLE DEL REQUERIMIENTO', style: 'subheader', margin: [0, 20, 0, 10] },
      {
        table: {
        widths: ['auto', '*', 'auto', 'auto'],
        body: [
          ['N° ITEM', 'Descripción', 'UNIDAD', 'CANTIDAD'],
          ...elementRequests.map((el, index) => [
          index + 1,
          el.element.name,
          el.unit,
          el.quantityRequested.toString()
          ]),
        ],
        },
      }
      );
    }

    docContent.push(
      {text: 'Descripción:', style: 'subheader', margin: [0, 20, 0, 10]},
      {
        text: description,
        margin: [0, 10],
        alignment: 'justify',
      },
      {
      text: footer,
      margin: [0, 20],
      alignment: 'justify',
      },
      {
      text: [
        { text: 'Atentamente,\n\n', bold: true },
        { text: `Ing. ${sender}` },
      ],
      alignment: 'left',
      margin: [0, 10, 0, 0],
      }
    );

    const docDefinition = {
      pageMargins: [60, 40, 60, 40],
      content: docContent,
      styles: {
      header: { fontSize: 14, bold: true, alignment: 'center' },
      subheader: { fontSize: 12, bold: true },
      },
      defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      },
    };

    try {
      const outputDir = this.configService.get<string>('PDF_OUTPUT_DIR') || '/var/www/pdfs';
      const fileName = `requerimiento-${requestId}.pdf`;
      // const outputPath = path.resolve(outputDir, fileName);
      const outputPath = path.resolve(__dirname, '..', '..', 'output', `requerimiento-${requestId}.pdf`);

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const stream = fs.createWriteStream(outputPath);

      pdfDoc.pipe(stream);
      pdfDoc.end();

      return new Promise<string>((resolve, reject) => {
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', err => reject(err));
      });
    } catch (error) {
      this.logger.error('Error generating PDF:', error);
      throw new InternalServerErrorException('Error generating PDF');
    }
  }
}
