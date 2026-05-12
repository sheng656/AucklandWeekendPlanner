import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { loadAllStoredEvents, persistEventWithDedupe, isAppropriateEvent, findMatchingRecord } from '../shared/dedupe';
import { sleep, fetchWithRetry, computeUpcomingWeekendRange, cleanText } from '../shared/utils';
import { extractLdJson, mapAucklandKidsRegion } from './scraper';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

export const handler = async (event: any) => {
  console.log("Starting Auckland for Kids Ingest...");
  
  try {
    const dryRun = process.env.INGEST_DRY_RUN === 'true';
    const tableName = process.env.TABLE_NAME;
    const imageBucketName = process.env.IMAGE_BUCKET_NAME;
    const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;

    if (!tableName) {
      throw new Error('TABLE_NAME is required');
    }

    const { startDate, endDate } = computeUpcomingWeekendRange();
    const existingRecords = await loadAllStoredEvents(docClient, tableName, {
      start: startDate,
      end: endDate
    });

    // Fetch recent events from Auckland for Kids WP API
    const kidsResponse = await fetchWithRetry(`https://www.aucklandforkids.co.nz/wp-json/wp/v2/ajde_events?per_page=30&_embed`);
    if (!kidsResponse.ok) {
      throw new Error(`Auckland for Kids API failed: ${kidsResponse.status}`);
    }

    const kidsEvents = (await kidsResponse.json()) as any[];
    console.log(`Fetched ${kidsEvents.length} events from Auckland for Kids.`);

    for (const item of kidsEvents) {
      const detailUrl = item.link;
      const sourceEventId = String(item.id);

      // 1. Fetch detail page for LD+JSON
      let structuredData = null;
      try {
        const detailRes = await fetchWithRetry(detailUrl, { headers: { 'User-Agent': 'AucklandWeekendPlanner/1.0' } });
        if (detailRes.ok) {
          const html = await detailRes.text();
          structuredData = extractLdJson(html);
        }
      } catch (e) {
        console.error(`Failed to fetch detail for ${detailUrl}`, e);
      }

      if (!structuredData) {
        console.log(`Skipping ${detailUrl} - no structured data found.`);
        continue;
      }

      // 2. Map fields
      const name = cleanText(structuredData.name || item.title.rendered);
      const description = cleanText(item.content.rendered.replace(/<[^>]*>/g, ''), 200); 
      
      if (!isAppropriateEvent({ name, description })) {
        console.log(`Skipping inappropriate event: ${name}`);
        continue;
      }

      const datetimeStart = cleanText(structuredData.startDate);
      const datetimeEnd = cleanText(structuredData.endDate);
      
      const locParts = [structuredData.locationName, structuredData.streetAddress].filter(Boolean);
      const locationSummary = cleanText(locParts.length > 0 ? locParts.join(', ') : "Auckland");
      
      const regionIds = item.event_type_2 || [];
      const mappedRegion = mapAucklandKidsRegion(regionIds);

      // OPTIMIZATION: Check if event already exists
      const existingMatch = findMatchingRecord(existingRecords, {
        source: 'aucklandforkids',
        sourceEventId,
        name,
        datetimeStart,
        mappedRegion,
        url: detailUrl,
        description,
      });

      // 3. Image Processing
      let cloudfrontUrl = existingMatch?.image_url || '';
      const sourceImageUrl = item._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
      
      if (sourceImageUrl && (!cloudfrontUrl || existingMatch?.source_image_url !== sourceImageUrl)) {
        try {
          console.log(`Processing image for kids event ${sourceEventId}: Downloading from ${sourceImageUrl}`);
          if (!dryRun) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const imgResponse = await fetchWithRetry(sourceImageUrl, {
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (imgResponse.ok) {
              let arrayBuffer: any = await imgResponse.arrayBuffer();
              let buffer: any = Buffer.from(arrayBuffer);
              const objectKey = `events/kids-${sourceEventId}.jpg`;
              
              await s3Client.send(new PutObjectCommand({
                Bucket: imageBucketName,
                Key: objectKey,
                Body: buffer,
                ContentType: 'image/jpeg',
              }));
              cloudfrontUrl = `https://${cloudfrontDomain}/${objectKey}`;
              
              // Goal 2: Clear memory explicitly for GC
              (buffer as any) = null;
              (arrayBuffer as any) = null;
            }
            
            // Goal 6: Increase delay to 1.5s
            await sleep(1500);
          }
        } catch (e: any) {
          if (e.name === 'AbortError') {
            console.error(`Image download timed out for kids event ${sourceEventId}`);
          } else {
            console.error(`Image download failed for kids event ${sourceEventId}`, e);
          }
        }
        await sleep(1500);
      }

      // 4. Persist
      await persistEventWithDedupe(docClient, tableName, existingRecords, {
        source: 'aucklandforkids',
        sourceEventId,
        name,
        description,
        url: detailUrl,
        datetimeStart,
        datetimeEnd,
        locationSummary,
        mappedRegion,
        isFree: structuredData.isFree ?? description.toLowerCase().includes('free'), 
        costText: structuredData.costText,
        imageUrl: cloudfrontUrl || undefined,
        sourceImageUrl: sourceImageUrl || undefined,
        scrapedAt: new Date().toISOString(),
      }, { dryRun });
      
      await sleep(1000); 
    }

    console.log("Auckland for Kids Ingest completed successfully.");
    return { statusCode: 200, body: 'Ingest succeeded.' };
  } catch (error) {
    console.error("Auckland for Kids Ingest Error", error);
    throw error;
  }
};
