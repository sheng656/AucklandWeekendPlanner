import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { loadAllStoredEvents, persistEventWithDedupe, isAppropriateEvent, findMatchingRecord } from '../shared/dedupe';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const ssmClient = new SSMClient({});
const s3Client = new S3Client({});


// Auckland Suburb mapping table
const REGION_MAPPING: Record<string, string[]> = {
  "Central Auckland": [
    "cbd", "central", "ponsonby", "parnell", "newmarket", "mt eden", "mount eden", 
    "epsom", "grey lynn", "pt chev", "point chevalier", "mt albert", "mount albert", 
    "mission bay", "st heliers", "remuera", "onehunga", "ellerslie", "greenlane",
    "kingsland", "grafton", "newton", "freemans bay", "herne bay", "sylvia park"
  ],
  "North Shore": [
    "north shore", "takapuna", "albany", "devonport", "milford", "birkenhead", 
    "glenfield", "northcote", "browns bay", "wairau", "castor bay", "mokoia",
    "beach haven", "sunnynook", "rothesay", "orewa", "whangaparaoa", "silverdale"
  ],
  "West Auckland": [
    "west auckland", "henderson", "titirangi", "new lynn", "massey", "te atatu", 
    "hobsonville", "kumeu", "piha", "glen eden", "kelston", "huapai", "muriwai",
    "swanson", "ranui", "waitakere"
  ],
  "South Auckland": [
    "south auckland", "manukau", "papatoetoe", "mangere", "manurewa", "papakura", 
    "pukekohe", "otahuhu", "takanini", "karaka", "weymouth", "wiri", "franklin"
  ],
  "East Auckland": [
    "east auckland", "howick", "pakuranga", "botany", "half moon bay", "flat bush", 
    "clevedon", "dannemora", "highland park", "bucklands beach", "whitford"
  ],
  "Waiheke Island": [
    "waiheke", "oneroa", "onetangi", "surfdale", "ostend", "matiatia"
  ]
};

// Map specific location summary to macro region
function mapToMacroRegion(locationSummary: string): string {
  if (!locationSummary) return "Unknown";
  const locLower = locationSummary.toLowerCase();

  for (const [region, keywords] of Object.entries(REGION_MAPPING)) {
    if (keywords.some(kw => locLower.includes(kw))) {
      return region;
    }
  }
  return "Unknown"; 
}

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
    
    // Using a sleep approach down manually per the design constraints
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    
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
    
    // Date calculation for upcoming weekend (Friday to Sunday)
    const today = new Date();
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7));
    const nextSunday = new Date(nextFriday);
    nextSunday.setDate(nextFriday.getDate() + 2);
    
    const startDateStr = nextFriday.toISOString().split('T')[0];
    const endDateStr = nextSunday.toISOString().split('T')[0];
    
    const fields = 'event:(id,name,description,url,datetime_start,datetime_end,location_summary,is_free,restrictions,images),image:(transforms),transform:(url,transformation_id)';
    
    const allAucklandEvents: any[] = [];
    let currentOffset = 0;
    const maxRows = 20;
    let hasMore = true;

    console.log(`Starting full fetch for Auckland (Location ID: ${locationId}) from ${startDateStr} to ${endDateStr}`);

    while (hasMore) {
      try {
        console.log(`Fetching offset ${currentOffset}...`);
        const response = await fetch(`https://api.eventfinda.co.nz/v2/events.json?rows=${maxRows}&offset=${currentOffset}&location=${locationId}&start_date=${startDateStr}&end_date=${endDateStr}&fields=${fields}&order=popularity`, {
          headers: {
            'Authorization': `Basic ${token}`,
            'User-Agent': 'AucklandWeekendPlanner/1.0'
          }
        });

        if (response.ok) {
          const data: any = await response.json();
          const fetchedEvents = data.events || [];
          
          allAucklandEvents.push(...fetchedEvents);
          console.log(`Successfully fetched ${fetchedEvents.length} events.`);

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
        console.error(`Fetch failed at offset ${currentOffset}:`, err);
        hasMore = false;
      }
      
      await sleep(2000); 
    }
    
    console.log(`Fetch complete. Total events retrieved: ${allAucklandEvents.length}. Filtering and processing...`);

    // Filter out inappropriate content before storing
    const appropriateEvents = allAucklandEvents.filter(item => isAppropriateEvent(item));
    const filteredCount = allAucklandEvents.length - appropriateEvents.length;
    if (filteredCount > 0) {
      console.log(`Filtered out ${filteredCount} inappropriate events.`);
    }

    const tableName = process.env.TABLE_NAME;
    if (!tableName) {
      throw new Error('TABLE_NAME is required');
    }
    const existingRecords = await loadAllStoredEvents(docClient, tableName);
    
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

              const imgResponse = await fetch(originalImageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (AucklandWeekendPlanner/1.0)' },
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (imgResponse.ok) {
                const arrayBuffer = await imgResponse.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const objectKey = `events/${item.id}.jpg`;
                
                await s3Client.send(new PutObjectCommand({
                  Bucket: imageBucketName,
                  Key: objectKey,
                  Body: buffer,
                  ContentType: 'image/jpeg',
                }));
                
                cloudfrontUrl = `https://${cloudfrontDomain}/${objectKey}`;
              } else {
                console.error(`Download failed for ${item.id}: ${imgResponse.status}`);
              }
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

      await persistEventWithDedupe(docClient, tableName || '', existingRecords, {
        source: 'eventfinda',
        sourceEventId: String(item.id),
        name: item.name,
        description: item.description,
        url: item.url,
        datetimeStart: item.datetime_start,
        datetimeEnd: item.datetime_end,
        locationSummary: item.location_summary || 'Unknown Location',
        mappedRegion,
        isFree: item.is_free,
        imageUrl: cloudfrontUrl || undefined,
        sourceImageUrl: originalImageUrl || undefined,
        costText: item.restrictions,
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