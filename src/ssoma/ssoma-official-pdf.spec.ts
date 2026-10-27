import { deflateSync } from 'node:zlib';
import {
  SsomaOfficialPdfRenderer,
  paginateSsomaParticipants,
} from './ssoma-official-pdf';

const participant = (index: number) => ({
  workerId: index + 1,
  fullName: `Worker ${index + 1}`,
  dni: `${String(index + 1).padStart(8, '0')}`,
  workerType: 'employee',
  status: 'SIGNED' as const,
});

const snapshot = {
  talkId: 41,
  versionNumber: 1,
  project: { code: 'P-1', name: 'Project North' },
  talk: {
    talkDate: '2026-10-25',
    topic: 'Safe work',
    trainer: 'Trainer',
    location: 'Site',
    targetAudience: 'Crew',
    scheduledTime: '08:30',
    durationMinutes: 5,
    observations: 'Use protective equipment.',
    responsibleName: 'Lead',
    responsiblePosition: 'Supervisor',
  },
  participants: Array.from({ length: 28 }, (_, index) => participant(index)),
};

function contentText(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(contentText);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const ownText = typeof record.text === 'string' ? [record.text] : [];
  return [
    ...ownText,
    ...Object.entries(record)
      .filter(([key]) => key !== 'text')
      .flatMap(([, child]) => contentText(child)),
  ];
}

function formPages(
  definition: ReturnType<SsomaOfficialPdfRenderer['buildDocumentDefinition']>,
) {
  return definition.content as unknown as Array<Record<string, unknown>>;
}

function tableBodies(value: unknown): unknown[][][] {
  if (Array.isArray(value)) return value.flatMap(tableBodies);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const result: unknown[][][] = [];
  const table = record.table as { body?: unknown[][] } | undefined;
  if (table?.body) result.push(table.body);
  for (const [key, child] of Object.entries(record)) {
    if (key !== 'table') result.push(...tableBodies(child));
  }
  return result;
}

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
    const rowOffset = y * (width * 4 + 1);
    for (let x = 0; x < width; x++) {
      const signatureY =
        height / 2 + Math.sin((x / width) * Math.PI * 4) * height * 0.2;
      if (Math.abs(y - signatureY) <= Math.max(1, height * 0.015)) {
        const pixelOffset = rowOffset + 1 + x * 4;
        raw[pixelOffset] = 20;
        raw[pixelOffset + 1] = 48;
        raw[pixelOffset + 2] = 85;
        raw[pixelOffset + 3] = 255;
      }
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', dimensions),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('SsomaOfficialPdfRenderer', () => {
  it('paginates all participants in groups of at most 28 without omissions', () => {
    expect(
      paginateSsomaParticipants(snapshot.participants).map(
        (page) => page.length,
      ),
    ).toEqual([28]);
    const expanded = Array.from({ length: 58 }, (_, index) =>
      participant(index),
    );
    const pages = paginateSsomaParticipants(expanded);
    expect(pages.map((page) => page.length)).toEqual([28, 28, 2]);
    expect(pages.flat().map((row) => row.workerId)).toEqual(
      expanded.map((row) => row.workerId),
    );
  });

  it('renders a valid PDF and excludes audit/internal fields from the official document', async () => {
    const renderer = new SsomaOfficialPdfRenderer();
    const unsafe = {
      ...snapshot,
      auditEvents: [{ eventType: 'document_revision_started' }],
      correctionReason: 'Internal correction reason',
    };
    const definition = renderer.buildDocumentDefinition(
      unsafe as never,
      new Map(),
    );
    const header =
      typeof definition.header === 'function'
        ? definition.header(1, 3, {
            width: 595,
            height: 842,
            orientation: 'portrait',
          })
        : definition.header;
    const visibleJson = JSON.stringify({ definition, header });
    expect(visibleJson).toContain('Safe work');
    expect(visibleJson).not.toContain('auditEvents');
    expect(visibleJson).not.toContain('Internal correction reason');
    const pdf = await renderer.render(snapshot, new Map());
    expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1500);
  });

  it('reproduces the approved form control block and derives official time fields', () => {
    const definition = new SsomaOfficialPdfRenderer().buildDocumentDefinition(
      snapshot,
      new Map(),
    );
    const text = contentText(definition).join(' ');

    expect(text).toContain(
      'REGISTRO DE INDUCCIÓN, CAPACITACIÓN, ENTRENAMIENTO Y SIMULACROS DE EMERGENCIA',
    );
    expect(text).toContain('HSEQ-REG-036');
    expect(text).toContain('Versión: 02');
    expect(text).toContain('06/01/2026');
    expect(text).toContain('GAVA C&C S.R.L.');
    expect(text).toContain('20480347138');
    expect(text).toContain('Charla');
    expect(text).toContain('08:35');
    expect(text).toContain('0.08');
    expect(text).toContain('R.M. 050-2013-TR');
    expect(text).toContain('Expositor');
    expect(text).toContain('Responsable del Registro');
    expect(text).toContain('CARGO:');
    expect(text).toContain('DNI:');
    expect(text).not.toContain('No especificado');
  });

  it.each([
    ['few participants', 2, 1],
    ['exactly one form page', 28, 1],
    ['more than one form page', 58, 3],
  ])(
    'keeps exactly 28 official attendance rows for %s',
    (_label, count, expectedPageCount) => {
      const participants = Array.from({ length: count }, (_, index) =>
        participant(index),
      );
      const definition = new SsomaOfficialPdfRenderer().buildDocumentDefinition(
        { ...snapshot, participants },
        new Map(),
      );
      const pages = formPages(definition);

      expect(pages).toHaveLength(expectedPageCount);
      expect(
        pages.map(
          (page) =>
            tableBodies(page).find((body) => body.length >= 29)?.length ?? 0,
        ),
      ).toEqual(Array.from({ length: expectedPageCount }, () => 29));
      expect(
        pages.map((page) =>
          contentText(page).join(' ').includes('HSEQ-REG-036'),
        ),
      ).toEqual(Array.from({ length: expectedPageCount }, () => true));
      expect(
        pages.map((page) =>
          contentText(page).join(' ').includes('Observaciones:'),
        ),
      ).toEqual(Array.from({ length: expectedPageCount }, () => true));
      expect(
        pages.map((page) =>
          contentText(page).join(' ').includes('Responsable del Registro'),
        ),
      ).toEqual(Array.from({ length: expectedPageCount }, () => true));
    },
  );

  it('maps varied signature images by worker identity and fits without stretching', async () => {
    const participants = [participant(0), participant(1)];
    const wideSignature = png(160, 32);
    const tallSignature = png(32, 160);
    const renderer = new SsomaOfficialPdfRenderer();
    const signatureMap = new Map([
      [participants[0].workerId, wideSignature],
      [participants[1].workerId, tallSignature],
    ]);
    const definition = renderer.buildDocumentDefinition(
      { ...snapshot, participants },
      signatureMap,
    );
    const table = tableBodies(definition).find((body) => body.length >= 29);
    expect(table).toBeDefined();
    const signatureCells = table!
      .slice(1, 3)
      .map((row) => row[4] as Record<string, unknown>);

    expect(signatureCells.map((cell) => cell.image)).toEqual([
      `data:image/png;base64,${wideSignature.toString('base64')}`,
      `data:image/png;base64,${tallSignature.toString('base64')}`,
    ]);
    const fittedBoxes = signatureCells.map(
      (cell) => cell.fit as [number, number],
    );
    expect(
      fittedBoxes.every(([width, height]) => width > height && height === 13),
    ).toBe(true);
    expect(
      signatureCells.every((cell) => !('width' in cell) && !('height' in cell)),
    ).toBe(true);
    const rendered = await renderer.render(
      { ...snapshot, participants },
      signatureMap,
    );
    expect(rendered.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('does not place a signed image in a declined participant row', () => {
    const declined = { ...participant(0), status: 'DECLINED' as const };
    const image = png(160, 32);
    const definition = new SsomaOfficialPdfRenderer().buildDocumentDefinition(
      { ...snapshot, participants: [declined] },
      new Map([[declined.workerId, image]]),
    );
    const table = tableBodies(definition).find((body) => body.length >= 29);

    expect(table?.[1][4]).not.toHaveProperty('image');
  });

  it.each([2, 28, 58])(
    'renders %i participants into one full form per 28-row batch',
    async (count) => {
      const renderer = new SsomaOfficialPdfRenderer();
      const pdf = await renderer.render(
        {
          ...snapshot,
          participants: Array.from({ length: count }, (_, index) =>
            participant(index),
          ),
        },
        new Map(),
      );
      const pageObjects =
        pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? [];

      expect(pageObjects).toHaveLength(Math.ceil(count / 28));
    },
  );
});
