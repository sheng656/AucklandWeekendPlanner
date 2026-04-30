import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const ssmClient = new SSMClient({});
const s3Client = new S3Client({});

// Adult content keywords for pre-filtering inappropriate events
const ADULT_KEYWORDS = [
  'revue', 'strip', 'burlesque', '18+', 'r18',
  'adults only', 'adult only', 'male revue', 'female revue',
  'exotic dance', 'gentleman', 'lingerie', 'erotic'
];

function isAppropriateEvent(event: { name: string; description?: string }): boolean {
  const text = `${event.name || ''} ${event.description || ''}`.toLowerCase();
  return !ADULT_KEYWORDS.some(kw => text.includes(kw));
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
    
    const fields = 'event:(id,name,description,url,datetime_start,datetime_end,location_summary,is_free,images),image:(transforms),transform:(url,transformation_id)';
    
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
    
    for (const item of appropriateEvents) {
      let cloudfrontUrl = '';
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

      if (originalImageUrl) {
        try {
            console.log(`Processing event ${item.id}: Downloading from ${originalImageUrl}`);
            const imgResponse = await fetch(originalImageUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (AucklandWeekendPlanner/1.0)' }
            });
            
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
          } catch (err) {
            console.error(`Error processing image for ${item.id}:`, err);
          }
          await sleep(1200); 
        }

      // 7 days TTL (Data automatically disappears)
      const ttl = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); 
      
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
          PK: `REGION#AUCKLAND`,
          SK: `EVENT#${item.datetime_start || new Date().toISOString()}#${item.id}`,
          ttl: ttl,
          name: item.name,
          description: item.description,
          url: item.url,
          datetime_start: item.datetime_start,
          datetime_end: item.datetime_end,
          location_summary: item.location_summary || 'Unknown Location',
          is_free: item.is_free,
          image_url: cloudfrontUrl
        }
      }));
    }
    
    console.log("Completed Cron job pre-warm successfully.");
    return { statusCode: 200, body: 'Pre-warming succeeded.' };
  } catch (error) {
    console.error("Cron Error", error);
    throw error;
  }
};