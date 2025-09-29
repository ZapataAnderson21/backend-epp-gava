import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as PdfPrinter from 'pdfmake';
import { PrismaService } from 'src/prisma/prisma.service';
import { logoBase64 } from './logoBase64';
import { RequestStatus, RequestType } from 'src/request/entities/request.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PdfService {

  private readonly logger = new Logger("PdfService");

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async generateRequestPdf(request_id: number) {

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

    this.logger.log("Request:" + request);

    if (!request) {
      this.logger.error('Request not found');
      throw new NotFoundException('Request not found');
    }

    this.logger.log('Request found:', request);

    if (request.status !== RequestStatus.Draft) {
      throw new BadRequestException('Only requests with status "draft" can be sent');
    }

    if(!request.type || !Object.values(RequestType).includes(request.type.toLowerCase() as RequestType)) {
      throw new BadRequestException('Invalid request type');
    }

    const type = request.type;

    const elementRequests = await this.prismaService.elementRequest.findMany({
      where: { request_id },
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

    const sender = `${request.user.name} ${request.user.last_name}`;
    const jobTitle = request.user.userUserTypes[0].userType.name;
    const dateObj = new Date(request.createdAt);
    const dateCreatedAt = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;
    const deliveryDueDate = new Date(request.delivery_due_date);
    const formattedDeliveryDueDate = `${deliveryDueDate.getDate().toString().padStart(2, '0')}/${(deliveryDueDate.getMonth() + 1).toString().padStart(2, '0')}/${deliveryDueDate.getFullYear()} ${deliveryDueDate.getHours().toString().padStart(2, '0')}:${deliveryDueDate.getMinutes().toString().padStart(2, '0')}`;
    const description = request.description || 'No description provided';
    const projectName = request.project.name;

    let title = '', footer = '';

    switch (type) {
      case RequestType.Operative:
        title = 'SOLICITUD DE REQUERIMIENTO DE ELEMENTOS OPERATIVOS';
        footer = `Agradecemos de antemano su atención a esta solicitud y quedamos atentos a su aprobación para proceder con las gestiones correspondientes.`;
        break;
      case RequestType.Security:
        title = 'SOLICITUD DE REQUERIMIENTO DE ELEMENTOS DE PROTECCIÓN PERSONAL (EPP)';
        footer = `Agradecemos de antemano su atención a esta solicitud. Quedamos atentos a su aprobación y a la gestión correspondiente para la adquisición de los EPP requeridos.`;
        break;
      case RequestType.OperativeAndSecurity:
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

    if (type === RequestType.OperativeAndSecurity) {
      // Separar los elementos por tipo
      const operativeElements = elementRequests.filter(el => el.element.type === RequestType.Operative);
      const securityElements = elementRequests.filter(el => el.element.type === RequestType.Security);

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
            el.quantity_requested.toString()
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
            el.quantity_requested.toString()
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
          el.quantity_requested.toString()
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
      const fileName = `requerimiento-${request_id}.pdf`;
      // const outputPath = path.resolve(outputDir, fileName);
      const outputPath = path.resolve(__dirname, '..', '..', 'output', `requerimiento-${request_id}.pdf`);

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
