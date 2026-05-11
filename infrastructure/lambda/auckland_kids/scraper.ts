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
        };
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
