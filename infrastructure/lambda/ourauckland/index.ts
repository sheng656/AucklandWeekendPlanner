import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  buildSurfaceFormBody,
  computeUpcomingWeekendRangeNZ,
  deriveSourceEventId,
  estimateIsFree,
  evaluateWeekendFromDateText,
  extractListCandidates,
  isAppropriateEvent,
  mapToMacroRegion,
  parseDetailEvent,
} from './scraper';
import { loadAllStoredEvents, persistEventWithDedupe } from '../shared/dedupe';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

const DEFAULT_ENDPOINT = 'https://ourauckland.aucklandcouncil.govt.nz/umbraco/surface/EventSurface/GetSearchResults';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let lastError: unknown;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (err) {
      lastError = err;
    }

    if (i < attempts) {
      const backoffMs = i * 1000;
      await sleep(backoffMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed after retries');
}

async function uploadImageToS3(imageUrl: string, sourceEventId: string): Promise<string> {
  const bucket = process.env.IMAGE_BUCKET_NAME;
  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;
  if (!bucket || !cloudfrontDomain) return '';

  try {
    const imgResponse = await fetchWithRetry(
      imageUrl,
      { headers: { 'User-Agent': 'AucklandWeekendPlanner/1.0' } },
      2,
    );

    const arrayBuffer = await imgResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const objectKey = `events/ourauckland-${sourceEventId}.jpg`;

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: buffer,
      ContentType: imgResponse.headers.get('content-type') || 'image/jpeg',
    }));

    return `https://${cloudfrontDomain}/${objectKey}`;
  } catch (err) {
    console.error('Image upload failed for event', sourceEventId, err);
    return '';
  }
}

export const handler = async (): Promise<{ statusCode: number; body: string }> => {
  const dryRun = process.env.INGEST_DRY_RUN === 'true';
  const endpoint = process.env.OURAUCKLAND_SURFACE_ENDPOINT || DEFAULT_ENDPOINT;
  const timeoutMs = Number(process.env.OURAUCKLAND_TIMEOUT_MS || '15000');
  const listDelayMs = Number(process.env.OURAUCKLAND_LIST_DELAY_MS || '300');
  const detailDelayMs = Number(process.env.OURAUCKLAND_DETAIL_DELAY_MS || '300');
  const maxPages = Number(process.env.OURAUCKLAND_MAX_PAGES || '12');
  const maxDetails = Number(process.env.OURAUCKLAND_MAX_DETAILS_PER_RUN || '300');
  const tableName = process.env.TABLE_NAME;

  if (!tableName) {
    throw new Error('TABLE_NAME is required');
  }

  const { startDate, endDate } = computeUpcomingWeekendRangeNZ();
  console.log(`OurAuckland ingest started for weekend ${startDate} to ${endDate}`);

  const allCandidates: ReturnType<typeof extractListCandidates> = [];
  const pageFingerprints = new Set<string>();
  const existingRecords = await loadAllStoredEvents(docClient, tableName);

  for (let page = 1; page <= maxPages; page += 1) {
    const body = buildSurfaceFormBody(page, startDate, endDate);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let html = '';
    try {
      const response = await fetchWithRetry(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          accept: 'text/html, */*; q=0.01',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'x-requested-with': 'XMLHttpRequest',
          'user-agent': 'AucklandWeekendPlanner/1.0',
          origin: 'https://ourauckland.aucklandcouncil.govt.nz',
          referer: 'https://ourauckland.aucklandcouncil.govt.nz/events/',
        },
        body,
      });
      html = await response.text();
    } finally {
      clearTimeout(timer);
    }

    const listCandidates = extractListCandidates(html, 'https://ourauckland.aucklandcouncil.govt.nz');
    const fingerprint = listCandidates.map((c) => c.detailUrl).slice(0, 20).join('|');

    if (!listCandidates.length) {
      console.log(`No list candidates found on page ${page}. Stop pagination.`);
      break;
    }
    if (fingerprint && pageFingerprints.has(fingerprint)) {
      console.log(`Duplicate page fingerprint on page ${page}. Stop pagination.`);
      break;
    }

    pageFingerprints.add(fingerprint);
    allCandidates.push(...listCandidates);
    console.log(`Page ${page}: extracted ${listCandidates.length} candidates`);

    await sleep(listDelayMs);
  }

  const dedupCandidates = Array.from(new Map(allCandidates.map((c) => [c.detailUrl, c])).values()).slice(0, maxDetails);
  console.log(`Proceeding with ${dedupCandidates.length} unique detail pages`);

  let stored = 0;
  let skippedNotWeekend = 0;
  let skippedAdult = 0;

  for (const candidate of dedupCandidates) {
    const sourceEventId = deriveSourceEventId(candidate.detailUrl);
    const warnings: string[] = [];

    try {
      const detailResponse = await fetchWithRetry(candidate.detailUrl, {
        method: 'GET',
        headers: { 'user-agent': 'AucklandWeekendPlanner/1.0' },
      });
      const detailHtml = await detailResponse.text();

      const parsed = parseDetailEvent(detailHtml, candidate.detailUrl);
      const title = parsed.title || candidate.title;
      const description = parsed.description;

      if (!isAppropriateEvent({ title, description })) {
        skippedAdult += 1;
        continue;
      }

      const weekendHint = evaluateWeekendFromDateText(parsed.dateText || candidate.dateSnippet);
      if (weekendHint === false) {
        skippedNotWeekend += 1;
        continue;
      }
      if (weekendHint === undefined) {
        warnings.push('weekend_unconfirmed_from_text');
      }

      const eventStart = parsed.startAtIso || `${startDate}T00:00:00.000Z`;
      const locationSummary = parsed.locationText || 'Unknown Location';
      const mappedRegion = mapToMacroRegion(locationSummary);
      const isFree = estimateIsFree(parsed.costText);

      const imageUrlCandidate = parsed.imageUrl || candidate.imageUrl || '';
      const cloudfrontUrl = !dryRun && imageUrlCandidate ? await uploadImageToS3(imageUrlCandidate, sourceEventId) : '';

      if (dryRun) {
        console.log(`DRY_RUN would persist OurAuckland event ${sourceEventId}`);
      }

      await persistEventWithDedupe(docClient, tableName, existingRecords, {
        source: 'ourauckland-surface',
        sourceEventId,
        name: title,
        description,
        url: candidate.detailUrl,
        datetimeStart: eventStart,
        datetimeEnd: null,
        locationSummary,
        mappedRegion,
        isFree,
        imageUrl: cloudfrontUrl || undefined,
        sourceImageUrl: imageUrlCandidate || undefined,
        costText: parsed.costText,
        parseWarnings: warnings,
        scrapedAt: new Date().toISOString(),
      }, { dryRun });

      stored += 1;
    } catch (err) {
      console.error(`Detail fetch/parse failed for ${candidate.detailUrl}`, err);
    }

    await sleep(detailDelayMs);
  }

  const summary = {
    startDate,
    endDate,
    discoveredCandidates: allCandidates.length,
    processedDetails: dedupCandidates.length,
    stored,
    skippedNotWeekend,
    skippedAdult,
  };

  console.log('OurAuckland ingest finished', summary);
  return {
    statusCode: 200,
    body: JSON.stringify(summary),
  };
};
