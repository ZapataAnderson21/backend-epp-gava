import { deflateSync } from 'node:zlib';
import {
  resolveSsomaPdfFontConfiguration,
  SsomaOfficialPdfRenderer,
  paginateSsomaParticipants,
  SSOMA_TEMPLATE_GEOMETRY,
  measureSsomaTextWidth,
} from './ssoma-official-pdf';
import { SsomaActivityType } from 'src/generated/prisma';

const participant = (index: number) => ({
  workerId: index + 1,
  fullName: `Worker ${index + 1}`,
  dni: `${String(index + 1).padStart(8, '0')}`,
  workerType: 'employee',
  status: 'SIGNED' as const,
});

const snapshot = (
  count = 28,
  versionNumber = 1,
  activityType: SsomaActivityType = SsomaActivityType.TALK,
  otherActivityText: string | null = null,
) => ({
  talkId: 41,
  versionNumber,
  project: { code: 'P-1', name: 'Project North' },
  talk: {
    talkDate: '2026-10-25',
    topic: 'Safe work',
    activityType,
    otherActivityText,
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
      signatureCellRight: 563.76,
      pageControlBottom: 69.6,
      attendanceColumnSeparators: [72, 234, 386.4, 473.28],
      attendanceHeaderTop: 188.64,
      participantTop: 203.76,
      legalNoteTop: 732.48,
      signatureBlockTop: 739.68,
    });
    expect(SSOMA_TEMPLATE_GEOMETRY.participantBottom).toBeCloseTo(679.2, 5);
    expect(SSOMA_TEMPLATE_GEOMETRY.observationsTop).toBeCloseTo(679.2, 5);
    expect(SSOMA_TEMPLATE_GEOMETRY.observationRuleY).toEqual([
      699.12, 709.92, 720.72,
    ]);
    expect(SSOMA_TEMPLATE_GEOMETRY.frameBottom).toBeCloseTo(811.44, 5);
    expect(SSOMA_TEMPLATE_GEOMETRY.fieldAnchors).toEqual({
      workerCount: { x: 476, y: 88 },
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

  it('marks exactly the selected official activity and renders Other text and participant count', () => {
    const renderer = new SsomaOfficialPdfRenderer();
    const activityTypes = Object.values(SsomaActivityType);
    const markPositions = activityTypes.map((activityType) => {
      const page = renderer.buildDocumentDefinition(
        snapshot(
          2,
          1,
          activityType,
          activityType === SsomaActivityType.OTHER ? 'Visita' : null,
        ),
        new Map(),
      ).content as unknown as Array<{ stack: Array<Record<string, unknown>> }>;
      const marks = page[0].stack.filter((node) => {
        const canvas = node.canvas as
          | Array<Record<string, unknown>>
          | undefined;
        return (
          canvas?.length === 2 && canvas.every((shape) => shape.type === 'line')
        );
      });
      expect(marks).toHaveLength(1);
      return (marks[0].absolutePosition as { x: number }).x;
    });
    expect(new Set(markPositions).size).toBe(activityTypes.length);

    const page = renderer.buildDocumentDefinition(
      snapshot(2, 1, 'OTHER', 'Visita'),
      new Map(),
    ).content as unknown as Array<{ stack: Array<Record<string, unknown>> }>;
    const count = page[0].stack.find((node) => {
      const position = node.absolutePosition as
        | { x?: number; y?: number }
        | undefined;
      return position?.x === 476 && position.y === 88 && node.text === '2';
    });
    expect(count).toBeDefined();
    const otherText = page[0].stack.find((node) => node.text === 'Visita');
    expect(otherText).toBeDefined();
    const otherPosition = otherText?.absolutePosition as
      | { x: number; y: number }
      | undefined;
    expect(otherPosition?.x).toBe(
      SSOMA_TEMPLATE_GEOMETRY.otherActivityTextAnchor.x,
    );
    expect(
      (otherPosition?.x ?? 0) + (otherText?.width as number),
    ).toBeLessThanOrEqual(SSOMA_TEMPLATE_GEOMETRY.frameRight);
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
    const rowPatches = (page: { stack: unknown[] }) =>
      page.stack.filter((node) => {
        if (typeof node !== 'object' || node === null) return false;
        const record = node as Record<string, unknown>;
        const position = record.absolutePosition as { y?: number } | undefined;
        const canvas = record.canvas as
          | Array<Record<string, unknown>>
          | undefined;
        const rectangle = canvas?.[0];
        return (
          position?.y !== undefined &&
          position.y >= SSOMA_TEMPLATE_GEOMETRY.participantTop &&
          position.y < SSOMA_TEMPLATE_GEOMETRY.participantBottom &&
          rectangle?.color === '#FFFFFF'
        );
      });
    expect(rowPatches(pageContents[0])).toHaveLength(0);
    expect(rowPatches(pageContents[1])).toHaveLength(28);
    expect(rowPatches(pageContents[2])).toHaveLength(28);
    expect(collectText(pageContents[2].stack).join(' ')).toContain('3 de 3');
  });

  it('clears only the page value area without crossing into the official heading', () => {
    const definition = new SsomaOfficialPdfRenderer().buildDocumentDefinition(
      snapshot(1),
      new Map(),
    );
    const page = (
      definition.content as unknown as Array<{ stack: unknown[] }>
    )[0];
    const patch = page.stack[0] as {
      absolutePosition: { x: number; y: number };
      canvas: Array<{ w: number; h: number }>;
    };
    expect(patch.absolutePosition).toEqual({ x: 501, y: 62 });
    expect(patch.absolutePosition.x + patch.canvas[0].w).toBeLessThan(
      SSOMA_TEMPLATE_GEOMETRY.frameRight,
    );
    expect(patch.canvas[0].h).toBeLessThanOrEqual(
      69.6 - patch.absolutePosition.y,
    );
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

  it('bounds maximum-length dynamic values to their official cells and observation lines', () => {
    const longValue = 'W'.repeat(260);
    const longObservations = `${'Observation with excessive detail '.repeat(40)}`;
    const crowded = {
      ...snapshot(1),
      talk: {
        ...snapshot(1).talk,
        topic: longValue,
        location: longValue,
        targetAudience: longValue,
        observations: longObservations,
      },
      participants: [
        { ...participant(0), fullName: longValue, dni: longValue },
      ],
    };
    const definition = new SsomaOfficialPdfRenderer().buildDocumentDefinition(
      crowded,
      new Map(),
      'Roboto',
    );
    expect(crowded.talk.topic).toBe(longValue);
    expect(crowded.talk.observations).toBe(longObservations);
    expect(crowded.participants[0].fullName).toBe(longValue);
    const page = (
      definition.content as unknown as Array<{ stack: unknown[] }>
    )[0];
    const textNodes = page.stack.filter(
      (node): node is Record<string, unknown> =>
        typeof node === 'object' &&
        node !== null &&
        typeof (node as { text?: unknown }).text === 'string' &&
        (node as { text: string }).text.length > 0,
    );

    const rightEdgeByX = new Map<number, number>([
      [47, 59],
      [56, 465],
      [62, 554],
      [76, SSOMA_TEMPLATE_GEOMETRY.attendanceColumnSeparators[1] - 4],
      [82, 296],
      [110.4, SSOMA_TEMPLATE_GEOMETRY.frameRight - 6],
      [160, 560],
      [237, SSOMA_TEMPLATE_GEOMETRY.attendanceColumnSeparators[2] - 3],
      [358, 383],
      [430, 460],
      [501, 556],
      [516, 556],
      [541, 561],
      [476, 558],
    ]);
    for (const node of textNodes) {
      const width = node.width as number;
      const fontSize = node.fontSize as number;
      const x = (node.absolutePosition as { x: number }).x;
      const cellRight = rightEdgeByX.get(Number(x.toFixed(1)));
      expect(Number.isFinite(width) && width > 0).toBe(true);
      expect(Number.isFinite(fontSize) && fontSize >= 4.2).toBe(true);
      expect(
        measureSsomaTextWidth(
          node.text as string,
          fontSize,
          'Roboto',
          Boolean(node.bold),
        ),
      ).toBeLessThanOrEqual(width + 0.01);
      expect(cellRight).toBeDefined();
      expect(x + width).toBeLessThanOrEqual(cellRight! + 0.01);
    }
    expect(textNodes.some((node) => node.text === longValue)).toBe(false);
    const observations = textNodes.filter((node) => {
      const position = node.absolutePosition as { y?: number } | undefined;
      return (
        position?.y !== undefined &&
        position.y >= SSOMA_TEMPLATE_GEOMETRY.observationsTop
      );
    });
    expect(observations).toHaveLength(3);
    expect(
      observations.every(
        (node) => (node.text as string).length < longObservations.length,
      ),
    ).toBe(true);
    expect(
      observations.map((node) => (node.absolutePosition as { y: number }).y),
    ).toEqual([
      ...SSOMA_TEMPLATE_GEOMETRY.observationRuleY.map(
        (ruleY) => ruleY - SSOMA_TEMPLATE_GEOMETRY.observationTextTopPadding,
      ),
    ]);
    expect(
      observations.every((node, index) => {
        const { x, y } = node.absolutePosition as { x: number; y: number };
        const ruleY = SSOMA_TEMPLATE_GEOMETRY.observationRuleY[index];
        return (
          Math.abs(x - 110.4) < 0.01 &&
          (node.height as number) ===
            SSOMA_TEMPLATE_GEOMETRY.observationTextHeight &&
          y + (node.height as number) <= ruleY - 0.8 &&
          y >= SSOMA_TEMPLATE_GEOMETRY.observationsTop &&
          y + (node.height as number) < SSOMA_TEMPLATE_GEOMETRY.legalNoteTop
        );
      }),
    ).toBe(true);
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
    for (const item of images) {
      const width = item.width as number;
      const height = item.height as number;
      expect(Number.isFinite(width) && width > 0).toBe(true);
      expect(Number.isFinite(height) && height > 0).toBe(true);
    }
    expect(
      (images[0].width as number) / (images[0].height as number),
    ).toBeCloseTo(5, 5);
    expect(
      (images[1].width as number) / (images[1].height as number),
    ).toBeCloseTo(0.2, 5);
    const signatureCellLeft =
      SSOMA_TEMPLATE_GEOMETRY.attendanceColumnSeparators[3] + 3;
    const signatureCellRight = SSOMA_TEMPLATE_GEOMETRY.signatureCellRight - 3;
    for (const item of images) {
      const position = item.absolutePosition as { x: number; y: number };
      const width = item.width as number;
      expect(position.x).toBeGreaterThanOrEqual(signatureCellLeft);
      expect(position.x + width).toBeLessThanOrEqual(signatureCellRight);
    }
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
