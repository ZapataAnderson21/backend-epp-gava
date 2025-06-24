import { ConfigurableModuleBuilder, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as PdfPrinter from 'pdfmake';
import { PrismaService } from 'src/prisma/prisma.service';
import { logoBase64 } from './logoBase64';

@Injectable()
export class PdfService {
  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  async generateRequestPdf(request_id: number, type: 'operative' | 'security' | 'operative and security') {
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

    console.log("PDF-SERVICE:")
    console.log("Request:" + request)

    if (!request) {
      throw new Error('Request not found');
    }

    console.log('Request found:', request);

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
      throw new Error('Element Requests not found');
    }

    console.log('Element Requests found:', elementRequests);

    const sender = `${request.user.name} ${request.user.last_name}`;
    const jobTitle = request.user.userUserTypes[0].userType.name;
    const dateObj = new Date(request.registration_date);
    const date = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

    let title = '', subject = '', paragraphs: string[] = [], footer = '';

    switch (type) {
      case 'operative':
        title = 'SOLICITUD DE REQUERIMIENTO DE ELEMENTOS OPERATIVOS';
        subject = `Solicitud de Requerimiento de Elementos Operativos - ${request.project.name}`;
        paragraphs = [
          `Mediante la presente, me permito remitir a usted la solicitud de requerimiento de elementos operativos necesarios para el normal desarrollo de las actividades en obra.`, 
          `Este requerimiento se fundamenta en la verificación de necesidades realizadas durante las inspecciones operativas, en las cuales se ha identificado la falta, desgaste o inadecuado funcionamiento de ciertos equipos, herramientas o insumos esenciales para el desempeño seguro y eficiente del personal.`,
          `En atención a las responsabilidades de la empresa respecto a la provisión oportuna de los recursos operativos necesarios, detallamos a continuación los elementos requeridos:`
        ];
        footer = `Agradecemos de antemano su atención a esta solicitud y quedamos atentos a su aprobación para proceder con las gestiones correspondientes.`;
        break;
      case 'security':
        title = 'SOLICITUD DE REQUERIMIENTO DE ELEMENTOS DE PROTECCIÓN PERSONAL (EPP)';
        subject = `Solicitud de Requerimiento de EPP - ${request.project.name}`;
        paragraphs = [
          `Me dirijo a usted con el propósito de remitir la presente solicitud de requerimiento de Elementos de Protección Personal (EPP), en cumplimiento de las disposiciones establecidas en la Ley N° 29783, Ley de Seguridad y Salud en el Trabajo, y su Reglamento aprobado por el D.S. N° 005-2012-TR.`,
          `Durante la inspección de seguridad realizada en obra, se ha verificado la necesidad de reponer o adquirir nuevos EPP para el personal operativo, debido a la detección de elementos deteriorados, con daños visibles o no conformes con los estándares mínimos de seguridad.`,
          `En cumplimiento del Artículo 62 del Reglamento de la Ley mencionada, que establece la obligación del empleador de mantener en buen estado los EPP proporcionados y reponerlos cuando sea necesario, se presenta el siguiente requerimiento:`
        ];
        footer = `Agradecemos de antemano su atención a esta solicitud. Quedamos atentos a su aprobación y a la gestión correspondiente para la adquisición de los EPP requeridos.`;
        break;
      case 'operative and security':
        title = 'SOLICITUD DE REQUERIMIENTO DE EPP Y ELEMENTOS OPERATIVOS';
        subject = `Solicitud de Requerimiento de EPP y Elementos Operativos - ${request.project.name}`;
        paragraphs = [
          `Por medio de la presente, le hago llegar la solicitud de requerimiento de Elementos de Protección Personal (EPP) y Elementos Operativos, conforme a lo dispuesto en la Ley N° 29783, Ley de Seguridad y Salud en el Trabajo, su reglamento (D.S. N° 005-2012-TR), y en concordancia con las exigencias técnicas para el desarrollo adecuado de las actividades en obra.`,
          `Durante las últimas inspecciones de seguridad y operatividad, se ha verificado la necesidad de reponer EPP deteriorados, así como de adquirir elementos operativos esenciales para asegurar condiciones de trabajo seguras y eficientes.`,
          `Con base en lo anterior, se detalla a continuación el requerimiento mixto:`
        ];
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

    const docDefinition = {
    pageMargins: [60, 40, 60, 40],
    content: [
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
          { text: 'Ing. Henrry Gayoso Valdera' },
        ],
      },
      {
        text: [
          { text: 'Gerente General – GAVA C&C', bold: true },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        text: [
          { text: 'Asunto: ', bold: true },
          { text: `${subject}` },
        ],
      },
      {
        text: [
          { text: 'Fecha: ', bold: true },
          { text: `${date}` },
        ],
        margin: [0, 10, 0, 20],
      },
      { text: `Estimado Ing. Gayoso:`, bold: true },

      ...paragraphs.map(p => ({
        text: p,
        margin: [0, 10],
        alignment: 'justify',
      })),

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
        margin: [0, 40, 0, 0],
      },
    ],
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
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const outputPath = path.join(__dirname, `../../output/requerimiento-${request_id}.pdf`);
      const stream = fs.createWriteStream(outputPath);

      pdfDoc.pipe(stream);
      pdfDoc.end();

      return new Promise<string>((resolve, reject) => {
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', err => reject(err));
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Error generating PDF');
    }
  }
}
