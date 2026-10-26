import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake/src/printer';
import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import { join } from 'node:path';

export interface SsomaOfficialParticipant {
  workerId: number;
  fullName: string;
  dni: string;
  workerType: string;
  status: 'SIGNED' | 'DECLINED';
}

export interface SsomaOfficialDocumentSnapshot {
  talkId: number;
  versionNumber: number;
  project: { code: string; name: string };
  talk: {
    talkDate: string;
    topic: string;
    trainer: string | null;
    location: string | null;
    targetAudience: string | null;
    scheduledTime: string | null;
    durationMinutes: number | null;
    observations: string | null;
    responsibleName: string | null;
    responsiblePosition: string | null;
  };
  participants: SsomaOfficialParticipant[];
}

const MAX_PARTICIPANTS_PER_PAGE = 28;
const palette = {
  navy: '#17324D',
  blue: '#245A7A',
  border: '#8A9AA8',
  light: '#EAF0F4',
  muted: '#566573',
};

export function paginateSsomaParticipants<T>(
  participants: readonly T[],
): T[][] {
  const pages: T[][] = [];
  for (
    let index = 0;
    index < participants.length;
    index += MAX_PARTICIPANTS_PER_PAGE
  )
    pages.push(participants.slice(index, index + MAX_PARTICIPANTS_PER_PAGE));
  return pages.length ? pages : [[]];
}

function workerTypeLabel(type: string) {
  const labels: Record<string, string> = {
    laborer: 'Operario',
    technician: 'Técnico',
    engineer: 'Ingeniero',
    administrator: 'Administrador',
    manager: 'Gerente',
    unspecified: 'No especificado',
  };
  return labels[type] ?? 'No especificado';
}

function displayDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function textOrBlank(value: string | null | undefined) {
  return value?.trim() || '—';
}

function cell(text: string, options: Partial<TableCell> = {}): TableCell {
  return {
    text,
    fontSize: 6.5,
    margin: [2, 2, 2, 2],
    ...options,
  } as TableCell;
}

@Injectable()
export class SsomaOfficialPdfRenderer {
  buildDocumentDefinition(
    snapshot: SsomaOfficialDocumentSnapshot,
    signatures: ReadonlyMap<number, Buffer>,
  ): TDocumentDefinitions {
    const participantPages = paginateSsomaParticipants(snapshot.participants);
    const header: Content = {
      stack: [
        {
          columns: [
            {
              text: 'SST-F-002',
              bold: true,
              color: palette.blue,
              fontSize: 8,
              width: 70,
            },
            {
              text: 'REGISTRO DE CHARLA DE SEGURIDAD Y SALUD OCUPACIONAL',
              bold: true,
              color: palette.navy,
              fontSize: 10,
              alignment: 'right',
            },
          ],
        },
        {
          columns: [
            {
              text: `${snapshot.project.code} - ${snapshot.project.name}`,
              width: '*',
              fontSize: 7.5,
              bold: true,
            },
            {
              text: `Fecha: ${displayDate(snapshot.talk.talkDate)}`,
              width: 95,
              alignment: 'right',
              fontSize: 7.5,
            },
          ],
          margin: [0, 4, 0, 1],
        },
        {
          text: `Tema: ${textOrBlank(snapshot.talk.topic)}`,
          fontSize: 7.5,
          margin: [0, 1, 0, 1],
        },
        {
          columns: [
            {
              text: `Instructor: ${textOrBlank(snapshot.talk.trainer)}`,
              width: '*',
              fontSize: 7,
            },
            {
              text: `Lugar: ${textOrBlank(snapshot.talk.location)}`,
              width: '*',
              fontSize: 7,
            },
          ],
          margin: [0, 1, 0, 1],
        },
        {
          columns: [
            {
              text: `Dirigido a: ${textOrBlank(snapshot.talk.targetAudience)}`,
              width: '*',
              fontSize: 7,
            },
            {
              text: `Horario: ${snapshot.talk.scheduledTime ?? '—'}${snapshot.talk.durationMinutes ? ` / ${snapshot.talk.durationMinutes} min` : ''}`,
              width: 150,
              alignment: 'right',
              fontSize: 7,
            },
          ],
          margin: [0, 1, 0, 5],
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 530,
              y2: 0,
              lineWidth: 0.6,
              lineColor: palette.border,
            },
          ],
        },
      ],
      margin: [30, 20, 30, 0],
    };

    const participantTable = (
      participants: SsomaOfficialParticipant[],
      pageIndex: number,
    ): Content => {
      const body: TableCell[][] = [
        [
          cell('N°', {
            bold: true,
            color: '#FFFFFF',
            fillColor: palette.blue,
            alignment: 'center',
          }),
          cell('Nombres y apellidos', {
            bold: true,
            color: '#FFFFFF',
            fillColor: palette.blue,
          }),
          cell('DNI', {
            bold: true,
            color: '#FFFFFF',
            fillColor: palette.blue,
            alignment: 'center',
          }),
          cell('Cargo / tipo', {
            bold: true,
            color: '#FFFFFF',
            fillColor: palette.blue,
            alignment: 'center',
          }),
          cell('Firma / constancia', {
            bold: true,
            color: '#FFFFFF',
            fillColor: palette.blue,
            alignment: 'center',
          }),
        ],
      ];
      participants.forEach((participant, index) => {
        const signature = signatures.get(participant.workerId);
        const signatureCell: TableCell =
          participant.status === 'DECLINED'
            ? cell('Declinó firmar', {
                alignment: 'center',
                color: palette.muted,
                italics: true,
              })
            : signature
              ? ({
                  image: `data:image/png;base64,${signature.toString('base64')}`,
                  fit: [100, 19],
                  alignment: 'center',
                  margin: [1, 1, 1, 1],
                } as TableCell)
              : cell('Firma no disponible', {
                  alignment: 'center',
                  color: palette.muted,
                  italics: true,
                });
        body.push([
          cell(String(pageIndex * MAX_PARTICIPANTS_PER_PAGE + index + 1), {
            alignment: 'center',
          }),
          cell(participant.fullName),
          cell(participant.dni, { alignment: 'center' }),
          cell(workerTypeLabel(participant.workerType), {
            alignment: 'center',
          }),
          signatureCell,
        ]);
      });
      if (!participants.length)
        body.push([
          cell('—', { alignment: 'center' }),
          cell('No hay participantes oficiales.', {
            colSpan: 4,
            alignment: 'center',
            color: palette.muted,
          }),
          {},
          {},
          {},
        ]);
      return {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          keepWithHeaderRows: 1,
          widths: [25, '*', 52, 72, 112],
          body,
        },
        layout: {
          hLineWidth: () => 0.4,
          vLineWidth: () => 0.4,
          hLineColor: () => palette.border,
          vLineColor: () => palette.border,
          paddingLeft: () => 2,
          paddingRight: () => 2,
          paddingTop: () => 1,
          paddingBottom: () => 1,
        },
      };
    };

    const firstPageTail: Content[] = [
      {
        stack: [
          {
            text: 'OBSERVACIONES',
            bold: true,
            color: palette.navy,
            fontSize: 7,
            margin: [0, 7, 0, 3],
          },
          {
            text: textOrBlank(snapshot.talk.observations),
            fontSize: 6.5,
            color: '#202B33',
            margin: [3, 2, 3, 2],
          },
        ],
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: 'INSTRUCTOR / EXPOSITOR',
                bold: true,
                fontSize: 6.5,
                color: palette.navy,
                alignment: 'center',
              },
              {
                text: '\n\n________________________________',
                fontSize: 7,
                alignment: 'center',
              },
              {
                text: textOrBlank(snapshot.talk.trainer),
                fontSize: 6.5,
                alignment: 'center',
              },
              {
                text: 'Cargo: ____________________    DNI: __________',
                fontSize: 6,
                alignment: 'center',
              },
            ],
          },
          {
            width: '*',
            stack: [
              {
                text: 'RESPONSABLE DEL REGISTRO',
                bold: true,
                fontSize: 6.5,
                color: palette.navy,
                alignment: 'center',
              },
              {
                text: '\n\n________________________________',
                fontSize: 7,
                alignment: 'center',
              },
              {
                text: textOrBlank(snapshot.talk.responsibleName),
                fontSize: 6.5,
                alignment: 'center',
              },
              {
                text: `Cargo: ${textOrBlank(snapshot.talk.responsiblePosition)}    DNI: __________`,
                fontSize: 6,
                alignment: 'center',
              },
            ],
          },
        ],
        margin: [0, 7, 0, 0],
      },
    ];

    const content: Content[] = [];
    participantPages.forEach((participants, pageIndex) => {
      const items: Content[] = [participantTable(participants, pageIndex)];
      if (pageIndex === 0) items.push(...firstPageTail);
      const pageContent: Content = {
        stack: items,
        ...(pageIndex < participantPages.length - 1
          ? { pageBreak: 'after' as const }
          : {}),
      };
      content.push(pageContent);
    });

    return {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: [30, 112, 30, 34],
      header: () => header,
      footer: (currentPage, pageCount) => ({
        text: `SST-F-002     Página ${currentPage} de ${pageCount}`,
        alignment: 'center',
        color: palette.muted,
        fontSize: 6.5,
        margin: [0, 5, 0, 0],
      }),
      content,
      defaultStyle: { font: 'Roboto', fontSize: 7.5, color: '#202B33' },
      styles: { subheader: { fontSize: 7, bold: true, color: palette.navy } },
    };
  }

  async render(
    snapshot: SsomaOfficialDocumentSnapshot,
    signatures: ReadonlyMap<number, Buffer>,
  ) {
    const fonts = {
      Roboto: {
        normal: join(process.cwd(), 'src/pdf/fonts/Roboto-Regular.ttf'),
        bold: join(process.cwd(), 'src/pdf/fonts/Roboto-Bold.ttf'),
        italics: join(process.cwd(), 'src/pdf/fonts/Roboto-Italic.ttf'),
        bolditalics: join(process.cwd(), 'src/pdf/fonts/Roboto-BoldItalic.ttf'),
      },
    };
    const pdfDoc = new PdfPrinter(fonts).createPdfKitDocument(
      this.buildDocumentDefinition(snapshot, signatures),
    );
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }
}
