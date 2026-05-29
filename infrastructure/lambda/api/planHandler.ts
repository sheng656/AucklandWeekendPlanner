import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { LLMFallbackChain } from '../shared/llm';
import { checkRateLimit, generateCacheKey, getCachedData, setCachedData, logMetric } from '../shared/rateLimit';
import { computeUpcomingWeekendRange } from '../shared/utils';

// In-memory cache for SSM parameters
let cachedGeminiKey: string | null = null;

async function loadGeminiApiKey(): Promise<string> {
  if (cachedGeminiKey) {
    return cachedGeminiKey;
  }

  const ssmClient = new SSMClient({ region: 'ap-southeast-2' });
  const command = new GetParameterCommand({
    Name: '/AucklandPlanner/Config/GEMINI_API_KEY',
    WithDecryption: true,
  });

  const response = await ssmClient.send(command);
  if (!response.Parameter?.Value) {
    throw new Error('GEMINI_API_KEY not found in SSM Parameter Store');
  }

  cachedGeminiKey = response.Parameter.Value;
  console.log('Gemini API Key loaded from SSM and cached');
  return cachedGeminiKey;
}

// Adult content keywords for Family mode pre-filtering
const ADULT_KEYWORDS = [
  'revue', 'strip', 'burlesque', '18+', 'r18',
  'adults only', 'adult only', 'male revue', 'female revue',
  'exotic dance', 'gentleman', 'lingerie', 'erotic'
];

function isAppropriateForFamily(event: { name: string; description?: string }): boolean {
  const text = `${event.name || ''} ${event.description || ''}`.toLowerCase();
  return !ADULT_KEYWORDS.some(kw => text.includes(kw));
}

interface Activity {
  title: string;
  time: string;
  cost: string;
  description: string;
  location: string;
  eventId: string | null;
}

interface TimeSlot {
  period: string;
  activities: Activity[];
}

interface DayPlan {
  dayName: string;
  date: string;
  timeSlots: TimeSlot[];
  estimatedTotal: string;
}

interface Itinerary {
  days: DayPlan[];
}

function validateItinerary(data: any): Itinerary {
  if (!data || typeof data !== 'object') {
    throw new Error('Root is not an object');
  }
  if (!Array.isArray(data.days)) {
    throw new Error('days must be an array');
  }

  const validatedDays: DayPlan[] = [];

  for (const day of data.days) {
    if (!day || typeof day !== 'object') continue;
    
    const validatedTimeSlots: TimeSlot[] = [];
    if (Array.isArray(day.timeSlots)) {
      for (const slot of day.timeSlots) {
        if (!slot || typeof slot !== 'object') continue;
        
        const validatedActivities: Activity[] = [];
        if (Array.isArray(slot.activities)) {
          for (const act of slot.activities) {
            if (!act || typeof act !== 'object') continue;
            validatedActivities.push({
              title: String(act.title || 'Activity'),
              time: String(act.time || ''),
              cost: String(act.cost || ''),
              description: String(act.description || ''),
              location: String(act.location || ''),
              eventId: act.eventId ? String(act.eventId) : null,
            });
          }
        }
        
        validatedTimeSlots.push({
          period: String(slot.period || 'Activity'),
          activities: validatedActivities,
        });
      }
    }
    
    validatedDays.push({
      dayName: String(day.dayName || 'Day'),
      date: String(day.date || ''),
      timeSlots: validatedTimeSlots,
      estimatedTotal: String(day.estimatedTotal || ''),
    });
  }

  return { days: validatedDays };
}

export async function handlePlanRequest(
  event: any,
  docClient: DynamoDBDocumentClient,
  tableName: string
) {
  try {
    // Extract IP address for rate limiting
    const sourceIp = event.requestContext?.http?.sourceIp || 'unknown';
    
    // Check rate limit (40 requests per IP per day)
    const rateLimitCheck = await checkRateLimit(docClient, tableName, sourceIp);
    if (!rateLimitCheck.allowed) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'You have exceeded the maximum number of requests (40) for today. Please try again tomorrow.',
          resetAt: rateLimitCheck.resetAt
        })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { audience, budget, selectedDates, tripDays, region, query: userQuery } = body;
    
    console.log("Plan request params:", { audience, budget, selectedDates, tripDays, region });
    
    // Calculate date boundary
    let startDate: string;
    let endDate: string;
    
    if (Array.isArray(selectedDates) && selectedDates.length > 0) {
      const sorted = [...selectedDates].sort();
      startDate = sorted[0];
      endDate = sorted[sorted.length - 1];
    } else {
      const fallback = computeUpcomingWeekendRange();
      startDate = fallback.startDate;
      endDate = fallback.endDate;
    }
    
    console.log(`Resolved date boundary: ${startDate} to ${endDate}`);

    // Check cache first
    const cacheKey = generateCacheKey({ audience, budget, selectedDates, tripDays, region, userQuery, startDate, endDate });
    const cachedResult = await getCachedData(docClient, tableName, cacheKey);
    
    if (cachedResult) {
      console.log("Cache hit for plan request");
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'application/json', 
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'HIT'
        },
        body: cachedResult
      };
    }

    // Fetch events from DynamoDB
    console.log(`Querying events for boundary: ${startDate} to ${endDate}`);
    const query = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":pk": "REGION#AUCKLAND",
        ":start": `EVENT#${startDate}`,
        ":end": `EVENT#${endDate}\uffff`
      },
    });
    
    const eventsData = await docClient.send(query);
    let events = eventsData.Items || [];
    console.log(`Retrieved ${events.length} events from DynamoDB`);

    // Region filtering
    const selectedRegions = Array.isArray(region) ? region : (region ? [region] : []);
    
    if (selectedRegions.length > 0 && selectedRegions.length < 6) {
      const beforeFilter = events.length;
      events = events.filter((e: any) => {
        if (!e.mapped_region || e.mapped_region === "Unknown") return true;
        return selectedRegions.includes(e.mapped_region);
      });
      console.log(`Region filtering: ${beforeFilter} -> ${events.length} events`);
    }

    // Prioritize kids events
    const isKidsEvent = (e: any) => 
      e.source === 'aucklandforkids' || 
      (e.seenInSources && e.seenInSources.includes('aucklandforkids'));

    const kidsEventsPool = events.filter(isKidsEvent);
    const otherEventsPool = events.filter(e => !isKidsEvent(e));

    console.log(`Pool breakdown: ${kidsEventsPool.length} Kids events, ${otherEventsPool.length} others`);

    // Select up to 120 events for LLM context
    const contextEvents = [
      ...kidsEventsPool.slice(0, 50),
      ...otherEventsPool.slice(0, 120 - Math.min(50, kidsEventsPool.length))
    ];
    console.log(`LLM context size: ${contextEvents.length} events`);

    // Filter by selected dates
    const selectedDateSet = new Set(
      Array.isArray(selectedDates) && selectedDates.length > 0 
        ? selectedDates 
        : [startDate, endDate]
    );
    
    const dateFilter = (e: any) => {
      if (!e.datetime_start) return false;
      const eventDate = e.datetime_start.substring(0, 10);
      if (Array.isArray(selectedDates) && selectedDates.length > 0) {
        return selectedDateSet.has(eventDate);
      }
      const dow = new Date(e.datetime_start).getDay();
      return dow === 0 || dow === 6;
    };
    
    events = events.filter(dateFilter);
    const filteredContextEvents = contextEvents.filter(dateFilter);

    // Family mode filtering
    if (audience === 'Family') {
      const beforeCount = events.length;
      events = events.filter((e: any) => isAppropriateForFamily(e));
      const filtered = beforeCount - events.length;
      if (filtered > 0) {
        console.log(`Family mode: filtered out ${filtered} inappropriate events`);
      }
    }

    // Format dates for prompt
    const formatIsoToHumanStr = (isoDate: string): string => {
      const parts = isoDate.split('-');
      if (parts.length !== 3) return isoDate;
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dateObj = new Date(Date.UTC(y, m, d));
      
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `${dayNames[dateObj.getUTCDay()]} ${months[dateObj.getUTCMonth()]} ${dateObj.getUTCDate()}`;
    };

    const datesToPlan = Array.isArray(selectedDates) && selectedDates.length > 0
      ? [...selectedDates].sort()
      : [startDate, endDate];
      
    const humanDates = datesToPlan.map(d => formatIsoToHumanStr(d));
    console.log(`Dates to plan:`, datesToPlan, humanDates);

    // Build prompt
    const eventsContext = filteredContextEvents.length > 0 
      ? `AVAILABLE AUCKLAND EVENTS THIS WEEKEND:\n` + filteredContextEvents.map((e: any) => {
          const shortDesc = e.description ? e.description.substring(0, 150).replace(/\n/g, ' ') + '...' : 'No description';
          const regionLabel = e.mapped_region || "Unknown";
          const sourceLabel = e.source || (e.seenInSources && e.seenInSources[0]) || 'general';
          return `- [ID: ${e.SK.split('#')[2]}] ${e.name} | Time: ${e.datetime_start} | Loc: ${e.location_summary || 'Auckland'} (Region: ${regionLabel}) | Source: ${sourceLabel} | Free: ${e.is_free ? 'Yes' : 'No'} | Desc: ${shortDesc}`;
        }).join('\n')
      : 'Note: No specific event data is currently available. Please provide general Auckland recommendations.';

    let regionInstruction = '';
    if (selectedRegions.length > 0 && selectedRegions.length < 6) {
      regionInstruction = `
GEOGRAPHICAL CONSTRAINT (CRITICAL):
The user ONLY wants to visit: ${selectedRegions.join(', ')}. 
Please prioritize available events where the "(Region: X)" tag explicitly matches their choice. 
If an event is tagged as "(Region: Unknown)", use your expert geographical knowledge of Auckland to determine if its location summary falls within the requested areas.
DO NOT recommend events clearly located in regions the user did not select.
`;
    } else {
      regionInstruction = `
GEOGRAPHICAL CONSTRAINT:
The user is open to exploring any area in Auckland. Try to group activities geographically to minimize travel time.
`;
    }

    let audienceInstruction = '';
    if (audience === 'Family') {
      audienceInstruction = `\nFAMILY-FRIENDLY REQUIREMENT: This itinerary is for a family including children. ONLY recommend family-friendly, age-appropriate events and activities. Exclude ALL adult-oriented, nightlife, bar, or mature content. 
PRIORITIZATION: Events with "Source: aucklandforkids" are specifically curated for children and families. You MUST prioritize these events over others when creating the plan.
General priorities: parks, museums, markets, outdoor activities, and child-friendly venues.`;
    }

    let dayInstruction = `The user wants a plan for exactly the following dates: ${humanDates.join(', ')}.\n`;
    dayInstruction += `Your "days" array in the JSON response MUST contain exactly ${datesToPlan.length} entries matching these dates in chronological order:\n`;
    datesToPlan.forEach((d, idx) => {
      const humanStr = humanDates[idx];
      const parts = d.split('-');
      const parsedD = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      const dayOfWeekName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parsedD.getUTCDay()];
      dayInstruction += `- Entry ${idx + 1}: "dayName" must be "${dayOfWeekName}", "date" must be "${humanStr}".\n`;
    });
    
    const prompt = `You are an experienced Auckland weekend planner AI assistant. Your task is to create a detailed, personalized weekend itinerary.

${eventsContext}

User Preferences:
- Group Type: ${audience}
- Budget Level: ${budget}
- Region: ${selectedRegions.join(', ') || region}
${audienceInstruction}
${regionInstruction}

CRITICAL SCHEDULING RULE:
${dayInstruction}
Violating this rule is unacceptable.

CRITICAL EVENT ID RULE - THIS IS EXTREMELY IMPORTANT:
When you recommend an event from the "AVAILABLE AUCKLAND EVENTS" list above, you MUST include its ID number in the eventId field.
- Look for [ID: xxx] in the event description
- Copy ONLY the number (e.g., if you see [ID: 883357], use "eventId": "883357")
- This is crucial because it allows the frontend to display the event's image and details
- For generic activities like meals or breaks, use "eventId": null

MEAL RECOMMENDATIONS - IMPORTANT:
When recommending lunch or dinner:
1. Consider the location of activities before and after the meal
2. Recommend specific, well-reviewed restaurants or cafes that are NEARBY (within 5-10 minutes walk)
3. Include the actual restaurant/cafe name (e.g., "Lunch at Ortolana", "Dinner at Depot Eatery")
4. Mention the cuisine type and why it's a good choice
5. Ensure the location is convenient - in the same suburb or very close to the surrounding activities
6. For budget levels:
   - Free/Low: Casual cafes, food courts, bakeries ($10-20)
   - Medium: Popular restaurants, bistros ($20-40)
   - High: Fine dining, premium restaurants ($40-80)

IMPORTANT INSTRUCTIONS:
1. PRIORITIZE events from the provided list above - they have real images and verified details
2. When using an event from the list, you MUST copy its [ID: xxx] number into the eventId field
3. Include specific venue names and activity details
4. Provide actual cost estimates based on the budget level
5. Ensure activities have reasonable time ranges that don't overlap too much
6. Make meal recommendations practical and location-aware

OUTPUT FORMAT - You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text). The JSON structure must be:
{
  "days": [
    {
      "dayName": "${humanDates[0]?.split(' ')[0] || 'Saturday'}",
      "date": "${humanDates[0] || 'Saturday May 24'}",
      "timeSlots": [
        {
          "period": "Morning",
          "activities": [
            {
              "title": "Dragon Boat Festival",
              "time": "10:00 AM – 12:00 PM",
              "cost": "Free",
              "description": "Celebrate the Dragon Boat Festival with traditional cultural workshops",
              "location": "Epsom Community Centre, Epsom",
              "eventId": "883357"
            }
          ]
        },
        {
          "period": "Lunch",
          "activities": [
            {
              "title": "Casual Lunch Break",
              "time": "12:30 PM – 1:30 PM",
              "cost": "$15-25",
              "description": "Enjoy a relaxed meal at a nearby cafe",
              "location": "Central Auckland",
              "eventId": null
            }
          ]
        },
        {
          "period": "Afternoon",
          "activities": [
            {
              "title": "Social Cohesion in Aotearoa New Zealand 2025",
              "time": "1:30 PM – 3:00 PM",
              "cost": "Free",
              "description": "Social Cohesion in Aotearoa New Zealand 2025: Iwi/Māori, and the burning question of Māori/Pākehā relations",
              "location": "Mairangi Bay, CBD, Auckland",
              "eventId": "883358"
            },
            {
              "title": "Another Activity",
              "time": "3:30 PM – 5:00 PM",
              "cost": "$20",
              "description": "...",
              "location": "...",
              "eventId": "883359"
            }
          ]
        },
        {
          "period": "Evening",
          "activities": [
            {
              "title": "Dinner",
              "time": "6:00 PM – 7:30 PM",
              "cost": "$30-50",
              "description": "...",
              "location": "...",
              "eventId": null
            }
          ]
        }
      ],
      "estimatedTotal": "$65-85"
    }
  ]
}

Each day should have 4-6 activities across Morning, Lunch, Afternoon, and Evening time slots. REMEMBER: Always use eventId from the provided events list whenever possible to show images. Ensure cost estimates are realistic for Auckland, New Zealand.`;

    // Load Gemini API key
    const geminiApiKey = await loadGeminiApiKey();

    // Initialize LLM fallback chain
    const llmChain = new LLMFallbackChain(geminiApiKey);

    // Call LLM with fallback
    const startTime = Date.now();
    const llmResult = await llmChain.invoke({
      prompt,
      temperature: 0.7,
      maxTokens: 2500,
      responseFormat: 'json'
    });
    const latencyMs = Date.now() - startTime;

    console.log(`LLM Response - Provider: ${llmResult.provider}, Model: ${llmResult.model}, Fallback Count: ${llmResult.fallbackCount}`);

    // Parse and validate the itinerary
    let itinerary: Itinerary;
    try {
      const parsed = JSON.parse(llmResult.content);
      itinerary = validateItinerary(parsed);
    } catch (parseError: any) {
      console.error('Failed to parse LLM response:', parseError);
      throw new Error(`Invalid itinerary format: ${parseError.message}`);
    }

    // Build response with event details
    // Add 'id' field to events for frontend matching
    const addIdToEvent = (e: any) => ({
      ...e,
      id: e.SK ? e.SK.split('#')[2] : null
    });
    
    const responseBody = JSON.stringify({
      success: true,
      itinerary,
      recommendedEvents: events.slice(0, 20).map(addIdToEvent),
      otherEvents: events.slice(20, 50).map(addIdToEvent),
      provider: llmResult.provider,
      model: llmResult.model,
      fallbackCount: llmResult.fallbackCount
    });

    // Cache the result (1 hour TTL)
    await setCachedData(docClient, tableName, cacheKey, responseBody, { ttlSeconds: 3600 });

    // Log metrics
    await logMetric(docClient, tableName, {
      provider: llmResult.provider,
      model: llmResult.model,
      inputTokens: llmResult.inputTokens || 0,
      outputTokens: llmResult.outputTokens || 0,
      fallbackCount: llmResult.fallbackCount,
      errorReason: undefined,
      latencyMs,
      ipHash: sourceIp,
      endpoint: '/api/v2/plan'
    });

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS',
        'X-Provider': llmResult.provider,
        'X-Model': llmResult.model
      },
      body: responseBody
    };

  } catch (error: any) {
    console.error('Plan handler error:', error);
    
    // Log error metric
    try {
      await logMetric(docClient, tableName, {
        provider: 'AWSBedrock',
        model: 'error',
        inputTokens: 0,
        outputTokens: 0,
        fallbackCount: 0,
        errorReason: error.message,
        latencyMs: 0,
        ipHash: event.requestContext?.http?.sourceIp || 'unknown',
        endpoint: '/api/v2/plan'
      });
    } catch (logError) {
      console.error('Failed to log error metric:', logError);
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Failed to generate itinerary',
        message: error.message,
        success: false
      })
    };
  }
}

// Made with Bob
