/**
 * Decodes common HTML entities found in scraped content
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x2B;/g, '+')
    .replace(/&#xA0;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x101;/g, 'a') // Toi o Tamaki handling
    .replace(/&#x113;/g, 'e')
    .replace(/&#x12B;/g, 'i')
    .replace(/&#x14D;/g, 'o')
    .replace(/&#x16B;/g, 'u')
    .replace(/&#x[0-9a-fA-F]+;/g, (match) => {
       // Generic hex entities handling if needed, or just remove
       return match; 
    });
}

/**
 * Cleans whitespace, decodes entities, and optionally truncates text
 */
export function cleanText(input?: string | null, maxLength?: number): string {
  if (!input) return '';
  let cleaned = decodeHtmlEntities(input)
    .replace(/\s+/g, ' ')
    .trim();
  
  if (maxLength && cleaned.length > maxLength) {
    return cleaned.substring(0, maxLength) + '...';
  }
  return cleaned;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface WeekendRange {
  startDate: string;
  endDate: string;
}

/**
 * Computes the upcoming Friday to Sunday range for Auckland timezone.
 * Returns ISO dates (YYYY-MM-DD).
 */
export function computeUpcomingWeekendRange(reference = new Date()): WeekendRange {
  const nowInNz = new Date(reference.toLocaleString('en-US', { timeZone: 'Pacific/Auckland' }));
  const day = nowInNz.getDay();
  
  // Friday is day 5. If today is Friday/Sat/Sun, it stays on this weekend.
  // Otherwise, it looks forward to the next Friday.
  const daysUntilFriday = (5 - day + 7) % 7;
  const friday = new Date(nowInNz);
  friday.setDate(nowInNz.getDate() + daysUntilFriday);
  
  const sunday = new Date(friday);
  sunday.setDate(friday.getDate() + 2);

  const format = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  return {
    startDate: format(friday),
    endDate: format(sunday)
  };
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3,
  backoff = 1000
): Promise<Response> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      if (response.status >= 500 || response.status === 429) {
        // Retry on server errors or rate limits
        console.warn(`Retry ${i + 1}/${retries} for ${url} due to status ${response.status}`);
      } else {
        // Don't retry on client errors (4xx)
        return response;
      }
    } catch (err) {
      lastError = err;
      console.warn(`Retry ${i + 1}/${retries} for ${url} due to error:`, err);
    }
    await sleep(backoff * (i + 1));
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${retries} retries`);
}
