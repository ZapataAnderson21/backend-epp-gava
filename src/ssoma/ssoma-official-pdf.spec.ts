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
});
