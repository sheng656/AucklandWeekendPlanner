import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { loadAllStoredEvents, persistEventWithDedupe, isAppropriateEvent, findMatchingRecord } from '../shared/dedupe';
import { sleep, fetchWithRetry, computeTwoWeekendRanges, cleanText } from '../shared/utils';
import { mapToMacroRegion } from '../shared/regions';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const ssmClient = new SSMClient({});
const s3Client = new S3Client({});



// A utility function to fetch Eventfinda configuration from SSM Parameter Store
async function getEventfindaConfig() {
  const response = await ssmClient.send(new GetParametersByPathCommand({
    Path: process.env.SSM_PATH || '/AucklandPlanner/Config',
    WithDecryption: true,
  }));
  
  const config: Record<string, string> = {};
  response.Parameters?.forEach((p: any) => {
    const key = p.Name?.split('/').pop();
    if (key && p.Value) config[key] = p.Value;
  });
  
  return {
    username: config['EVENTFINDA_USERNAME'] || '',
    password: config['EVENTFINDA_PASSWORD'] || ''
  };
}

export const handler = async (event: any) => {
  console.log("Starting Pre-Warming Cron Job for Eventfinda Data...");
  
  try {
    const dryRun = process.env.INGEST_DRY_RUN === 'true';
    const ssmConfig = await getEventfindaConfig();
    const token = Buffer.from(`${ssmConfig.username}:${ssmConfig.password}`).toString('base64');
    const imageBucketName = process.env.IMAGE_BUCKET_NAME;
    const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;
    
    // Dynamic lookup of Auckland Location ID
    let locationId = '2';
    try {
      console.log("Checking Auckland location ID...");
      const locResponse = await fetch(`https://api.eventfinda.co.nz/v2/locations.json?q=auckland&venue=off&fields=location:(id,name)`, {
        headers: { 'Authorization': `Basic ${token}` }
      });
      if (locResponse.ok) {
        const locData: any = await locResponse.json();
        const aucklandLoc = locData.locations?.find((l: any) => l.name === 'Auckland');
        if (aucklandLoc) {
          locationId = aucklandLoc.id.toString();
          console.log(`Found Auckland Location ID: ${locationId}`);
        }
      }
      await sleep(1500); // respect rate limit
    } catch (e) {
      console.error("Failed to fetch location ID, falling back to 2", e);
    }
    
    const eventsToStore = [];
    
    const { thisWeekend, nextWeekend } = computeTwoWeekendRanges();
    const weekendRanges = [
      { start: thisWeekend.saturday, end: thisWeekend.sunday, label: 'this weekend' },
      { start: nextWeekend.saturday, end: nextWeekend.sunday, label: 'next weekend' }
    ];
    
    const fields = 'event:(id,name,description,url,datetime_start,datetime_end,location_summary,is_free,restrictions,admission_prices,images),image:(transforms),transform:(url,transformation_id)';
    
    const allAucklandEvents: any[] = [];
    const maxRows = 20;

    for (const range of weekendRanges) {
      let currentOffset = 0;
      let hasMore = true;

      console.log(`Starting full fetch for Auckland (Location ID: ${locationId}) for ${range.label} from ${range.start} to ${range.end}`);

      while (hasMore) {
        try {
          console.log(`Fetching ${range.label} offset ${currentOffset}...`);
          const response = await fetch(`https://api.eventfinda.co.nz/v2/events.json?rows=${maxRows}&offset=${currentOffset}&location=${locationId}&start_date=${range.start}&end_date=${range.end}&fields=${fields}&order=popularity`, {
            headers: {
              'Authorization': `Basic ${token}`,
              'User-Agent': 'AucklandWeekendPlanner/1.0'
            }
          });

          if (response.ok) {
            const data: any = await response.json();
            const fetchedEvents = data.events || [];
            
            allAucklandEvents.push(...fetchedEvents);
            console.log(`Successfully fetched ${fetchedEvents.length} events for ${range.label}.`);

            if (fetchedEvents.length < maxRows) {
              hasMore = false;
            } else {
              currentOffset += maxRows;
            }
          } else {
            console.error(`API Error: Status ${response.status} - ${response.statusText}`);
            if (response.status === 429) {
              console.log("Hit rate limit, waiting 5 seconds before retrying...");
              await sleep(5000);
              continue;
            }
            hasMore = false;
          }
        } catch (err) {
          console.error(`Fetch failed at offset ${currentOffset} for ${range.label}:`, err);
          hasMore = false;
        }
        
        await sleep(2000); 
      }
    }
    
    // Deduplicate fetched events by event ID in memory
    const seenEventIds = new Set();
    const uniqueAucklandEvents: any[] = [];
    for (const item of allAucklandEvents) {
      if (!item.id || seenEventIds.has(item.id)) continue;
      seenEventIds.add(item.id);
      uniqueAucklandEvents.push(item);
    }

    console.log(`Fetch complete. Total events retrieved: ${uniqueAucklandEvents.length}. Filtering and processing...`);

    // Filter out inappropriate content before storing
    const appropriateEvents = uniqueAucklandEvents.filter(item => isAppropriateEvent(item));
    const filteredCount = uniqueAucklandEvents.length - appropriateEvents.length;
    if (filteredCount > 0) {
      console.log(`Filtered out ${filteredCount} inappropriate events.`);
    }

    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('TABLE_NAME is required');
    }
    const existingRecords = await loadAllStoredEvents(docClient, tableName, {
      start: thisWeekend.saturday,
      end: nextWeekend.sunday
    });
    
    for (const item of appropriateEvents) {
      const mappedRegion = mapToMacroRegion(item.location_summary || "");
      
      // OPTIMIZATION: Check if event already exists with same image
      const existingMatch = findMatchingRecord(existingRecords, {
        source: 'eventfinda',
        sourceEventId: String(item.id),
        name: item.name,
        datetimeStart: item.datetime_start,
        mappedRegion,
        url: item.url,
        description: item.description,
      });

      let cloudfrontUrl = existingMatch?.image_url || '';
      let originalImageUrl = "";

      if (item.images && item.images.images) {
        const imageList = Array.isArray(item.images.images) ? item.images.images : [item.images.images];
        const firstImage = imageList[0];

        if (firstImage && firstImage.transforms && firstImage.transforms.transforms) {
          const transforms = Array.isArray(firstImage.transforms.transforms) 
            ? firstImage.transforms.transforms 
            : [firstImage.transforms.transforms];

          const targetTransform = transforms.find((t: any) => t && (t.transformation_id === 7 || t.transformation_id === 27)) 
                                  || transforms[0];
          
          originalImageUrl = targetTransform?.url || "";
        }
      }

      // Only download/upload image if it's new or missing
      if (originalImageUrl && (!cloudfrontUrl || existingMatch?.source_image_url !== originalImageUrl)) {
        try {
            console.log(`Processing image for event ${item.id}: Downloading from ${originalImageUrl}`);
            if (!dryRun) {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

              const imgResponse = await fetchWithRetry(originalImageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (AucklandWeekendPlanner/1.0)' },
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (imgResponse.ok) {
                let arrayBuffer: any = await imgResponse.arrayBuffer();
                let buffer: any = Buffer.from(arrayBuffer);
                const objectKey = `events/${item.id}.jpg`;
                
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
              } else {
                console.error(`Download failed for ${item.id}: ${imgResponse.status}`);
              }
              
              // Rate limiting / Anti-throttle
              await sleep(1500); 
            }
          } catch (err: any) {
            if (err.name === 'AbortError') {
              console.error(`Image download timed out for event ${item.id}`);
            } else {
              console.error(`Error processing image for ${item.id}:`, err);
            }
          }
          await sleep(1500); // Increased sleep to prevent rate limiting/throttling
        }

      // Handle cost_text intelligently
      let costText = item.is_free ? 'Free' : 'Paid';
      let priceDetail = '';
      
      if (!item.is_free && item.admission_prices && item.admission_prices.admission_prices) {
        const prices = Array.isArray(item.admission_prices.admission_prices) 
          ? item.admission_prices.admission_prices 
          : [item.admission_prices.admission_prices];
          
        if (prices.length > 0) {
          const p = prices[0];
          if (p.price === 0) {
            priceDetail = 'Free';
          } else if (p.price && p.name) {
            priceDetail = `${p.name}: $${p.price}`;
          } else if (p.price) {
            priceDetail = `$${p.price}`;
          }
        }
      }

      if (priceDetail) {
        costText = priceDetail;
      }

      // Append restrictions (like RP18, All Ages) as supplementary info if present
      if (typeof item.restrictions === 'string' && item.restrictions !== costText) {
        costText = `${costText} (${item.restrictions})`;
      }

      await persistEventWithDedupe(docClient, tableName || '', existingRecords, {
        source: 'eventfinda',
        sourceEventId: String(item.id),
        name: cleanText(item.name),
        description: cleanText(item.description, 200),
        url: item.url,
        datetimeStart: cleanText(item.datetime_start),
        datetimeEnd: item.datetime_end ? cleanText(item.datetime_end) : undefined,
        locationSummary: cleanText(item.location_summary || 'Unknown Location'),
        mappedRegion,
        isFree: item.is_free,
        imageUrl: cloudfrontUrl || undefined,
        sourceImageUrl: originalImageUrl || undefined,
        costText: cleanText(costText),
        scrapedAt: new Date().toISOString(),
      }, { dryRun });
    }
    
    console.log("Completed Cron job pre-warm successfully.");
    return { statusCode: 200, body: 'Pre-warming succeeded.' };
  } catch (error) {
    console.error("Cron Error", error);
    throw error;
  }
};