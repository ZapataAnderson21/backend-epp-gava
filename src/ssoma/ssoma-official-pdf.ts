import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake/src/printer';
import type {
  Content,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import { accessSync, constants as fsConstants } from 'node:fs';
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
const PAGE_WIDTH = 595.28;
const PAGE_MARGINS: [number, number, number, number] = [31, 28, 31, 22];
const FORM_WIDTH = PAGE_WIDTH - PAGE_MARGINS[0] - PAGE_MARGINS[2];
const ROW_SCALE = 0.5;
// The approved workbook's fitted print scale is 53%; its 28-row attendance
// grid measured slightly above the 53% full-page grid after PDF line weights.
const WORKBOOK_FIT_SCALE = 0.53;
const ATTENDANCE_ROW_SCALE = 0.52;
const HSEQ_FONT_REGULAR_ENV = 'SSOMA_HSEQ_FONT_REGULAR_PATH';
const HSEQ_FONT_BOLD_ENV = 'SSOMA_HSEQ_FONT_BOLD_PATH';
const COLORS = {
  black: '#000000',
  white: '#FFFFFF',
  header: '#D9D9D9',
};

export type SsomaPdfFontFamily = 'Tahoma' | 'Roboto';

export interface SsomaPdfFontConfiguration {
  family: SsomaPdfFontFamily;
  files: {
    normal: string;
    bold: string;
    italics: string;
    bolditalics: string;
  };
}

function isReadableFontFile(fontPath: string) {
  try {
    accessSync(fontPath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveSsomaPdfFontConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  isReadable: (fontPath: string) => boolean = isReadableFontFile,
): SsomaPdfFontConfiguration {
  const regularPath = env[HSEQ_FONT_REGULAR_ENV]?.trim();
  const boldPath = env[HSEQ_FONT_BOLD_ENV]?.trim();
  if (
    regularPath &&
    boldPath &&
    isReadable(regularPath) &&
    isReadable(boldPath)
  ) {
    return {
      family: 'Tahoma',
      files: {
        normal: regularPath,
        bold: boldPath,
        italics: regularPath,
        bolditalics: boldPath,
      },
    };
  }
  const roboto = {
    normal: join(process.cwd(), 'src/pdf/fonts/Roboto-Regular.ttf'),
    bold: join(process.cwd(), 'src/pdf/fonts/Roboto-Bold.ttf'),
    italics: join(process.cwd(), 'src/pdf/fonts/Roboto-Italic.ttf'),
    bolditalics: join(process.cwd(), 'src/pdf/fonts/Roboto-BoldItalic.ttf'),
  };
  return { family: 'Roboto', files: roboto };
}

// These are the SST-F-002 A:C, D:E, F:H, I:J, and K:L print proportions.
const COMPANY_COLUMNS = [40.56, 20.14, 59.27, 29.28, 30.42];
const companyWidthTotal = COMPANY_COLUMNS.reduce(
  (total, value) => total + value,
  0,
);
const companyWidths = COMPANY_COLUMNS.map(
  (value) => (value / companyWidthTotal) * FORM_WIDTH,
);

const borders = {
  hLineWidth: () => 0.45,
  vLineWidth: () => 0.45,
  hLineColor: () => COLORS.black,
  vLineColor: () => COLORS.black,
  paddingLeft: () => 1.2,
  paddingRight: () => 1.2,
  paddingTop: () => 0,
  paddingBottom: () => 0,
};

const PARTICIPANT_COLUMNS = [14, 54.55, 51.42, 29.28, 30.42];
const participantTotal = PARTICIPANT_COLUMNS.reduce(
  (total, value) => total + value,
  0,
);
const participantWidths = PARTICIPANT_COLUMNS.map(
  (value) => (value / participantTotal) * FORM_WIDTH,
);
const signatureColumnWidth = participantWidths[4];

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
  };
  return labels[type] ?? '';
}

function displayDate(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
}

function textOrBlank(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function formatTime(value: string | null) {
  if (!value) return '';
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function endTime(start: string | null, durationMinutes: number | null) {
  const time = formatTime(start);
  if (!time || durationMinutes === null || !Number.isFinite(durationMinutes))
    return '';
  const [hours, minutes] = time.split(':').map(Number);
  const elapsed = (hours * 60 + minutes + durationMinutes) % (24 * 60);
  return `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
}

function durationHours(durationMinutes: number | null) {
  if (durationMinutes === null || !Number.isFinite(durationMinutes)) return '';
  return (durationMinutes / 60).toFixed(2);
}

function cell(text: string, options: Partial<TableCell> = {}): TableCell {
  return {
    text,
    fontSize: 6.1,
    color: COLORS.black,
    margin: [1, 0, 1, 0],
    ...options,
  } as TableCell;
}

function makeCheckbox(selected: boolean): Record<string, unknown> {
  return {
    canvas: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        w: 11,
        h: 8,
        lineWidth: 0.6,
        lineColor: COLORS.black,
      },
      ...(selected
        ? [
            {
              type: 'line' as const,
              x1: 2,
              y1: 4,
              x2: 4.5,
              y2: 6.5,
              lineWidth: 0.8,
              lineColor: COLORS.black,
            },
            {
              type: 'line' as const,
              x1: 4.5,
              y1: 6.5,
              x2: 9,
              y2: 1.5,
              lineWidth: 0.8,
              lineColor: COLORS.black,
            },
          ]
        : []),
    ],
  };
}

function activityChecklist(): Record<string, unknown> {
  const options = [
    ['Inducción', false],
    ['Charla', true],
    ['Capacitación', false],
    ['Entrenamiento', false],
    ['Simulacro', false],
    ['Otros', false],
  ] as const;
  const columns: Content[] = [];
  for (const [label, selected] of options) {
    columns.push(
      {
        text: label,
        fontSize: 5.5,
        alignment: 'center',
        width: 'auto',
      } as Content,
      { ...makeCheckbox(selected), width: 16 } as unknown as Content,
    );
  }
  columns.push({
    text: '',
    width: '*',
  } as Content);
  columns.push({
    canvas: [
      {
        type: 'rect',
        x: 0,
        y: 0,
        w: 70,
        h: 13,
        lineWidth: 0.6,
        lineColor: COLORS.black,
      },
    ],
    width: 73,
  } as unknown as Content);
  return {
    columns,
    columnGap: 1,
    margin: [2, 0, 2, 0],
    alignment: 'center',
  };
}

function signatureSection(): Content {
  const widths = [40, 162, 80, 208, 43];
  // Rows 48-55 carry the signature labels; Excel's default-height final row
  // supplies the visible lower frame seen in the approved print render.
  const heights = [9.95, 15, 15.6, 15, 9.95, 20.1, 20.1, 15, 13.9].map(
    (height) => height * WORKBOOK_FIT_SCALE,
  );
  const body: TableCell[][] = Array.from({ length: 9 }, () =>
    Array.from(
      { length: 5 },
      () => ({ text: '', border: [false, false, false, false] }) as TableCell,
    ),
  );
  body[3][1] = cell('Expositor', {
    bold: true,
    alignment: 'center',
    fontSize: 5,
    margin: [0, 0, 0, 0],
    border: [false, true, false, false],
  });
  body[3][3] = cell('Responsable del Registro', {
    bold: true,
    alignment: 'center',
    fontSize: 5,
    margin: [0, 0, 0, 0],
    border: [false, true, false, false],
  });
  body[5][1] = cell('CARGO:', { bold: true, alignment: 'left' });
  body[5][3] = cell('CARGO:', { bold: true, alignment: 'left' });
  body[6][1] = cell('DNI:', { bold: true, alignment: 'left' });
  body[6][3] = cell('DNI:', { bold: true, alignment: 'left' });
  for (let rowIndex = 0; rowIndex < body.length; rowIndex++) {
    body[rowIndex][0].border = [true, rowIndex === 0, false, false];
    body[rowIndex][4].border = [false, rowIndex === 0, true, false];
  }
  for (let columnIndex = 1; columnIndex < 4; columnIndex++) {
    body[0][columnIndex].border = [false, true, false, false];
    body[8][columnIndex].border = [false, false, false, true];
  }
  body[8][0].border = [true, false, false, true];
  body[8][4].border = [false, false, true, true];
  return {
    table: {
      widths,
      heights: (index: number) => heights[index] ?? 0,
      body,
    },
    layout: {
      hLineWidth: (index: number) =>
        index === 0 || index === 3 || index === 9 ? 0.45 : 0,
      vLineWidth: (index: number) => (index === 0 || index === 5 ? 0.45 : 0),
      hLineColor: () => COLORS.black,
      vLineColor: () => COLORS.black,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  } as Content;
}

function formPage(
  snapshot: SsomaOfficialDocumentSnapshot,
  participants: readonly SsomaOfficialParticipant[],
  signatures: ReadonlyMap<number, Buffer>,
  pageIndex: number,
  pageCount: number,
): Content[] {
  const rowHeight = (height: number) => height * ROW_SCALE;
  const logoPath = join(process.cwd(), 'src/ssoma/assets/gava-logo.png');
  const topHeights = [20.1, 20.1, 20.1, 17.45].map(rowHeight);
  const headerBody: TableCell[][] = [
    [
      {
        image: logoPath,
        fit: [114, 31],
        rowSpan: 4,
        alignment: 'center',
        margin: [3, 0, 3, 0],
      } as TableCell,
      {
        text: 'REGISTRO DE INDUCCIÓN, CAPACITACIÓN, ENTRENAMIENTO Y SIMULACROS DE EMERGENCIA',
        rowSpan: 4,
        bold: true,
        alignment: 'center',
        fontSize: 8.3,
        margin: [7, 0, 7, 0],
      } as TableCell,
      cell('Código: HSEQ-REG-036', {
        bold: true,
        fontSize: 6.2,
        alignment: 'left',
      }),
    ],
    [{}, {}, cell('Versión: 02', { bold: true, fontSize: 6.2 })],
    [{}, {}, cell('Fecha: 06/01/2026', { bold: true, fontSize: 6.2 })],
    [
      {},
      {},
      cell(`Página: ${pageIndex + 1} de ${pageCount}`, {
        bold: true,
        fontSize: 6.2,
      }),
    ],
  ];
  const controlWidth = (30.42 / companyWidthTotal) * FORM_WIDTH;
  const titleWidth =
    FORM_WIDTH - controlWidth - (40.56 / companyWidthTotal) * FORM_WIDTH;
  const header: Content = {
    table: {
      widths: [
        FORM_WIDTH - controlWidth - titleWidth,
        titleWidth,
        controlWidth,
      ],
      heights: (index: number) => topHeights[index] ?? 0,
      body: headerBody,
    },
    layout: borders,
  };

  const companyRows: TableCell[][] = [
    [
      cell('RAZÓN SOCIAL', {
        bold: true,
        alignment: 'center',
        fillColor: COLORS.header,
        fontSize: 6.1,
      }),
      cell('RUC', {
        bold: true,
        alignment: 'center',
        fillColor: COLORS.header,
        fontSize: 6.1,
      }),
      cell('DOMICILIO (Dirección, distrito, departamento, provincia)', {
        bold: true,
        alignment: 'center',
        fillColor: COLORS.header,
        fontSize: 5.6,
      }),
      cell('ACTIVIDAD ECONÓMICA', {
        bold: true,
        alignment: 'center',
        fillColor: COLORS.header,
        fontSize: 5.6,
      }),
      cell('N° TRABAJADORES EN EL CENTRO LABORAL', {
        bold: true,
        alignment: 'center',
        fillColor: COLORS.header,
        fontSize: 5.4,
      }),
    ],
    [
      cell('GAVA C&C S.R.L.', { alignment: 'center', fontSize: 5.8 }),
      cell('20480347138', { alignment: 'center', fontSize: 5.8 }),
      cell('Call. Vicente de la Vega N° 1488 Campodónico - Chcilayo', {
        alignment: 'center',
        fontSize: 5.3,
      }),
      cell('Intalaciones Eléctricas, Obras Eléctromecánicas', {
        alignment: 'center',
        fontSize: 5.2,
      }),
      cell('', { alignment: 'center' }),
    ],
  ];
  const company: Content = {
    table: {
      widths: companyWidths,
      heights: (index: number) => rowHeight(index === 0 ? 33 : 26.45),
      body: companyRows,
    },
    layout: borders,
  };

  const activity: Content = {
    table: {
      widths: [FORM_WIDTH],
      heights: [rowHeight(35.45)],
      body: [
        [
          {
            ...activityChecklist(),
            border: [true, true, true, true],
            margin: [2, 0, 2, 0],
          } as unknown as TableCell,
        ],
      ],
    },
    layout: borders,
  };

  const talkRows: Content[] = [
    {
      table: {
        widths: [FORM_WIDTH - controlWidth, controlWidth],
        heights: [rowHeight(25.15)],
        body: [
          [
            cell(`Tema:  ${textOrBlank(snapshot.talk.topic)}`, {
              bold: true,
              fontSize: 6.2,
            }),
            cell(`Fecha: ${displayDate(snapshot.talk.talkDate)}`, {
              bold: true,
              fontSize: 6.2,
            }),
          ],
        ],
      },
      layout: borders,
    },
    {
      table: {
        widths: [FORM_WIDTH],
        heights: [rowHeight(26.45)],
        body: [
          [
            cell(
              `Nombre del Capacitador o Entrenador:  ${textOrBlank(snapshot.talk.trainer)}`,
              { bold: true, fontSize: 6.2 },
            ),
          ],
        ],
      },
      layout: borders,
    },
    {
      table: {
        widths: [FORM_WIDTH],
        heights: [rowHeight(24.6)],
        body: [
          [
            cell(`Lugar:  ${textOrBlank(snapshot.talk.location)}`, {
              bold: true,
              fontSize: 6.2,
            }),
          ],
        ],
      },
      layout: borders,
    },
    {
      table: {
        widths: [
          (95.7 / participantTotal) * FORM_WIDTH,
          (24.285 / participantTotal) * FORM_WIDTH,
          (29.28 / participantTotal) * FORM_WIDTH,
          (30.42 / participantTotal) * FORM_WIDTH,
        ],
        heights: [rowHeight(27.6)],
        body: [
          [
            cell(`Dirigido a:  ${textOrBlank(snapshot.talk.targetAudience)}`, {
              bold: true,
              fontSize: 6.2,
            }),
            cell(`H. Inicio: ${formatTime(snapshot.talk.scheduledTime)}`, {
              bold: true,
              fontSize: 5.9,
            }),
            cell(
              `H. Término: ${endTime(snapshot.talk.scheduledTime, snapshot.talk.durationMinutes)}`,
              { bold: true, fontSize: 5.9 },
            ),
            cell(
              `Duración en Horas: ${durationHours(snapshot.talk.durationMinutes)}`,
              { bold: true, fontSize: 5.7 },
            ),
          ],
        ],
      },
      layout: borders,
    },
  ];

  const attendanceBody: TableCell[][] = [
    [
      cell('N°', { bold: true, alignment: 'center', fillColor: COLORS.header }),
      cell('APELLIDOS Y NOMBRES', {
        bold: true,
        alignment: 'center',
        fillColor: COLORS.header,
      }),
      cell('DNI', {
        bold: true,
        alignment: 'center',
        fillColor: COLORS.header,
      }),
      cell('CARGO / ÁREA', {
        bold: true,
        alignment: 'center',
        fillColor: COLORS.header,
        fontSize: 5.8,
      }),
      cell('FIRMA', {
        bold: true,
        alignment: 'center',
        fillColor: COLORS.header,
      }),
    ],
  ];
  for (let rowIndex = 0; rowIndex < MAX_PARTICIPANTS_PER_PAGE; rowIndex++) {
    const participant = participants[rowIndex];
    const signature =
      participant?.status === 'SIGNED'
        ? signatures.get(participant.workerId)
        : undefined;
    attendanceBody.push([
      cell(
        String(pageIndex * MAX_PARTICIPANTS_PER_PAGE + rowIndex + 1).padStart(
          2,
          '0',
        ),
        {
          bold: true,
          alignment: 'center',
          fontSize: 6.1,
        },
      ),
      cell(participant?.fullName ?? '', { alignment: 'left', fontSize: 5.8 }),
      cell(participant?.dni ?? '', { alignment: 'center', fontSize: 5.8 }),
      cell(participant ? workerTypeLabel(participant.workerType) : '', {
        alignment: 'center',
        fontSize: 5.8,
      }),
      signature
        ? ({
            image: `data:image/png;base64,${signature.toString('base64')}`,
            fit: [Math.max(1, signatureColumnWidth - 7), 13],
            alignment: 'center',
            margin: [1, 0, 1, 0],
          } as TableCell)
        : cell('', { alignment: 'center' }),
    ]);
  }
  const attendance: Content = {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      keepWithHeaderRows: 1,
      widths: participantWidths,
      heights: (index: number) =>
        (index === 0 ? 27.95 : 31.9) * ATTENDANCE_ROW_SCALE,
      body: attendanceBody,
    },
    layout: borders,
  };

  const observationRule = (indent: number): Content => ({
    canvas: [
      {
        type: 'line',
        x1: indent,
        y1: 1,
        x2: FORM_WIDTH - 2,
        y2: 1,
        lineWidth: 0.4,
        lineColor: COLORS.black,
        dash: { length: 1, space: 1 },
      },
    ],
  });
  const observationRows: TableCell[][] = [
    [cell('Observaciones:', { bold: true, italics: true, fontSize: 6.1 })],
    [
      {
        stack: [
          {
            text: textOrBlank(snapshot.talk.observations),
            fontSize: 5.8,
            margin: [36, 0, 2, 0],
          },
          observationRule(40),
        ],
        margin: [0, 0, 0, 0],
      } as unknown as TableCell,
    ],
    [
      {
        stack: [observationRule(10)],
        margin: [0, 0, 0, 0],
      } as unknown as TableCell,
    ],
    [
      {
        stack: [observationRule(10)],
        margin: [0, 0, 0, 0],
      } as unknown as TableCell,
    ],
  ];
  const observations: Content = {
    table: {
      widths: [FORM_WIDTH],
      heights: [42, 43, 44, 45].map(
        (row) =>
          (row === 45 ? 33.6 : row === 42 ? 24.95 : 20.45) * WORKBOOK_FIT_SCALE,
      ),
      body: observationRows,
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      hLineColor: () => COLORS.black,
      vLineColor: () => COLORS.black,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
  };
  const legalNote: Content = {
    table: {
      widths: [FORM_WIDTH],
      // This one-row note has 1.8 px of PDF border overhead at 120 dpi;
      // the workbook's rendered note anchor is 1 px shorter than 15 pt * 53%.
      heights: [13.8 * ROW_SCALE],
      body: [
        [
          cell('Formato de acuerdo a los lineamientos de la R.M. 050-2013-TR', {
            fontSize: 5.7,
          }),
        ],
      ],
    },
    layout: borders,
  };

  return [
    header,
    company,
    activity,
    ...talkRows,
    {
      table: {
        widths: [FORM_WIDTH],
        heights: [rowHeight(24.95)],
        body: [
          [
            cell('REGISTRO DE ASISTENCIA', {
              bold: true,
              alignment: 'center',
              fillColor: COLORS.header,
              fontSize: 6.3,
            }),
          ],
        ],
      },
      layout: borders,
    } as Content,
    attendance,
    observations,
    legalNote,
    signatureSection(),
  ];
}

@Injectable()
export class SsomaOfficialPdfRenderer {
  buildDocumentDefinition(
    snapshot: SsomaOfficialDocumentSnapshot,
    signatures: ReadonlyMap<number, Buffer>,
    fontFamily: SsomaPdfFontFamily = resolveSsomaPdfFontConfiguration().family,
  ): TDocumentDefinitions {
    const participantPages = paginateSsomaParticipants(snapshot.participants);
    const content: Content[] = [];
    participantPages.forEach((participants, pageIndex) => {
      content.push({
        stack: formPage(
          snapshot,
          participants,
          signatures,
          pageIndex,
          participantPages.length,
        ),
        ...(pageIndex < participantPages.length - 1
          ? { pageBreak: 'after' as const }
          : {}),
      });
    });
    return {
      pageSize: 'A4',
      pageOrientation: 'portrait',
      pageMargins: PAGE_MARGINS,
      content,
      defaultStyle: { font: fontFamily, fontSize: 6.1, color: COLORS.black },
    };
  }

  async render(
    snapshot: SsomaOfficialDocumentSnapshot,
    signatures: ReadonlyMap<number, Buffer>,
  ) {
    const fontConfiguration = resolveSsomaPdfFontConfiguration();
    const fonts = { [fontConfiguration.family]: fontConfiguration.files };
    const pdfDoc = new PdfPrinter(fonts).createPdfKitDocument(
      this.buildDocumentDefinition(
        snapshot,
        signatures,
        fontConfiguration.family,
      ),
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
