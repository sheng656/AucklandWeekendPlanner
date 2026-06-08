import {
  buildSurfaceFormBody,
  evaluateWeekendFromDateText,
  extractListCandidates,
  parseDetailEvent,
  extractLdJson,
  mapToMacroRegion,
} from '../lambda/ourauckland/scraper';
import { computeUpcomingWeekendRange } from '../lambda/shared/utils';

describe('ourauckland scraper helpers', () => {
  test('buildSurfaceFormBody keeps area and cost empty', () => {
    const body = buildSurfaceFormBody(2, '2026-05-16', '2026-05-17');

    expect(body.get('Page')).toBe('2');
    expect(body.get('SearchArea')).toBe('');
    expect(body.get('SearchCost')).toBe('');
    expect(body.get('SearchDateFrom')).toBe('2026-05-16');
    expect(body.get('SearchDateTo')).toBe('2026-05-17');
  });

  test('computeUpcomingWeekendRange returns ISO strings', () => {
    const range = computeUpcomingWeekendRange();
    expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('computeUpcomingWeekendRange is consistent (Sat to Sun)', () => {
    const ref = new Date('2026-05-11T12:00:00Z'); // Monday
    const range = computeUpcomingWeekendRange(ref);
    expect(range.startDate).toBe('2026-05-15'); // Friday
    expect(range.endDate).toBe('2026-05-17');   // Sunday
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

describe('ourauckland scraper specific improvements', () => {
  test('extractLdJson parses event data correctly', () => {
    const html = `
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": "JSON-LD Event",
        "startDate": "2026-05-16T10:00:00Z",
        "endDate": "2026-05-16T15:00:00Z",
        "location": {
          "@type": "Place",
          "name": "Auckland Central Library"
        }
      }
      </script>
    `;
    const data = extractLdJson(html);
    expect(data.name).toBe('JSON-LD Event');
    expect(data.startDate).toBe('2026-05-16T10:00:00Z');
    expect(data.endDate).toBe('2026-05-16T15:00:00Z');
  });

  test('parseDetailEvent includes endAtIso from LD+JSON', () => {
    const html = `
      <html>
        <body>
          <script type="application/ld+json">
          {
            "@type": "Event",
            "name": "Timed Event",
            "startDate": "2026-05-16T09:00:00Z",
            "endDate": "2026-05-16T17:00:00Z"
          }
          </script>
        </body>
      </html>
    `;
    const result = parseDetailEvent(html, 'http://test.com');
    expect(result.startAtIso).toBe('2026-05-16 21:00:00');
    expect(result.endAtIso).toBe('2026-05-17 05:00:00');
  });

  test('mapToMacroRegion correctly identifies Blockhouse Bay', () => {
    expect(mapToMacroRegion('Blockhouse Bay Library')).toBe('West Auckland');
    expect(mapToMacroRegion('578 Blockhouse Bay Road')).toBe('West Auckland');
    expect(mapToMacroRegion('Britomart Transport Centre')).toBe('Central Auckland');
    expect(mapToMacroRegion('Takapuna Beach')).toBe('North Shore');
    expect(mapToMacroRegion('Middle of nowhere')).toBe('Unknown');
  });

  test('parseDetailEvent handles array image in JSON-LD', () => {
    const html = `
      <html>
        <body>
          <script type="application/ld+json">
          {
            "@type": "Event",
            "name": "Array Image Event",
            "image": ["https://test.com/img1.jpg", "https://test.com/img2.jpg"]
          }
          </script>
        </body>
      </html>
    `;
    const result = parseDetailEvent(html, 'http://test.com');
    expect(result.imageUrl).toBe('https://test.com/img1.jpg');
  });

  test('parseDetailEvent decodes html entity macron characters in location name from LD+JSON', () => {
    const html = `
      <html>
        <body>
          <script type="application/ld+json">
          {
            "@type": "Event",
            "name": "Mindful creative colouring",
            "location": {
              "@type": "Place",
              "name": "&#x14C;rewa Library"
            }
          }
          </script>
        </body>
      </html>
    `;
    const result = parseDetailEvent(html, 'http://test.com');
    expect(result.locationText).toBe('Ōrewa Library');
  });

  test('parseDetailEvent ignores script tags when looking for locations', () => {
    const html = `
      <html>
        <head>
          <script>
            // some script configuration
            var config = {
              location: "null;e[C]='https://'+dc.services.visualstudio.com"
            };
          </script>
        </head>
        <body>
          <h1>Event Title</h1>
          <p>Where: Takapuna Library</p>
        </body>
      </html>
    `;
    const result = parseDetailEvent(html, 'http://test.com');
    expect(result.locationText).toBe('Takapuna Library');
  });
});
