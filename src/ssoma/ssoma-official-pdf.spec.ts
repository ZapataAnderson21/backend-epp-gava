import { deflateSync } from 'node:zlib';
import {
  resolveSsomaPdfFontConfiguration,
  SsomaOfficialPdfRenderer,
  paginateSsomaParticipants,
  SSOMA_TEMPLATE_GEOMETRY,
} from './ssoma-official-pdf';

const participant = (index: number) => ({
  workerId: index + 1,
  fullName: `Worker ${index + 1}`,
  dni: `${String(index + 1).padStart(8, '0')}`,
  workerType: 'employee',
  status: 'SIGNED' as const,
});

const snapshot = (count = 28, versionNumber = 1) => ({
  talkId: 41,
  versionNumber,
  project: { code: 'P-1', name: 'Project North' },
  talk: {
    talkDate: '2026-10-25',
    topic: 'Safe work',
    trainer: 'Trainer',
    location: 'Site',
    targetAudience: 'Crew',
    scheduledTime: '08:30',
    durationMinutes: 45,
    observations: 'Use protective equipment.',
    responsibleName: null,
    responsiblePosition: null,
  },
  participants: Array.from({ length: count }, (_, index) => participant(index)),
});

function png(width: number, height: number): Buffer {
  const crc32 = (buffer: Buffer) => {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const typeBytes = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
    return Buffer.concat([length, typeBytes, data, crc]);
  };
  const dimensions = Buffer.alloc(13);
  dimensions.writeUInt32BE(width, 0);
  dimensions.writeUInt32BE(height, 4);
  dimensions[8] = 8;
  dimensions[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const offset = y * (width * 4 + 1);
    for (let x = 0; x < width; x++) {
      raw[offset + 1 + x * 4] = 20;
      raw[offset + 2 + x * 4] = 48;
      raw[offset + 3 + x * 4] = 85;
      raw[offset + 4 + x * 4] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', dimensions),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function collectText(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectText);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return [
    ...(typeof record.text === 'string' ? [record.text] : []),
    ...Object.entries(record)
      .filter(([key]) => key !== 'text')
      .flatMap(([, child]) => collectText(child)),
  ];
}

describe('SsomaOfficialPdfRenderer', () => {
  it('uses measured SST-F-002 page and attendance geometry', () => {
    expect(SSOMA_TEMPLATE_GEOMETRY).toMatchObject({
      pageWidth: 595.2,
      pageHeight: 841.8,
      frameLeft: 30.72,
      frameRight: 563.76,
      attendanceColumnSeparators: [72, 234, 386.4, 473.28],
      attendanceHeaderTop: 188.64,
      participantTop: 203.76,
      legalNoteTop: 732.48,
      signatureBlockTop: 739.68,
    });
    expect(SSOMA_TEMPLATE_GEOMETRY.participantBottom).toBeCloseTo(679.2, 5);
    expect(SSOMA_TEMPLATE_GEOMETRY.observationsTop).toBeCloseTo(679.2, 5);
    expect(SSOMA_TEMPLATE_GEOMETRY.frameBottom).toBeCloseTo(811.44, 5);
    expect(SSOMA_TEMPLATE_GEOMETRY.fieldAnchors).toEqual({
      topic: { x: 56, y: 120 },
      date: { x: 516, y: 120 },
      trainer: { x: 160, y: 134 },
      location: { x: 62, y: 148 },
      audience: { x: 82, y: 162 },
      startTime: { x: 358, y: 162 },
      endTime: { x: 430, y: 162 },
      duration: { x: 541, y: 162 },
    });
    expect(SSOMA_TEMPLATE_GEOMETRY.participantRowHeight).toBeCloseTo(16.98, 2);
    expect(
      SSOMA_TEMPLATE_GEOMETRY.participantTop +
        SSOMA_TEMPLATE_GEOMETRY.participantRowHeight * 28,
    ).toBeCloseTo(SSOMA_TEMPLATE_GEOMETRY.participantBottom, 5);
  });

  it('selects configured licensed HSEQ fonts only when both files are readable', () => {
    const configured = resolveSsomaPdfFontConfiguration(
      {
        SSOMA_HSEQ_FONT_REGULAR_PATH: 'C:/licensed/tahoma.ttf',
        SSOMA_HSEQ_FONT_BOLD_PATH: 'C:/licensed/tahomabd.ttf',
      },
      () => true,
    );
    expect(configured.family).toBe('Tahoma');
    expect(configured.files.normal).toBe('C:/licensed/tahoma.ttf');
    expect(configured.files.bold).toBe('C:/licensed/tahomabd.ttf');
    expect(
      resolveSsomaPdfFontConfiguration(
        { SSOMA_HSEQ_FONT_REGULAR_PATH: 'C:/licensed/tahoma.ttf' },
        () => true,
      ).family,
    ).toBe('Roboto');
    expect(
      resolveSsomaPdfFontConfiguration({}, () => false).files.normal,
    ).toContain('Roboto-Regular.ttf');
  });

  it('paginates all participants in groups of 28 and preserves continuous numbering', () => {
    const expanded = Array.from({ length: 58 }, (_, index) =>
      participant(index),
    );
    const pages = paginateSsomaParticipants(expanded);
    expect(pages.map((page) => page.length)).toEqual([28, 28, 2]);
    expect(pages.flat().map((row) => row.workerId)).toEqual(
      expanded.map((row) => row.workerId),
    );

    const definition = new SsomaOfficialPdfRenderer().buildDocumentDefinition(
      snapshot(58),
      new Map(),
    );
    const pageContents = definition.content as Array<{
      stack: unknown[];
      pageBreak?: string;
    }>;
    expect(pageContents).toHaveLength(3);
    expect(
      pageContents.slice(0, 2).every((page) => page.pageBreak === 'after'),
    ).toBe(true);
    const rowNumbers = (page: { stack: unknown[] }) =>
      (page.stack as Array<Record<string, unknown>>)
        .filter((node) => {
          const position = node.absolutePosition as { x?: number } | undefined;
          return position?.x === 47 && typeof node.text === 'string';
        })
        .map((node) => node.text);
    expect(rowNumbers(pageContents[0])).toHaveLength(0);
    expect(rowNumbers(pageContents[1])).toEqual(
      Array.from({ length: 28 }, (_, index) =>
        String(index + 29).padStart(2, '0'),
      ),
    );
    expect(rowNumbers(pageContents[2])).toEqual(['57', '58']);
    expect(collectText(pageContents[2].stack).join(' ')).toContain('3 de 3');
  });

  it('repeats the single-page workbook observation and signatory form on continuations', () => {
    // SST-F-002 defines one 28-row page; later pages repeat that approved page form.
    const definition = new SsomaOfficialPdfRenderer().buildDocumentDefinition(
      snapshot(58),
      new Map(),
    );
    const pages = definition.content as unknown as Array<{ stack: unknown[] }>;
    expect(pages).toHaveLength(3);
    const background = definition.background as { image: string };
    expect(background.image).toContain('hseq-reg-036-blank.png');
    for (const page of pages) {
      expect(collectText(page.stack).join(' ')).toContain(
        'Use protective equipment.',
      );
    }
  });

  it('lays dynamic fields over the official template and omits audit data', () => {
    const renderer = new SsomaOfficialPdfRenderer();
    const unsafe = {
      ...snapshot(2),
      auditEvents: [{ eventType: 'document_revision_started' }],
      correctionReason: 'Internal correction reason',
    };
    const definition = renderer.buildDocumentDefinition(
      unsafe as never,
      new Map(),
    );
    const text = collectText(definition.content).join(' ');
    const background = definition.background as {
      image: string;
      width: number;
      height: number;
    };
    expect(background.image).toContain('hseq-reg-036-blank.png');
    expect(background.width).toBe(595.2);
    expect(background.height).toBe(841.8);
    expect(definition.pageMargins).toEqual([0, 0, 0, 0]);
    expect(text).toContain('Safe work');
    expect(text).toContain('25/10/2026');
    expect(text).toContain('08:30');
    expect(text).toContain('09:15');
    expect(text).toContain('0.75');
    expect(text).toContain('Use protective equipment.');
    expect(text).not.toContain('auditEvents');
    expect(text).not.toContain('Internal correction reason');
    expect(text).not.toContain('Operario');
  });

  it('fits signatures in the worker identity cell without reusing or distorting them', () => {
    const signatures = new Map([
      [1, png(160, 32)],
      [2, png(32, 160)],
    ]);
    const definition = new SsomaOfficialPdfRenderer().buildDocumentDefinition(
      snapshot(2),
      signatures,
    );
    const serializedContent = JSON.stringify(definition.content);
    expect(serializedContent).toContain(png(160, 32).toString('base64'));
    expect(serializedContent).toContain(png(32, 160).toString('base64'));
    const content = definition.content as unknown as Array<{
      stack: unknown[];
    }>;
    const images = content[0].stack.filter(
      (node): node is Record<string, unknown> =>
        typeof node === 'object' && node !== null && 'image' in node,
    );
    expect(images).toHaveLength(2);
    expect(images[0].fit).toEqual(images[1].fit);
    expect((images[0].absolutePosition as { x: number }).x).toBeCloseTo(
      476.28,
      3,
    );
    expect((images[1].absolutePosition as { x: number }).x).toBeCloseTo(
      476.28,
      3,
    );
  });

  it('renders a valid revision-compatible PDF with a repeated official background', async () => {
    const renderer = new SsomaOfficialPdfRenderer();
    const pdf = await renderer.render(
      snapshot(58, 2),
      new Map([[1, png(64, 32)]]),
    );
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1500);
  });
});
