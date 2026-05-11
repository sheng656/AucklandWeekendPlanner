import * as cheerio from 'cheerio';

export interface WeekendRange {
  startDate: string;
  endDate: string;
}

export interface ListEventCandidate {
  title: string;
  detailUrl: string;
  dateSnippet?: string;
  imageUrl?: string;
}

export interface DetailEventData {
  title: string;
  description?: string;
  dateText?: string;
  locationText?: string;
  costText?: string;
  imageUrl?: string;
  startAtIso?: string;
}

const WEEKDAY_WEEKEND_REGEX = /\b(sat(?:urday)?|sun(?:day)?)\b/i;
const WEEKDAY_WEEKDAY_REGEX = /\b(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?)\b/i;

const ADULT_KEYWORDS = [
  'revue', 'strip', 'burlesque', '18+', 'r18',
  'adults only', 'adult only', 'male revue', 'female revue',
  'exotic dance', 'gentleman', 'lingerie', 'erotic'
];

const REGION_MAPPING: Record<string, string[]> = {
  'Central Auckland': [
    'cbd', 'central', 'ponsonby', 'parnell', 'newmarket', 'mt eden', 'mount eden',
    'epsom', 'grey lynn', 'pt chev', 'point chevalier', 'mt albert', 'mount albert',
    'mission bay', 'st heliers', 'remuera', 'onehunga', 'ellerslie', 'greenlane',
    'kingsland', 'grafton', 'newton', 'freemans bay', 'herne bay', 'sylvia park'
  ],
  'North Shore': [
    'north shore', 'takapuna', 'albany', 'devonport', 'milford', 'birkenhead',
    'glenfield', 'northcote', 'browns bay', 'wairau', 'castor bay', 'mokoia',
    'beach haven', 'sunnynook', 'rothesay', 'orewa', 'whangaparaoa', 'silverdale'
  ],
  'West Auckland': [
    'west auckland', 'henderson', 'titirangi', 'new lynn', 'massey', 'te atatu',
    'hobsonville', 'kumeu', 'piha', 'glen eden', 'kelston', 'huapai', 'muriwai',
    'swanson', 'ranui', 'waitakere'
  ],
  'South Auckland': [
    'south auckland', 'manukau', 'papatoetoe', 'mangere', 'manurewa', 'papakura',
    'pukekohe', 'otahuhu', 'takanini', 'karaka', 'weymouth', 'wiri', 'franklin'
  ],
  'East Auckland': [
    'east auckland', 'howick', 'pakuranga', 'botany', 'half moon bay', 'flat bush',
    'clevedon', 'dannemora', 'highland park', 'bucklands beach', 'whitford'
  ],
  'Waiheke Island': [
    'waiheke', 'oneroa', 'onetangi', 'surfdale', 'ostend', 'matiatia'
  ]
};

export function computeUpcomingWeekendRangeNZ(reference = new Date()): WeekendRange {
  const nowInNz = new Date(reference.toLocaleString('en-US', { timeZone: 'Pacific/Auckland' }));
  const day = nowInNz.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  const saturday = new Date(nowInNz);
  saturday.setDate(nowInNz.getDate() + daysUntilSaturday);
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);

  const format = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  return {
    startDate: format(saturday),
    endDate: format(sunday)
  };
}

export function buildSurfaceFormBody(page: number, startDate: string, endDate: string): URLSearchParams {
  const body = new URLSearchParams();
  body.set('Page', String(page));
  body.set('SearchArea', '');
  body.set('SearchQuickDate', '');
  body.set('SearchArg', '');
  body.set('SearchCategory', '');
  body.set('SearchDateFrom', startDate);
  body.set('SearchDateTo', endDate);
  body.set('SearchCost', '');
  return body;
}

function cleanText(input?: string | null): string {
  return (input || '').replace(/\s+/g, ' ').trim();
}

function absolutizeUrl(rawUrl: string, baseUrl: string): string {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return rawUrl;
  }
}

export function extractListCandidates(html: string, baseUrl: string): ListEventCandidate[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const out: ListEventCandidate[] = [];

  $('a[href*="/events/"]').each((_, elem) => {
    const href = $(elem).attr('href');
    if (!href) return;
    const detailUrl = absolutizeUrl(href, baseUrl);
    if (seen.has(detailUrl)) return;

    const card = $(elem).closest('article, li, .event, .search-result, .result, .card, div');
    const titleFromLink = cleanText($(elem).text());
    const titleFromCard = cleanText(card.find('h1, h2, h3, .title, .event-title').first().text());
    const dateSnippet = cleanText(card.find('time, .date, .event-date, .when').first().text()) || undefined;
    const imageUrl = card.find('img').first().attr('src') || undefined;

    const title = titleFromCard || titleFromLink || 'Untitled event';
    out.push({ title, detailUrl, dateSnippet, imageUrl: imageUrl ? absolutizeUrl(imageUrl, baseUrl) : undefined });
    seen.add(detailUrl);
  });

  return out;
}

function getByLabeledBlock($: cheerio.CheerioAPI, labels: string[]): string | undefined {
  const lowered = labels.map((l) => l.toLowerCase());

  // OurAuckland pattern: <div class="event-panel__group"><h3 class="small">Where</h3><p>Location</p></div>
  // Look for h3.small with matching label, then get text from next p or direct text content
  const h3Small = $('h3.small').filter((_, el) => {
    const text = cleanText($(el).text()).toLowerCase().replace(/:$/, '');
    return lowered.includes(text);
  }).first();

  if (h3Small.length) {
    // Try to get from next <p> tag
    const nextP = h3Small.next('p');
    if (nextP.length) {
      return cleanText(nextP.text());
    }
    // Try to get from direct text in parent after h3
    const parent = h3Small.parent();
    const allText = cleanText(parent.text());
    const labelText = cleanText(h3Small.text());
    const remaining = allText.replace(labelText, '').trim();
    if (remaining) return remaining;
  }

  // Fallback: dt/dd pattern
  const dtValue = $('dt').filter((_, el) => {
    const text = cleanText($(el).text()).toLowerCase().replace(/:$/, '');
    return lowered.includes(text);
  }).first().next('dd');
  const dtText = cleanText(dtValue.text());
  if (dtText) return dtText;

  // Fallback: generic heading+sibling pattern
  const heading = $('h1,h2,h3,h4,strong,b,p,span,div').filter((_, el) => {
    const text = cleanText($(el).text()).toLowerCase();
    return lowered.some((l) => text === l || text.startsWith(`${l}:`));
  }).first();

  if (heading.length) {
    const sibling = cleanText(heading.next().text());
    if (sibling) return sibling;
    const inline = cleanText(heading.text()).replace(/^([^:]+):\s*/i, '');
    if (inline && !lowered.includes(inline.toLowerCase())) return inline;
  }

  // Fallback: regex search in body text
  const regex = new RegExp(`(?:${lowered.join('|')})\\s*:\\s*([^\\n\\r]+)`, 'i');
  const bodyText = cleanText($.root().text());
  const match = bodyText.match(regex);
  if (match?.[1]) return cleanText(match[1]);

  return undefined;
}

export function parseDateTextToIso(dateText?: string): string | undefined {
  if (!dateText) return undefined;

  const normalized = cleanText(dateText)
    .replace(/\b(when|date|time)\b:?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const parsed = Date.parse(normalized);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();

  const dmyMatch = normalized.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (!dmyMatch) return undefined;

  const fallback = Date.parse(`${dmyMatch[1]} ${dmyMatch[2]} ${dmyMatch[3]} 12:00:00 GMT+12`);
  if (Number.isNaN(fallback)) return undefined;
  return new Date(fallback).toISOString();
}

export function evaluateWeekendFromDateText(dateText?: string): boolean | undefined {
  if (!dateText) return undefined;
  const text = dateText.toLowerCase();
  if (WEEKDAY_WEEKEND_REGEX.test(text)) return true;
  if (WEEKDAY_WEEKDAY_REGEX.test(text)) return false;
  return undefined;
}

export function parseDetailEvent(html: string, detailUrl: string): DetailEventData {
  const $ = cheerio.load(html);

  const metaTitle = cleanText($('meta[property="og:title"]').attr('content'));
  const title =
    cleanText($('h1').first().text()) ||
    metaTitle ||
    cleanText($('title').first().text()) ||
    'Untitled event';

  const description = cleanText(
    $('meta[property="og:description"]').attr('content') ||
    $('article p').first().text() ||
    $('.content p').first().text()
  ) || undefined;

  const dateText =
    getByLabeledBlock($, ['when', 'date', 'time']) ||
    cleanText($('time').first().text()) ||
    undefined;

  const locationText =
    getByLabeledBlock($, ['where', 'location', 'venue', 'address']) ||
    undefined;

  const costText =
    getByLabeledBlock($, ['cost', 'price', 'entry', 'admission']) ||
    undefined;

  const imageUrlRaw =
    $('meta[property="og:image"]').attr('content') ||
    $('img.wp-post-image').first().attr('src') ||
    $('article img').first().attr('src') ||
    undefined;

  return {
    title,
    description,
    dateText,
    locationText,
    costText,
    imageUrl: imageUrlRaw ? absolutizeUrl(imageUrlRaw, detailUrl) : undefined,
    startAtIso: parseDateTextToIso(dateText)
  };
}

export function isAppropriateEvent(event: { title: string; description?: string }): boolean {
  const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
  return !ADULT_KEYWORDS.some((kw) => text.includes(kw));
}

export function mapToMacroRegion(locationSummary?: string): string {
  if (!locationSummary) return 'Unknown';
  const locLower = locationSummary.toLowerCase();
  for (const [region, keywords] of Object.entries(REGION_MAPPING)) {
    if (keywords.some((kw) => locLower.includes(kw))) return region;
  }
  return 'Unknown';
}

export function deriveSourceEventId(detailUrl: string): string {
  const slug = detailUrl
    .replace(/\?.*$/, '')
    .replace(/\/$/, '')
    .split('/')
    .pop();
  return slug || Buffer.from(detailUrl).toString('base64').slice(0, 24);
}

export function estimateIsFree(costText?: string): boolean | undefined {
  if (!costText) return undefined;
  const text = costText.toLowerCase();
  if (text.includes('free')) return true;
  if (text.includes('paid') || text.includes('$') || text.includes('from ')) return false;
  return undefined;
}
