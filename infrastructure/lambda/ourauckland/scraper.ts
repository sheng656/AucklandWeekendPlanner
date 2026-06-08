import * as cheerio from 'cheerio';
import { WeekendRange, cleanText as sharedCleanText } from '../shared/utils';
import { mapToMacroRegion as sharedMapToMacroRegion } from '../shared/regions';

// Helper to ensure dates are clean YYYY-MM-DD HH:mm:ss in Pacific/Auckland timezone
function formatToCleanDateTime(isoString: string): string {
  try {
    // Decode any potential HTML entities that might have leaked into the ISO string
    const decoded = isoString.replace(/&#x2B;/g, '+');
    const date = new Date(decoded);
    if (isNaN(date.getTime())) return decoded;
    
    // Format using Pacific/Auckland timezone to prevent UTC server offset issues
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const part of parts) {
      partMap[part.type] = part.value;
    }
    
    let hour = partMap.hour || '00';
    if (hour === '24') hour = '00';
    
    const Y = partMap.year;
    const M = partMap.month;
    const D = partMap.day;
    const h = hour;
    const m = partMap.minute || '00';
    const s = partMap.second || '00';
    
    return `${Y}-${M}-${D} ${h}:${m}:${s}`;
  } catch {
    return isoString;
  }
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
  endAtIso?: string;
}

const WEEKDAY_WEEKEND_REGEX = /\b(sat(?:urday)?|sun(?:day)?)\b/i;
const WEEKDAY_WEEKDAY_REGEX = /\b(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?)\b/i;

const ADULT_KEYWORDS = [
  'revue', 'strip', 'burlesque', '18+', 'r18',
  'adults only', 'adult only', 'male revue', 'female revue',
  'exotic dance', 'gentleman', 'lingerie', 'erotic'
];


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

function cleanText(input?: string | null, maxLength?: number): string {
  return sharedCleanText(input, maxLength);
}

function absolutizeUrl(rawUrl: string, baseUrl: string): string {
  try {
    return new URL(rawUrl, baseUrl).toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Umbraco CMS stores media links in bracket notation: [https://ourauckland.aucklandcouncil.govt.nz/media/...]
 * absolutizeUrl treats these as relative paths and prepends the base URL, producing 404 URLs.
 * This function extracts the real URL from within the brackets before resolution.
 */
function sanitizeImageUrl(raw: string): string {
  const bracketMatch = raw.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1].trim();
  return raw;
}

function normalizeImageUrl(input: any, detailUrl: string): string | undefined {
  if (!input) return undefined;

  let raw: string | undefined;
  if (typeof input === 'string') {
    raw = input;
  } else if (Array.isArray(input) && input.length > 0) {
    // If it's an array, take the first element
    const first = input[0];
    raw = typeof first === 'string' ? first : first?.url;
  } else if (typeof input === 'object') {
    raw = input.url;
  }

  if (!raw) return undefined;
  return absolutizeUrl(sanitizeImageUrl(raw), detailUrl);
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
    // Support lazy-loaded images: real URL may be in data-src rather than src.
    // Also sanitize bracket-format URLs used by Umbraco CMS: [https://...]
    const imgEl = card.find('img').first();
    const rawImgSrc =
      imgEl.attr('src') ||
      imgEl.attr('data-src') ||
      imgEl.attr('data-lazy-src') ||
      imgEl.attr('data-original') ||
      undefined;
    const imageUrl = rawImgSrc ? sanitizeImageUrl(rawImgSrc) : undefined;

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
    // OurAuckland specific: everything inside the parent div except the h3
    const panelGroup = h3Small.parent();
    if (panelGroup.hasClass('event-panel__group')) {
      const clone = panelGroup.clone();
      clone.find('h3').remove();
      return cleanText(clone.text());
    }

    // Try to get from next <p> tag
    const nextP = h3Small.next('p');
    if (nextP.length) {
      return cleanText(nextP.text());
    }
    // Try to get from direct text in parent after h3
    const directParent = h3Small.parent();
    const allText = cleanText(directParent.text());
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

  // Fallback: regex search in body text. We clone the root and remove script/style tags
  // to prevent matching Javascript/CSS code patterns (e.g. location:null) instead of event details.
  const regex = new RegExp(`(?:${lowered.join('|')})\\s*:\\s*([^\\n\\r]+)`, 'i');
  const cleanClone = $.root().clone();
  cleanClone.find('script, style').remove();
  const bodyText = cleanText(cleanClone.text());
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

export function extractLdJson(html: string): any | null {
  const $ = cheerio.load(html);
  let data: any = null;

  $('script[type="application/ld+json"]').each((_, elem) => {
    try {
      const json = JSON.parse($(elem).html() || '');
      const items = Array.isArray(json) ? json : [json];
      const eventObj = items.find((item: any) => 
        item['@type'] === 'Event' || 
        (Array.isArray(item['@type']) && item['@type'].includes('Event'))
      );
      
      if (eventObj) {
        data = eventObj;
        return false; // break loop
      }
      return true;
    } catch (e) {
      // ignore parse errors
      return true;
    }
  });

  return data;
}

export function parseDetailEvent(html: string, detailUrl: string): DetailEventData {
  const $ = cheerio.load(html);
  const ldJson = extractLdJson(html);

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

  const rawImageCandidate =
    $('meta[property="og:image"]').attr('content') ||
    // OurAuckland uses Umbraco CMS (not WordPress), so img.wp-post-image never matches.
    // Check Umbraco/OurAuckland common image container selectors instead.
    $('figure img').first().attr('src') ||
    $('.event-image img, .hero img, .feature-image img, .article-image img').first().attr('src') ||
    $('article img').first().attr('src') ||
    undefined;
  // Sanitize Umbraco bracket-format URLs before absolutizing
  const imageUrlRaw = rawImageCandidate ? sanitizeImageUrl(rawImageCandidate) : undefined;

  return {
    title: cleanText(ldJson?.name || title),
    description: cleanText(ldJson?.description || description, 200),
    dateText,
    locationText: cleanText(ldJson?.location?.name || ldJson?.location?.address?.streetAddress || locationText),
    costText: cleanText(costText),
    imageUrl: normalizeImageUrl(ldJson?.image, detailUrl) || (imageUrlRaw ? absolutizeUrl(imageUrlRaw, detailUrl) : undefined),
    startAtIso: formatToCleanDateTime(ldJson?.startDate || parseDateTextToIso(dateText) || ''),
    endAtIso: ldJson?.endDate ? formatToCleanDateTime(ldJson?.endDate) : undefined,
  };
}

export function isAppropriateEvent(event: { title: string; description?: string }): boolean {
  const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
  return !ADULT_KEYWORDS.some((kw) => text.includes(kw));
}

export function mapToMacroRegion(locationSummary?: string): string {
  return sharedMapToMacroRegion(locationSummary);
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
