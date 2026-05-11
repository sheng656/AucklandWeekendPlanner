import { QueryCommand, PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export type SourceName = 'eventfinda' | 'ourauckland-surface' | 'aucklandforkids' | string;

export interface IngestEventInput {
  source: SourceName;
  sourceEventId: string;
  name: string;
  description?: string;
  url: string;
  datetimeStart?: string;
  datetimeEnd?: string | null;
  locationSummary?: string;
  mappedRegion?: string;
  isFree?: boolean;
  imageUrl?: string;
  sourceImageUrl?: string;
  costText?: string;
  parseWarnings?: string[];
  scrapedAt?: string;
}

// Adult content keywords for pre-filtering inappropriate events
export const ADULT_KEYWORDS = [
  'revue', 'strip', 'burlesque', '18+', 'r18',
  'adults only', 'adult only', 'male revue', 'female revue',
  'exotic dance', 'gentleman', 'lingerie', 'erotic'
];

export function isAppropriateEvent(event: { name: string; description?: string }): boolean {
  const text = `${event.name || ''} ${event.description || ''}`.toLowerCase();
  return !ADULT_KEYWORDS.some(kw => text.includes(kw));
}

export interface StoredEventItem {
  PK?: string;
  SK?: string;
  ttl?: number;
  source?: SourceName;
  canonicalSource?: SourceName;
  source_event_id?: string;
  seenInSources?: SourceName[];
  firstSeenAt?: string;
  lastSeenAt?: string;
  dedupeKey?: string;
  name?: string;
  description?: string;
  url?: string;
  datetime_start?: string;
  datetime_end?: string | null;
  location_summary?: string;
  mapped_region?: string;
  is_free?: boolean;
  image_url?: string | null;
  source_image_url?: string | null;
  cost_text?: string | null;
  parse_warnings?: string[];
  scraped_at?: string;
  [key: string]: unknown;
}

export interface DedupeOutcome {
  action: 'insert' | 'update';
  item: StoredEventItem;
  matchedItem?: StoredEventItem;
  dedupeKey: string;
}

export interface PersistEventOptions {
  dryRun?: boolean;
}

const OUR_AUCKLAND_SOURCE = 'ourauckland-surface';

function cleanText(value?: string): string {
  return (value || '').trim().replace(/\s+/g, ' ');
}

export function normalizeTitle(value?: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toAucklandDateKey(value?: string): string {
  if (!value) return '';
  
  // Normalize YYYY-M-D to YYYY-MM-DD for standard Date parsing
  // This handles formats like "2026-5-16" which are common in some WP plugins
  let normalized = value;
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(T.*)?$/);
  if (isoMatch) {
    const [_, y, m, d, t] = isoMatch;
    normalized = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${t || ''}`;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function similarityScore(left: string, right: string): number {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 0 : 1 - distance / maxLength;
}

function levenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}

export function buildDedupeKey(input: Pick<IngestEventInput, 'name' | 'datetimeStart' | 'mappedRegion'>): string {
  const title = normalizeTitle(input.name);
  const dateKey = toAucklandDateKey(input.datetimeStart);
  const region = cleanText(input.mappedRegion || 'Unknown').toLowerCase();
  return [dateKey || 'unknown-date', region || 'unknown-region', title || 'untitled'].join('::');
}

export function inferSource(record: StoredEventItem): SourceName {
  if (record.source) return record.source;
  return 'eventfinda';
}

function getItemDateKey(record: StoredEventItem): string {
  return toAucklandDateKey((record.datetime_start as string | undefined) || undefined);
}

function getRegion(record: StoredEventItem): string {
  return cleanText((record.mapped_region as string | undefined) || 'Unknown').toLowerCase();
}

function isDuplicateCandidate(existing: StoredEventItem, incoming: IngestEventInput): boolean {
  const existingDate = getItemDateKey(existing);
  const incomingDate = toAucklandDateKey(incoming.datetimeStart);
  if (!existingDate || !incomingDate || existingDate !== incomingDate) return false;

  const existingRegion = getRegion(existing);
  const incomingRegion = cleanText(incoming.mappedRegion || 'Unknown').toLowerCase();

  const titleScore = similarityScore(existing.name || '', incoming.name);
  if (buildDedupeKey({ name: existing.name || '', datetimeStart: existing.datetime_start as string | undefined, mappedRegion: existing.mapped_region as string | undefined }) ===
    buildDedupeKey({ name: incoming.name, datetimeStart: incoming.datetimeStart, mappedRegion: incoming.mappedRegion })) {
    return true;
  }

  if (existingRegion && incomingRegion && existingRegion === incomingRegion) {
    return titleScore >= 0.85;
  }

  return titleScore >= 0.95;
}

export function findMatchingRecord(records: StoredEventItem[], incoming: IngestEventInput): StoredEventItem | undefined {
  const exactKey = buildDedupeKey(incoming);
  const candidates = records.filter((record) => isDuplicateCandidate(record, incoming));

  if (!candidates.length) return undefined;

  const exactMatch = candidates.find((record) => record.dedupeKey === exactKey || buildDedupeKey({
    name: record.name || '',
    datetimeStart: record.datetime_start as string | undefined,
    mappedRegion: record.mapped_region as string | undefined,
  }) === exactKey);
  if (exactMatch) return exactMatch;

  let bestMatch = candidates[0];
  let bestScore = similarityScore(bestMatch.name || '', incoming.name);
  for (const candidate of candidates.slice(1)) {
    const score = similarityScore(candidate.name || '', incoming.name);
    if (score > bestScore) {
      bestMatch = candidate;
      bestScore = score;
    }
  }
  return bestMatch;
}

function canonicalWinner(existing: StoredEventItem, incoming: IngestEventInput): 'existing' | 'incoming' {
  const existingSource = inferSource(existing);
  if (incoming.source === OUR_AUCKLAND_SOURCE && existingSource !== OUR_AUCKLAND_SOURCE) return 'incoming';
  if (existingSource === OUR_AUCKLAND_SOURCE && incoming.source !== OUR_AUCKLAND_SOURCE) return 'existing';
  return 'existing';
}

function mergeSources(existing: SourceName[] | undefined, incoming: SourceName): SourceName[] {
  const merged = new Set<SourceName>(existing || []);
  merged.add(incoming);
  return Array.from(merged);
}

export function loadAllStoredEvents(docClient: DynamoDBDocumentClient, tableName: string): Promise<StoredEventItem[]> {
  return (async () => {
    const items: StoredEventItem[] = [];
    let lastEvaluatedKey: Record<string, unknown> | undefined;

    do {
      const response = await docClient.send(new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': 'REGION#AUCKLAND' },
        ExclusiveStartKey: lastEvaluatedKey,
      }));

      if (response.Items?.length) {
        items.push(...(response.Items as StoredEventItem[]));
      }
      lastEvaluatedKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (lastEvaluatedKey);

    return items;
  })();
}

export async function persistEventWithDedupe(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  existingRecords: StoredEventItem[],
  incoming: IngestEventInput,
  options: PersistEventOptions = {},
): Promise<DedupeOutcome> {
  const nowIso = incoming.scrapedAt || new Date().toISOString();
  const dedupeKey = buildDedupeKey(incoming);
  const matchingRecord = findMatchingRecord(existingRecords, incoming);
  const isInsert = !matchingRecord;
  const winner = matchingRecord ? canonicalWinner(matchingRecord, incoming) : 'incoming';

  const baseRecord = winner === 'incoming'
    ? (matchingRecord || null)
    : matchingRecord;

  const canonicalSource = winner === 'incoming' ? incoming.source : inferSource(matchingRecord as StoredEventItem);
  const seenInSources = mergeSources(baseRecord?.seenInSources as SourceName[] | undefined, incoming.source);
  const preservedFirstSeenAt = baseRecord?.firstSeenAt || nowIso;
  const canonicalKey = baseRecord?.PK && baseRecord?.SK
    ? { PK: baseRecord.PK as string, SK: baseRecord.SK as string }
    : { PK: 'REGION#AUCKLAND', SK: `EVENT#${incoming.datetimeStart || nowIso}#${incoming.sourceEventId}` };

  const item: StoredEventItem = {
    ...baseRecord,
    ...(
      winner === 'incoming'
        ? {
            source_event_id: incoming.sourceEventId,
            name: incoming.name,
            description: incoming.description,
            url: incoming.url,
            datetime_start: incoming.datetimeStart,
            datetime_end: incoming.datetimeEnd ?? null,
            location_summary: incoming.locationSummary || 'Unknown Location',
            mapped_region: incoming.mappedRegion || 'Unknown',
            is_free: incoming.isFree,
            image_url: incoming.imageUrl || null,
            source_image_url: incoming.sourceImageUrl || null,
            cost_text: incoming.costText || null,
            parse_warnings: incoming.parseWarnings || [],
            scraped_at: nowIso,
          }
        : {
            lastSeenAt: nowIso,
          }
    ),
    PK: canonicalKey.PK,
    SK: canonicalKey.SK,
    source: canonicalSource,
    canonicalSource,
    source_event_id: winner === 'incoming' ? incoming.sourceEventId : (baseRecord?.source_event_id || incoming.sourceEventId),
    seenInSources,
    firstSeenAt: preservedFirstSeenAt,
    lastSeenAt: nowIso,
    dedupeKey,
    ttl: baseRecord?.ttl ?? Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
  };

  if (!options.dryRun) {
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: item,
    }));
  }

  if (matchingRecord) {
    const index = existingRecords.findIndex((record) => record.PK === matchingRecord.PK && record.SK === matchingRecord.SK);
    if (index >= 0) {
      existingRecords[index] = item;
    } else {
      existingRecords.push(item);
    }
  } else {
    existingRecords.push(item);
  }

  return {
    action: isInsert ? 'insert' : 'update',
    item,
    matchedItem: matchingRecord,
    dedupeKey,
  };
}
