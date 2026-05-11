import { persistEventWithDedupe } from '../lambda/shared/dedupe';

describe('shared dedupe policy', () => {
  test('OurAuckland replaces an existing Eventfinda record for the same event', async () => {
    const send = jest.fn(async () => ({}));
    const docClient = { send } as any;
    const existingRecords = [{
      PK: 'REGION#AUCKLAND',
      SK: 'EVENT#2026-05-16T09:00:00.000Z#12345',
      source: 'eventfinda',
      source_event_id: '12345',
      canonicalSource: 'eventfinda',
      seenInSources: ['eventfinda'],
      firstSeenAt: '2026-05-11T00:00:00.000Z',
      lastSeenAt: '2026-05-11T00:00:00.000Z',
      dedupeKey: '2026-05-16::central auckland::family day',
      name: 'Family Day',
      datetime_start: '2026-05-16T09:00:00.000Z',
      mapped_region: 'Central Auckland',
      location_summary: 'Auckland CBD',
    }];

    const outcome = await persistEventWithDedupe(docClient, 'PlannerData', existingRecords, {
      source: 'ourauckland-surface',
      sourceEventId: 'family-day',
      name: 'Family Day',
      description: 'Family event',
      url: 'https://ourauckland.aucklandcouncil.govt.nz/events/2026/05/family-day/',
      datetimeStart: '2026-05-16T10:00:00.000+12:00',
      locationSummary: 'Takapuna Library',
      mappedRegion: 'North Shore',
      isFree: true,
      costText: 'Free',
      scrapedAt: '2026-05-11T01:00:00.000Z',
    });

    expect(outcome.action).toBe('update');
    expect(outcome.item.source).toBe('ourauckland-surface');
    expect(outcome.item.canonicalSource).toBe('ourauckland-surface');
    expect(outcome.item.seenInSources).toContain('eventfinda');
    expect(outcome.item.seenInSources).toContain('ourauckland-surface');
    expect(send).toHaveBeenCalledTimes(1);
    const mockedCalls = send.mock.calls as any[];
    const commandInput = mockedCalls[0][0].input as { TableName?: string; Item?: { source?: string } };
    expect(commandInput.TableName).toBe('PlannerData');
    expect(commandInput.Item?.source).toBe('ourauckland-surface');
  });

  test('Eventfinda keeps the first stored record when paired with Auckland for Kids', async () => {
    const send = jest.fn(async () => ({}));
    const docClient = { send } as any;
    const existingRecords = [{
      PK: 'REGION#AUCKLAND',
      SK: 'EVENT#2026-05-17T09:00:00.000Z#auckland-kids-1',
      source: 'aucklandforkids',
      source_event_id: 'auckland-kids-1',
      canonicalSource: 'aucklandforkids',
      seenInSources: ['aucklandforkids'],
      firstSeenAt: '2026-05-11T00:00:00.000Z',
      lastSeenAt: '2026-05-11T00:00:00.000Z',
      dedupeKey: '2026-05-17::north shore::science show',
      name: 'Science Show',
      datetime_start: '2026-05-17T09:00:00.000Z',
      mapped_region: 'North Shore',
      location_summary: 'Takapuna',
    }];

    const outcome = await persistEventWithDedupe(docClient, 'PlannerData', existingRecords, {
      source: 'eventfinda',
      sourceEventId: '9999',
      name: 'Science Show',
      description: 'Another source',
      url: 'https://eventfinda.co.nz/science-show',
      datetimeStart: '2026-05-17T09:00:00.000Z',
      locationSummary: 'Takapuna',
      mappedRegion: 'North Shore',
      isFree: false,
      scrapedAt: '2026-05-11T02:00:00.000Z',
    });

    expect(outcome.action).toBe('update');
    expect(outcome.item.source).toBe('aucklandforkids');
    expect(outcome.item.canonicalSource).toBe('aucklandforkids');
    expect(outcome.item.source_event_id).toBe('auckland-kids-1');
    expect(outcome.item.seenInSources).toContain('eventfinda');
    expect(outcome.item.seenInSources).toContain('aucklandforkids');
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('new unique event is inserted', async () => {
    const send = jest.fn(async () => ({}));
    const docClient = { send } as any;
    const existingRecords: any[] = [];

    const outcome = await persistEventWithDedupe(docClient, 'PlannerData', existingRecords, {
      source: 'eventfinda',
      sourceEventId: '2001',
      name: 'New Art Workshop',
      url: 'https://eventfinda.co.nz/new-art-workshop',
      datetimeStart: '2026-05-16T11:00:00.000Z',
      locationSummary: 'Ponsonby',
      mappedRegion: 'Central Auckland',
      isFree: true,
      scrapedAt: '2026-05-11T03:00:00.000Z',
    });

    expect(outcome.action).toBe('insert');
    expect(existingRecords).toHaveLength(1);
    expect(existingRecords[0].source).toBe('eventfinda');
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('dry run skips DynamoDB writes but still updates in-memory records', async () => {
    const send = jest.fn(async () => ({}));
    const docClient = { send } as any;
    const existingRecords: any[] = [];

    const outcome = await persistEventWithDedupe(docClient, 'PlannerData', existingRecords, {
      source: 'ourauckland-surface',
      sourceEventId: 'dry-run-1',
      name: 'Dry Run Event',
      url: 'https://ourauckland.aucklandcouncil.govt.nz/events/2026/05/dry-run-event/',
      datetimeStart: '2026-05-16T10:00:00.000Z',
      locationSummary: 'Takapuna',
      mappedRegion: 'North Shore',
      isFree: true,
      scrapedAt: '2026-05-11T04:00:00.000Z',
    }, { dryRun: true });

    expect(outcome.action).toBe('insert');
    expect(existingRecords).toHaveLength(1);
    expect(existingRecords[0].source).toBe('ourauckland-surface');
    expect(send).not.toHaveBeenCalled();
  });
});
