import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake/src/printer';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
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

const MAX_PARTICIPANTS_PER_PAGE = 28;
const PAGE_WIDTH = 595.2;
const PAGE_HEIGHT = 841.8;
const TEMPLATE_SCALE = 0.24; // 300 dpi Excel render pixels to PDF points.
const HSEQ_FONT_REGULAR_ENV = 'SSOMA_HSEQ_FONT_REGULAR_PATH';
const HSEQ_FONT_BOLD_ENV = 'SSOMA_HSEQ_FONT_BOLD_PATH';
const TEMPLATE_PATH = join(
  process.cwd(),
  'src/ssoma/assets/hseq-reg-036-blank.png',
);

/** Coordinates measured on the approved SST-F-002 A4 Excel print render. */
export const SSOMA_TEMPLATE_GEOMETRY = {
  pageWidth: PAGE_WIDTH,
  pageHeight: PAGE_HEIGHT,
  frameLeft: 128 * TEMPLATE_SCALE,
  frameRight: 2349 * TEMPLATE_SCALE,
  attendanceColumnSeparators: [300, 975, 1610, 1972].map(
    (pixel) => pixel * TEMPLATE_SCALE,
  ),
  attendanceHeaderTop: 786 * TEMPLATE_SCALE,
  participantTop: 849 * TEMPLATE_SCALE,
  participantRowHeight: ((2830 - 849) * TEMPLATE_SCALE) / 28,
  participantBottom: 2830 * TEMPLATE_SCALE,
  observationsTop: 2830 * TEMPLATE_SCALE,
  legalNoteTop: 3052 * TEMPLATE_SCALE,
  signatureBlockTop: 3082 * TEMPLATE_SCALE,
  frameBottom: 3381 * TEMPLATE_SCALE,
  fieldAnchors: {
    topic: { x: 56, y: 120 },
    date: { x: 516, y: 120 },
    trainer: { x: 160, y: 134 },
    location: { x: 62, y: 148 },
    audience: { x: 82, y: 162 },
    startTime: { x: 358, y: 162 },
    endTime: { x: 430, y: 162 },
    duration: { x: 541, y: 162 },
  },
} as const;

function readableFontFile(fontPath: string) {
  try {
    accessSync(fontPath, fsConstants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveSsomaPdfFontConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  isReadable: (fontPath: string) => boolean = readableFontFile,
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
  return {
    family: 'Roboto',
    files: {
      normal: join(process.cwd(), 'src/pdf/fonts/Roboto-Regular.ttf'),
      bold: join(process.cwd(), 'src/pdf/fonts/Roboto-Bold.ttf'),
      italics: join(process.cwd(), 'src/pdf/fonts/Roboto-Italic.ttf'),
      bolditalics: join(process.cwd(), 'src/pdf/fonts/Roboto-BoldItalic.ttf'),
    },
  };
}

export function paginateSsomaParticipants<T>(
  participants: readonly T[],
): T[][] {
  const pages: T[][] = [];
  for (
    let index = 0;
    index < participants.length;
    index += MAX_PARTICIPANTS_PER_PAGE
  ) {
    pages.push(participants.slice(index, index + MAX_PARTICIPANTS_PER_PAGE));
  }
  return pages.length ? pages : [[]];
}

function textOrBlank(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function displayDate(value: string) {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
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
  return durationMinutes === null || !Number.isFinite(durationMinutes)
    ? ''
    : (durationMinutes / 60).toFixed(2);
}

function px(pixel: number) {
  return pixel * TEMPLATE_SCALE;
}

function absoluteText(
  text: string,
  x: number,
  y: number,
  width: number,
  height = 12,
  fontSize = 5.6,
  bold = false,
  alignment: 'left' | 'center' | 'right' = 'left',
): Content {
  if (!text) return { text: '' };
  return {
    text,
    fontSize,
    bold,
    alignment,
    color: '#000000',
    margin: 0,
    noWrap: true,
    absolutePosition: { x, y },
    width,
    height,
  } as Content;
}

function absoluteImage(
  data: Buffer,
  x: number,
  y: number,
  width: number,
  height: number,
): Content {
  return {
    image: `data:image/png;base64,${data.toString('base64')}`,
    fit: [width, height],
    absolutePosition: { x, y },
  } as Content;
}

function checkboxMark(): Content {
  // Charla is the approved activity for this module; the existing checkbox is static.
  return {
    canvas: [
      {
        type: 'line',
        x1: 0,
        y1: 4,
        x2: 2.2,
        y2: 6.2,
        lineWidth: 1,
        lineColor: '#000000',
      },
      {
        type: 'line',
        x1: 2.2,
        y1: 6.2,
        x2: 7,
        y2: 0.5,
        lineWidth: 1,
        lineColor: '#000000',
      },
    ],
    absolutePosition: { x: px(688), y: px(453) },
  } as Content;
}

function pageContent(
  snapshot: SsomaOfficialDocumentSnapshot,
  participants: readonly SsomaOfficialParticipant[],
  signatures: ReadonlyMap<number, Buffer>,
  pageIndex: number,
  pageCount: number,
): Content[] {
  const content: Content[] = [
    // Replace only the printed static page digits; the approved label stays in the template.
    {
      canvas: [{ type: 'rect', x: 0, y: 0, w: 55, h: 10, color: '#FFFFFF' }],
      absolutePosition: { x: 501, y: 62 },
    } as Content,
    absoluteText(`${pageIndex + 1} de ${pageCount}`, 501, 63, 55, 9, 5.6, true),
    absoluteText(textOrBlank(snapshot.talk.topic), 56, 120, 409, 12),
    absoluteText(displayDate(snapshot.talk.talkDate), 516, 120, 40, 12),
    absoluteText(textOrBlank(snapshot.talk.trainer), 160, 134, 400, 12),
    absoluteText(textOrBlank(snapshot.talk.location), 62, 148, 492, 12),
    absoluteText(textOrBlank(snapshot.talk.targetAudience), 82, 162, 214, 12),
    absoluteText(formatTime(snapshot.talk.scheduledTime), 358, 162, 25, 12),
    absoluteText(
      endTime(snapshot.talk.scheduledTime, snapshot.talk.durationMinutes),
      430,
      162,
      30,
      12,
    ),
    absoluteText(
      durationHours(snapshot.talk.durationMinutes),
      541,
      162,
      20,
      12,
      5.6,
    ),
    checkboxMark(),
  ];

  const columns = SSOMA_TEMPLATE_GEOMETRY.attendanceColumnSeparators;
  const rowHeight = SSOMA_TEMPLATE_GEOMETRY.participantRowHeight;
  const rowTop = SSOMA_TEMPLATE_GEOMETRY.participantTop;
  participants.forEach((participant, index) => {
    const top = rowTop + index * rowHeight;
    const number = String(
      pageIndex * MAX_PARTICIPANTS_PER_PAGE + index + 1,
    ).padStart(2, '0');
    const y = top + 4.5;
    if (pageIndex > 0) {
      content.push({
        canvas: [
          {
            type: 'rect',
            x: 0,
            y: 0,
            w: px(163),
            h: rowHeight - 2.2,
            color: '#FFFFFF',
          },
        ],
        absolutePosition: { x: px(134), y: top + 1.1 },
      } as Content);
      content.push(absoluteText(number, 47, y, 12, 9, 5.8, true));
    }
    content.push(
      absoluteText(
        participant.fullName,
        columns[0] + 4,
        y,
        columns[1] - columns[0] - 8,
        9,
        5.6,
      ),
    );
    content.push(
      absoluteText(
        participant.dni,
        columns[1] + 3,
        y,
        columns[2] - columns[1] - 6,
        9,
        5.6,
      ),
    );
    // Worker classification is not an official position; leave CARGO / ÁREA blank.
    const signature =
      participant.status === 'SIGNED'
        ? signatures.get(participant.workerId)
        : undefined;
    if (signature) {
      content.push(
        absoluteImage(
          signature,
          columns[3] + 3,
          top + 1.3,
          columns[4] - columns[3] - 6,
          rowHeight - 2.6,
        ),
      );
    }
  });

  const observations = textOrBlank(snapshot.talk.observations);
  if (observations)
    content.push(
      absoluteText(observations, px(300), px(2870), px(1950), 10, 5.4),
    );
  return content;
}

@Injectable()
export class SsomaOfficialPdfRenderer {
  buildDocumentDefinition(
    snapshot: SsomaOfficialDocumentSnapshot,
    signatures: ReadonlyMap<number, Buffer>,
    fontFamily: SsomaPdfFontFamily = resolveSsomaPdfFontConfiguration().family,
  ): TDocumentDefinitions {
    const pages = paginateSsomaParticipants(snapshot.participants);
    const content: Content[] = [];
    pages.forEach((participants, pageIndex) => {
      const page: Content = {
        stack: pageContent(
          snapshot,
          participants,
          signatures,
          pageIndex,
          pages.length,
        ),
        ...(pageIndex < pages.length - 1
          ? { pageBreak: 'after' as const }
          : {}),
      } as Content;
      content.push(page);
    });
    return {
      pageSize: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
      pageOrientation: 'portrait',
      pageMargins: [0, 0, 0, 0],
      background: {
        image: TEMPLATE_PATH,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
      } as Content,
      content,
      defaultStyle: { font: fontFamily, fontSize: 5.6, color: '#000000' },
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
