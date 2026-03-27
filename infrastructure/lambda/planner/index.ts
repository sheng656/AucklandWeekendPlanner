import { generateItinerary } from './services/bedrock';
import { fetchEvents } from './services/eventfinda';
import { fetchWeather } from './services/openweather';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const CACHE_TABLE_NAME = process.env.CACHE_TABLE_NAME;

export const handler = async (event: any) => {
  try {
    if (event.requestContext?.http?.method === 'OPTIONS') {
      return { statusCode: 200, body: 'OK' };
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const { audience, location, budget, avoidCrowds } = body;

    // Default inputs if empty
    const reqInputs = {
      audience: audience || 'Couple',
      location: location || 'Central Auckland',
      budget: budget || 'Moderate',
      avoidCrowds: avoidCrowds || false
    };

    // 1. Generate Cache Key using SHA-256
    // Include current week for temporal caching logic
    const currentWeekInfo = getWeekNumber(new Date());
    const fingerprintString = JSON.stringify({ reqInputs, currentWeekInfo });
    const cacheKey = crypto.createHash('sha256').update(fingerprintString).digest('hex');

    // 2. Check Cache
    if (CACHE_TABLE_NAME) {
      const getCmd = new GetCommand({
        TableName: CACHE_TABLE_NAME,
        Key: { cacheKey }
      });
      const cacheResult = await ddbDocClient.send(getCmd);
      if (cacheResult.Item) {
        console.log('Cache hit:', cacheKey);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cacheResult.Item.itinerary)
        };
      }
    }

    console.log('Cache miss. Generating new itinerary...', cacheKey);

    // 3. Fetch Context (parallel)
    const [weather, events] = await Promise.all([
      fetchWeather(reqInputs.location),
      fetchEvents(reqInputs.location)
    ]);

    // 4. Invoke LLM
    const itinerary = await generateItinerary(reqInputs, weather, events);

    // 5. Save to Cache
    if (CACHE_TABLE_NAME) {
      // 7 days TTL
      const ttl = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      const putCmd = new PutCommand({
        TableName: CACHE_TABLE_NAME,
        Item: { cacheKey, itinerary, ttl }
      });
      await ddbDocClient.send(putCmd);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itinerary)
    };
  } catch (error: any) {
    console.error('Lambda execution error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};

function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-' + weekNo;
}
