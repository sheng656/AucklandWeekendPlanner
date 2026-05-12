import * as cheerio from 'cheerio';

export interface AucklandKidsEvent {
  id: number;
  title: string;
  link: string;
  description: string;
  imageUrl?: string;
  regions: string[];
}

export interface StructuredEventData {
  name: string;
  startDate: string;
  endDate?: string;
  locationName?: string;
  streetAddress?: string;
  isFree?: boolean;
  costText?: string;
}

function normalizeDateString(value?: string): string {
  if (!value) return '';
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(T.*)?$/);
  if (isoMatch) {
    const [_, y, m, d, t] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${t || ''}`;
  }
  return value;
}

/**
 * Extracts LD+JSON from the provided HTML.
 */
export function extractLdJson(html: string): StructuredEventData | null {
  const $ = cheerio.load(html);
  let data: any = null;

  $('script[type="application/ld+json"]').each((_, elem) => {
    try {
      const content = $(elem).html();
      if (!content) return;
      const json = JSON.parse(content);
      
      // EventON typically outputs an Event object or an array of objects
      const items = Array.isArray(json) ? json : [json];
      const eventObj = items.find((item: any) => item['@type'] === 'Event');
      
      if (eventObj) {
        const loc = Array.isArray(eventObj.location) ? eventObj.location[0] : eventObj.location;
        const offer = Array.isArray(eventObj.offers) ? eventObj.offers[0] : eventObj.offers;
        
        let isFree = false;
        if (offer) {
          const price = parseFloat(offer.price);
          if (price === 0) isFree = true;
        }
        data = {
          name: eventObj.name,
          startDate: normalizeDateString(eventObj.startDate),
          endDate: normalizeDateString(eventObj.endDate),
          locationName: loc?.name,
          streetAddress: loc?.address?.streetAddress,
          isFree,
          costText: undefined,
        };

        // Try to get cost from DOM as enrichment
        const costFromDom = extractCostFromDom($);
        if (costFromDom) {
          data.costText = costFromDom;
          if (costFromDom.toLowerCase().includes('free')) {
            data.isFree = true;
          }
        }

        return false; // break loop
      }
    } catch (e) {
      // Ignore parse errors for specific script blocks
    }
    return true; // continue loop
  });

  return data;
}

/**
 * Extracts cost information from EventOn specific DOM elements.
 */
function extractCostFromDom($: cheerio.CheerioAPI): string | undefined {
  // 1. Check custom field 1 (often used for Price in Auckland for Kids)
  const priceRow = $('.evo_metarow_cusF1');
  if (priceRow.length) {
    const label = priceRow.find('h3.evo_h3').text().toLowerCase();
    if (label.includes('price') || label.includes('cost')) {
      const value = priceRow.find('.evo_custom_content_in').text().replace(/\s+/g, ' ').trim();
      if (value) return value;
    }
  }

  // 2. Check event types (often contains "Free")
  const eventTypeRow = $('.evoet_eventtypes');
  if (eventTypeRow.length) {
    const label = eventTypeRow.find('i.evoetet_val').text().toLowerCase();
    if (label.includes('event type')) {
      const value = eventTypeRow.find('em.evoetet_val').text().replace(/\s+/g, ' ').trim();
      if (value) return value;
    }
  }

  // 3. Fallback: Generic search for "Cost" or "Price" in metadata rows
  let fallbackValue: string | undefined = undefined;
  $('.evcal_evdata_row').each((_, elem) => {
    const row = $(elem);
    const label = row.find('h3').text().toLowerCase();
    if (label.includes('price') || label.includes('cost')) {
      const value = row.find('.evcal_evdata_cell').text().replace(/\s+/g, ' ').trim();
      if (value) {
        fallbackValue = value;
        return false; // break loop
      }
    }
    return true;
  });

  return fallbackValue;
}

/**
 * Maps Auckland for Kids regions (event_type_2) to app macro regions.
 */
export function mapAucklandKidsRegion(regionIds: number[]): string {
  const idToMacro: Record<number, string> = {
    20: 'Central Auckland',
    19: 'North Shore',
    23: 'West Auckland',
    22: 'South Auckland',
    21: 'East Auckland',
    346: 'Waiheke Island',
  };

  for (const id of regionIds) {
    if (idToMacro[id]) return idToMacro[id];
  }
  
  return 'Unknown';
}
