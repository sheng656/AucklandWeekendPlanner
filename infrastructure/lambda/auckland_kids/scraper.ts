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
  startDate?: string;
  endDate?: string;
  locationName?: string;
  streetAddress?: string;
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
        data = {
          name: eventObj.name,
          startDate: eventObj.startDate,
          endDate: eventObj.endDate,
          locationName: eventObj.location?.name,
          streetAddress: eventObj.location?.address?.streetAddress,
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
