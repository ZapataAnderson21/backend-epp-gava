import { Injectable } from '@nestjs/common';
import PdfPrinter from 'pdfmake/src/printer';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { SsomaActivityType } from 'src/generated/prisma';
import { accessSync, constants as fsConstants, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const fontkit = createRequire(__filename)('@foliojs-fork/fontkit') as {
  create(data: Buffer): {
    unitsPerEm: number;
    layout(text: string): { glyphs: Array<{ advanceWidth: number }> };
  };
};

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
    activityType: SsomaActivityType;
    otherActivityText: string | null;
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
// Dynamic cells shrink to 4.2 pt, then truncate with an ellipsis rather than spill.
const MIN_DYNAMIC_FONT_SIZE = 4.2;
const MAX_OBSERVATION_LINES = 3;
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
  signatureCellRight: 2349 * TEMPLATE_SCALE,
  pageControlBottom: 290 * TEMPLATE_SCALE,
  attendanceColumnSeparators: [300, 975, 1610, 1972].map(
    (pixel) => pixel * TEMPLATE_SCALE,
  ),
  attendanceHeaderTop: 786 * TEMPLATE_SCALE,
  participantTop: 849 * TEMPLATE_SCALE,
  participantRowHeight: ((2830 - 849) * TEMPLATE_SCALE) / 28,
  participantBottom: 2830 * TEMPLATE_SCALE,
  observationsTop: 2830 * TEMPLATE_SCALE,
  observationRuleY: [2913, 2958, 3003].map((pixel) => pixel * TEMPLATE_SCALE),
  observationTextTopPadding: 7.6,
  observationTextHeight: 6.8,
  legalNoteTop: 3052 * TEMPLATE_SCALE,
  signatureBlockTop: 3082 * TEMPLATE_SCALE,
  frameBottom: 3381 * TEMPLATE_SCALE,
  fieldAnchors: {
    workerCount: { x: 476, y: 88 },
    topic: { x: 56, y: 120 },
    date: { x: 516, y: 120 },
    trainer: { x: 160, y: 134 },
    location: { x: 62, y: 148 },
    audience: { x: 82, y: 162 },
    startTime: { x: 358, y: 162 },
    endTime: { x: 430, y: 162 },
    duration: { x: 541, y: 162 },
  },
  activityCheckboxAnchors: {
    INDUCTION: { x: 390 * TEMPLATE_SCALE, y: 453 * TEMPLATE_SCALE },
    TALK: { x: 688 * TEMPLATE_SCALE, y: 453 * TEMPLATE_SCALE },
    TRAINING: { x: 1078 * TEMPLATE_SCALE, y: 453 * TEMPLATE_SCALE },
    PRACTICE: { x: 1471 * TEMPLATE_SCALE, y: 453 * TEMPLATE_SCALE },
    DRILL: { x: 1785 * TEMPLATE_SCALE, y: 453 * TEMPLATE_SCALE },
    OTHER: { x: 1980 * TEMPLATE_SCALE, y: 453 * TEMPLATE_SCALE },
  },
  otherActivityTextBox: {
    left: 2041 * TEMPLATE_SCALE,
    right: 2328 * TEMPLATE_SCALE,
  },
  otherActivityTextAnchor: {
    x: 2041 * TEMPLATE_SCALE,
    y: 453 * TEMPLATE_SCALE,
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
  fontFamily: SsomaPdfFontFamily = resolveSsomaPdfFontConfiguration().family,
): Content {
  if (!text) return { text: '' };
  const fitted = fitTextToCell(text, width, fontSize, fontFamily, bold);
  return {
    text: fitted.text,
    fontSize: fitted.fontSize,
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

const loadedFonts = new Map<string, ReturnType<typeof fontkit.create>>();

function fontPath(fontFamily: SsomaPdfFontFamily, bold: boolean): string {
  if (fontFamily === 'Tahoma') {
    const configured = resolveSsomaPdfFontConfiguration();
    if (configured.family === 'Tahoma') {
      return bold ? configured.files.bold : configured.files.normal;
    }
  }
  return join(
    process.cwd(),
    `src/pdf/fonts/Roboto-${bold ? 'Bold' : 'Regular'}.ttf`,
  );
}

function loadedFont(fontFamily: SsomaPdfFontFamily, bold: boolean) {
  const path = fontPath(fontFamily, bold);
  let font = loadedFonts.get(path);
  if (!font) {
    font = fontkit.create(readFileSync(path));
    loadedFonts.set(path, font);
  }
  return font;
}

export function measureSsomaTextWidth(
  text: string,
  fontSize: number,
  fontFamily: SsomaPdfFontFamily,
  bold = false,
): number {
  if (!text) return 0;
  try {
    const font = loadedFont(fontFamily, bold);
    const glyphs = font.layout(text).glyphs;
    return (
      (glyphs.reduce((total, glyph) => total + glyph.advanceWidth, 0) /
        font.unitsPerEm) *
      fontSize
    );
  } catch {
    // Keep an unreadable font or unsupported glyph from making an overlay unbounded.
    return Array.from(text).length * fontSize;
  }
}

function normalizedSingleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncateToWidth(
  text: string,
  width: number,
  fontSize: number,
  fontFamily: SsomaPdfFontFamily,
  bold: boolean,
): string {
  const points = Array.from(text);
  const ellipsis = '…';
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${points.slice(0, middle).join('').trimEnd()}${ellipsis}`;
    if (measureSsomaTextWidth(candidate, fontSize, fontFamily, bold) <= width) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  if (low > 0) return `${points.slice(0, low).join('').trimEnd()}${ellipsis}`;
  return measureSsomaTextWidth(ellipsis, fontSize, fontFamily, bold) <= width
    ? ellipsis
    : '';
}

function fitTextToCell(
  source: string,
  width: number,
  preferredFontSize: number,
  fontFamily: SsomaPdfFontFamily,
  bold: boolean,
): { text: string; fontSize: number } {
  const text = normalizedSingleLine(source);
  for (
    let fontSize = preferredFontSize;
    fontSize >= MIN_DYNAMIC_FONT_SIZE;
    fontSize = Math.round((fontSize - 0.2) * 10) / 10
  ) {
    if (measureSsomaTextWidth(text, fontSize, fontFamily, bold) <= width) {
      return { text, fontSize };
    }
  }
  return {
    text: truncateToWidth(text, width, MIN_DYNAMIC_FONT_SIZE, fontFamily, bold),
    fontSize: MIN_DYNAMIC_FONT_SIZE,
  };
}

function wrapObservations(
  text: string,
  width: number,
  fontSize: number,
  fontFamily: SsomaPdfFontFamily,
): string[] {
  const words = normalizedSingleLine(text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  while (words.length > 0 && lines.length < MAX_OBSERVATION_LINES) {
    const word = words.shift()!;
    const candidate = line ? `${line} ${word}` : word;
    if (measureSsomaTextWidth(candidate, fontSize, fontFamily) <= width) {
      line = candidate;
      continue;
    }
    if (line) {
      lines.push(line);
      line = '';
      words.unshift(word);
      continue;
    }
    lines.push(truncateToWidth(word, width, fontSize, fontFamily, false));
  }
  if (line && lines.length < MAX_OBSERVATION_LINES) lines.push(line);
  if (words.length > 0 && lines.length === MAX_OBSERVATION_LINES) {
    const last = lines[MAX_OBSERVATION_LINES - 1];
    const remaining = `${last} ${words.join(' ')}`;
    lines[MAX_OBSERVATION_LINES - 1] = truncateToWidth(
      remaining,
      width,
      fontSize,
      fontFamily,
      false,
    );
  }
  return lines;
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
    width,
    height,
    absolutePosition: { x, y },
  } as Content;
}

function fitPngWithinBox(
  data: Buffer,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } | undefined {
  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (
    data.length < 24 ||
    !data.subarray(0, 8).equals(pngSignature) ||
    !Number.isFinite(maxWidth) ||
    !Number.isFinite(maxHeight) ||
    maxWidth <= 0 ||
    maxHeight <= 0
  ) {
    return undefined;
  }

  const sourceWidth = data.readUInt32BE(16);
  const sourceHeight = data.readUInt32BE(20);
  if (sourceWidth <= 0 || sourceHeight <= 0) return undefined;
  const scale = Math.min(1, maxWidth / sourceWidth, maxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return undefined;
  }
  return { width, height };
}

function checkboxMark(position: { x: number; y: number }): Content {
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
    absolutePosition: position,
  } as Content;
}

function pageContent(
  snapshot: SsomaOfficialDocumentSnapshot,
  participants: readonly SsomaOfficialParticipant[],
  signatures: ReadonlyMap<number, Buffer>,
  pageIndex: number,
  pageCount: number,
  fontFamily: SsomaPdfFontFamily,
): Content[] {
  const content: Content[] = [
    // Replace only the printed static page digits; the approved label stays in the template.
    {
      canvas: [{ type: 'rect', x: 0, y: 0, w: 55, h: 7, color: '#FFFFFF' }],
      absolutePosition: { x: 501, y: 62 },
    } as Content,
    absoluteText(
      `${pageIndex + 1} de ${pageCount}`,
      501,
      63,
      55,
      9,
      5.6,
      true,
      'left',
      fontFamily,
    ),
    absoluteText(
      textOrBlank(snapshot.talk.topic),
      56,
      120,
      409,
      12,
      5.6,
      false,
      'left',
      fontFamily,
    ),
    absoluteText(
      displayDate(snapshot.talk.talkDate),
      516,
      120,
      40,
      12,
      5.6,
      false,
      'left',
      fontFamily,
    ),
    absoluteText(
      textOrBlank(snapshot.talk.trainer),
      160,
      134,
      400,
      12,
      5.6,
      false,
      'left',
      fontFamily,
    ),
    absoluteText(
      textOrBlank(snapshot.talk.location),
      62,
      148,
      492,
      12,
      5.6,
      false,
      'left',
      fontFamily,
    ),
    absoluteText(
      textOrBlank(snapshot.talk.targetAudience),
      82,
      162,
      214,
      12,
      5.6,
      false,
      'left',
      fontFamily,
    ),
    absoluteText(
      formatTime(snapshot.talk.scheduledTime),
      358,
      162,
      25,
      12,
      5.6,
      false,
      'left',
      fontFamily,
    ),
    absoluteText(
      endTime(snapshot.talk.scheduledTime, snapshot.talk.durationMinutes),
      430,
      162,
      30,
      12,
      5.6,
      false,
      'left',
      fontFamily,
    ),
    absoluteText(
      durationHours(snapshot.talk.durationMinutes),
      541,
      162,
      20,
      12,
      5.6,
      false,
      'left',
      fontFamily,
    ),
    checkboxMark(
      SSOMA_TEMPLATE_GEOMETRY.activityCheckboxAnchors[
        snapshot.talk.activityType ?? SsomaActivityType.TALK
      ],
    ),
    absoluteText(
      String(snapshot.participants.length),
      SSOMA_TEMPLATE_GEOMETRY.fieldAnchors.workerCount.x,
      SSOMA_TEMPLATE_GEOMETRY.fieldAnchors.workerCount.y,
      82,
      12,
      5.6,
      false,
      'left',
      fontFamily,
    ),
    ...(snapshot.talk.activityType === SsomaActivityType.OTHER &&
    textOrBlank(snapshot.talk.otherActivityText)
      ? [
          absoluteText(
            textOrBlank(snapshot.talk.otherActivityText),
            SSOMA_TEMPLATE_GEOMETRY.otherActivityTextAnchor.x,
            SSOMA_TEMPLATE_GEOMETRY.otherActivityTextAnchor.y,
            SSOMA_TEMPLATE_GEOMETRY.otherActivityTextBox.right -
              SSOMA_TEMPLATE_GEOMETRY.otherActivityTextAnchor.x,
            px(24),
            5.6,
            false,
            'left',
            fontFamily,
          ),
        ]
      : []),
  ];

  const columns = SSOMA_TEMPLATE_GEOMETRY.attendanceColumnSeparators;
  const rowHeight = SSOMA_TEMPLATE_GEOMETRY.participantRowHeight;
  const rowTop = SSOMA_TEMPLATE_GEOMETRY.participantTop;
  if (pageIndex > 0) {
    for (let rowIndex = 0; rowIndex < MAX_PARTICIPANTS_PER_PAGE; rowIndex++) {
      const top = rowTop + rowIndex * rowHeight;
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
    }
  }
  participants.forEach((participant, index) => {
    const top = rowTop + index * rowHeight;
    const number = String(
      pageIndex * MAX_PARTICIPANTS_PER_PAGE + index + 1,
    ).padStart(2, '0');
    const y = top + 4.5;
    if (pageIndex > 0) {
      content.push(
        absoluteText(number, 47, y, 12, 9, 5.8, true, 'left', fontFamily),
      );
    }
    content.push(
      absoluteText(
        participant.fullName,
        columns[0] + 4,
        y,
        columns[1] - columns[0] - 8,
        9,
        5.6,
        false,
        'left',
        fontFamily,
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
        false,
        'left',
        fontFamily,
      ),
    );
    // Worker classification is not an official position; leave CARGO / ÁREA blank.
    const signature =
      participant.status === 'SIGNED'
        ? signatures.get(participant.workerId)
        : undefined;
    if (signature) {
      const maxWidth =
        SSOMA_TEMPLATE_GEOMETRY.signatureCellRight - columns[3] - 6;
      const maxHeight = rowHeight - 2.6;
      const fittedSize = fitPngWithinBox(signature, maxWidth, maxHeight);
      if (fittedSize) {
        const cellLeft = columns[3] + 3;
        content.push(
          absoluteImage(
            signature,
            cellLeft + (maxWidth - fittedSize.width) / 2,
            top + (rowHeight - fittedSize.height) / 2,
            fittedSize.width,
            fittedSize.height,
          ),
        );
      }
    }
  });

  const observations = textOrBlank(snapshot.talk.observations);
  if (observations) {
    const observationX = px(460);
    const observationWidth =
      SSOMA_TEMPLATE_GEOMETRY.frameRight - observationX - 6;
    const observationFontSize = 5.4;
    const lines = wrapObservations(
      observations,
      observationWidth,
      observationFontSize,
      fontFamily,
    );
    lines.forEach((line, index) =>
      content.push(
        absoluteText(
          line,
          observationX,
          SSOMA_TEMPLATE_GEOMETRY.observationRuleY[index] -
            SSOMA_TEMPLATE_GEOMETRY.observationTextTopPadding,
          observationWidth,
          SSOMA_TEMPLATE_GEOMETRY.observationTextHeight,
          observationFontSize,
          false,
          'left',
          fontFamily,
        ),
      ),
    );
  }
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
          fontFamily,
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
