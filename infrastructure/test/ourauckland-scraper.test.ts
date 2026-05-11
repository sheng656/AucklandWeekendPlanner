import {
  buildSurfaceFormBody,
  computeUpcomingWeekendRangeNZ,
  evaluateWeekendFromDateText,
  extractListCandidates,
  parseDetailEvent,
} from '../lambda/ourauckland/scraper';

describe('ourauckland scraper helpers', () => {
  test('buildSurfaceFormBody keeps area and cost empty', () => {
    const body = buildSurfaceFormBody(2, '2026-05-16', '2026-05-17');

    expect(body.get('Page')).toBe('2');
    expect(body.get('SearchArea')).toBe('');
    expect(body.get('SearchCost')).toBe('');
    expect(body.get('SearchDateFrom')).toBe('2026-05-16');
    expect(body.get('SearchDateTo')).toBe('2026-05-17');
  });

  test('computeUpcomingWeekendRangeNZ returns YYYY-MM-DD bounds', () => {
    const range = computeUpcomingWeekendRangeNZ(new Date('2026-05-11T00:00:00Z'));
    expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.startDate <= range.endDate).toBe(true);
  });

  test('extractListCandidates gets unique event detail URLs', () => {
    const html = `
      <div>
        <article>
          <a href="/events/2026/05/family-day/">Family day</a>
          <time>Saturday 16 May</time>
        </article>
        <article>
          <a href="/events/2026/05/family-day/">Family day duplicate</a>
        </article>
        <article>
          <a href="/events/2026/05/science-show/">Science show</a>
        </article>
      </div>
    `;

    const rows = extractListCandidates(html, 'https://ourauckland.aucklandcouncil.govt.nz');
    expect(rows).toHaveLength(2);
    expect(rows[0].detailUrl).toContain('/events/2026/05/family-day/');
    expect(rows[1].detailUrl).toContain('/events/2026/05/science-show/');
  });

  test('parseDetailEvent extracts date, location and cost from labeled sections', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Clay Creations" />
          <meta property="og:image" content="/media/test.jpg" />
        </head>
        <body>
          <h1>Clay Creations</h1>
          <dl>
            <dt>When</dt><dd>Saturday 16 May 2026 10:00am</dd>
            <dt>Where</dt><dd>Takapuna Library</dd>
            <dt>Cost</dt><dd>Free</dd>
          </dl>
        </body>
      </html>
    `;

    const result = parseDetailEvent(html, 'https://ourauckland.aucklandcouncil.govt.nz/events/2026/05/clay-creations/');
    expect(result.title).toBe('Clay Creations');
    expect(result.dateText).toContain('Saturday');
    expect(result.locationText).toContain('Takapuna');
    expect(result.costText).toBe('Free');
    expect(result.imageUrl).toContain('/media/test.jpg');
    expect(result.startAtIso).toBeTruthy();
  });

  test('evaluateWeekendFromDateText identifies weekday and weekend', () => {
    expect(evaluateWeekendFromDateText('Saturday 16 May 2026')).toBe(true);
    expect(evaluateWeekendFromDateText('Tuesday 19 May 2026')).toBe(false);
    expect(evaluateWeekendFromDateText('16 May 2026')).toBeUndefined();
  });

  test('parseDetailEvent extracts from OurAuckland event-panel structure', () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Microgreens workshop for kids" />
          <meta property="og:image" content="https://ourauckland.aucklandcouncil.govt.nz/media/m0kfv4cw/kids-microgreens_uxka1mmv.png" />
        </head>
        <body>
          <h1>Microgreens workshop for kids</h1>
          <div class="event-panel__group">
            <h3 class="small">Where</h3>
            <p>Regionwide</p>
          </div>
          <div class="event-panel__group">
            <h3 class="small">When</h3>
            <p>Thursday 9 April 2026 - Thursday 17 December 2026</p>
          </div>
          <div class="event-panel__group">
            <h3 class="small">Cost</h3>
            Free
          </div>
          <article>
            <p>A fun, hands-on microgreens workshop for kids and their caregivers.</p>
          </article>
        </body>
      </html>
    `;

    const result = parseDetailEvent(html, 'https://ourauckland.aucklandcouncil.govt.nz/events/2026/01/microgreens-workshop-for-kids/');
    expect(result.title).toBe('Microgreens workshop for kids');
    expect(result.locationText).toBe('Regionwide');
    expect(result.dateText).toContain('April 2026');
    expect(result.costText).toBe('Free');
    expect(result.description).toContain('microgreens workshop');
  });
});
