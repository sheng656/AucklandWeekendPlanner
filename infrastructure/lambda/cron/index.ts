import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
    
    // Date calculation for upcoming weekend
    const today = new Date();
    const nextSaturday = new Date(today);
    nextSaturday.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7));
    const nextSunday = new Date(nextSaturday);
    nextSunday.setDate(nextSaturday.getDate() + 1);
    
    const startDateStr = nextSaturday.toISOString().split('T')[0];
    const endDateStr = nextSunday.toISOString().split('T')[0];
    
    const fields = 'event:(id,name,description,url,datetime_start,datetime_end,location_summary,is_free,images)';
    
    for (let page = 1; page <= 3; page++) {
      console.log(`Fetching Eventfinda Page ${page}...`);
      
      const response = await fetch(`https://api.eventfinda.co.nz/v2/events.json?rows=20&offset=${(page - 1) * 20}&location=${locationId}&start_date=${startDateStr}&end_date=${endDateStr}&fields=${fields}&order=popularity`, {
        headers: {
          'Authorization': `Basic ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Eventfinda fetch failed: ${response.statusText}`);
      }
      
      const data: any = await response.json();
      eventsToStore.push(...(data.events || []));
      
      // Delay to respect 1 req per sec strictly
      await sleep(1500); 
    }
    
    console.log(`Successfully fetched ${eventsToStore.length} events. Processing images and storing to DynamoDB...`);
    const tableName = process.env.TABLE_NAME;
    
    for (const item of eventsToStore) {
      let cloudfrontUrl = '';
      
      if (item.images && item.images.length > 0 && item.images[0].transforms?.medium?.url) {
         const originalImageUrl = item.images[0].transforms.medium.url;
         try {
           console.log(`Downloading image for event ${item.id}...`);
           const imgResponse = await fetch(originalImageUrl);
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
           }
         } catch (err) {
           console.error(`Failed to process image for event ${item.id}`, err);
         }
         await sleep(1000); // Sleep to avoid hitting Eventfinda CDN too hard
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