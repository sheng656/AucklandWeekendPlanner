import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const ssmClient = new SSMClient({});

// A utility function to fetch Eventfinda configuration from SSM Parameter Store
async function getEventfindaConfig() {
  const response = await ssmClient.send(new GetParametersByPathCommand({
    Path: process.env.SSM_PATH || '/AucklandPlanner/Config',
    WithDecryption: true,
  }));
  
  const config: Record<string, string> = {};
  response.Parameters?.forEach(p => {
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
    
    // Using a sleep approach down manually per the design constraints
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const eventsToStore = [];
    
    // We fetch a few pages, deliberately keeping slower than limits
    for (let page = 1; page <= 3; page++) {
      console.log(`Fetching Eventfinda Page ${page}...`);
      
      const response = await fetch(`https://api.eventfinda.co.nz/v2/events.json?rows=20&offset=${(page - 1) * 20}&location=27`, {
        headers: {
          'Authorization': `Basic ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Eventfinda fetch failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      eventsToStore.push(...(data.events || []));
      
      // Delay to respect 1 req per sec strictly
      await sleep(1500); 
    }
    
    console.log(`Successfully fetched ${eventsToStore.length} events. Storing to DynamoDB...`);
    const tableName = process.env.TABLE_NAME;
    
    for (const item of eventsToStore) {
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
          location: item.location?.summary || 'Unknown Location'
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