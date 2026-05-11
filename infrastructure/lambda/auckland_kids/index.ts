import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { loadAllStoredEvents, persistEventWithDedupe, isAppropriateEvent } from '../shared/dedupe';
import { extractLdJson, mapAucklandKidsRegion } from './scraper';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const s3Client = new S3Client({});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

    const existingRecords = await loadAllStoredEvents(docClient, tableName);

    // Fetch recent events from Auckland for Kids WP API
    const kidsResponse = await fetch(`https://www.aucklandforkids.co.nz/wp-json/wp/v2/ajde_events?per_page=30&_embed`);
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
        const detailRes = await fetch(detailUrl, { headers: { 'User-Agent': 'AucklandWeekendPlanner/1.0' } });
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
      const name = structuredData.name || item.title.rendered;
      const description = item.content.rendered.replace(/<[^>]*>/g, '').slice(0, 500); 
      
      if (!isAppropriateEvent({ name, description })) {
        console.log(`Skipping inappropriate event: ${name}`);
        continue;
      }

      const datetimeStart = structuredData.startDate;
      const datetimeEnd = structuredData.endDate;
      const locationSummary = structuredData.locationName || structuredData.streetAddress || "Auckland";
      
      const regionIds = item.event_type_2 || [];
      const mappedRegion = mapAucklandKidsRegion(regionIds);

      // 3. Image Processing
      let cloudfrontUrl = '';
      const sourceImageUrl = item._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';
      
      if (sourceImageUrl && !dryRun) {
        try {
          const imgResponse = await fetch(sourceImageUrl);
          if (imgResponse.ok) {
            const arrayBuffer = await imgResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const objectKey = `events/kids-${sourceEventId}.jpg`;
            
            await s3Client.send(new PutObjectCommand({
              Bucket: imageBucketName,
              Key: objectKey,
              Body: buffer,
              ContentType: 'image/jpeg',
            }));
            cloudfrontUrl = `https://${cloudfrontDomain}/${objectKey}`;
          }
        } catch (e) {
          console.error(`Image download failed for kids event ${sourceEventId}`, e);
        }
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
        isFree: description.toLowerCase().includes('free'), 
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
