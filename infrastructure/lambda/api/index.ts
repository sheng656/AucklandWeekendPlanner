import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { handleAgentRequest } from './agentHandler';
import { handlePlanRequest } from './planHandler';
import { handleMetricsRequest } from './metricsHandler';

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

export const handler = async (event: any) => {
  console.log("Handler invoked with event:", JSON.stringify(event));
  
  // Initialize DynamoDB client (shared across routes)
  const ddbClient = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(ddbClient);
  const tableName = process.env.TABLE_NAME!;
  
  // Route handling: Check the path to determine which handler to use
  const path = event.rawPath || event.requestContext?.http?.path || '';
  console.log(`Request path: ${path}`);
  
  // Route: /api/v2/agent - Conversational AI Assistant
  if (path === '/api/v2/agent') {
    return handleAgentRequest(event, docClient, tableName);
  }

  // Route: /api/v2/metrics - Hidden Public Analytics Dashboard
  if (path === '/api/v2/metrics') {
    return handleMetricsRequest(event, docClient, tableName);
  }
  
  // Route: /api/v2/plan - Weekend Planning (NEW: Using Gemini Fallback Chain)
  // The old Bedrock-only implementation is preserved below as a backup
  return handlePlanRequest(event, docClient, tableName);
}

// ============================================================================
// BACKUP: Original Bedrock-only implementation (preserved for rollback)
// ============================================================================
/*
export const handlerBackup = async (event: any) => {
  console.log("Handler invoked with event:", JSON.stringify(event));
  
  const ddbClient = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(ddbClient);
  const tableName = process.env.TABLE_NAME!;
  
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { audience, budget, selectedDates, tripDays, region, query: userQuery } = body;
    
    console.log("Request params:", { audience, budget, selectedDates, tripDays, region });
    
    // 1. Fetch pre-warmed data from DynamoDB for the selected or upcoming weekend
    let startDate: string;
    let endDate: string;
    
    // Calculate queries boundary based on explicit dates or fallback to upcoming weekend
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

    // Check Cache first (includes dates and user params to avoid stale cache hits)
    const reqHash = crypto.createHash('md5').update(JSON.stringify({ audience, budget, selectedDates, tripDays, region, userQuery, startDate, endDate })).digest('hex');
    const cacheKey = `CACHE#${reqHash}`;
    
    try {
      const cacheResult = await docClient.send(new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { PK: cacheKey, SK: 'RESULT' }
      }));
      if (cacheResult.Item && cacheResult.Item.data) {
        console.log("Cache hit for", cacheKey);
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: cacheResult.Item.data
        };
      }
    } catch (e) {
      console.log("Cache check failed, continuing", e);
    }

    console.log(`Querying events for boundary: ${startDate} to ${endDate}`);

    const query = new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":pk": "REGION#AUCKLAND",
        ":start": `EVENT#${startDate}`,
        ":end": `EVENT#${endDate}\uffff`
      },
    });
    
    console.log("Querying DynamoDB table:", process.env.TABLE_NAME);
    const eventsData = await docClient.send(query);
    let events = eventsData.Items || [];
    console.log(`Retrieved ${events.length} events from DynamoDB`);

    // Region routing logic via LLM + Hard Filtering
    const selectedRegions = Array.isArray(region) ? region : (region ? [region] : []);
    
    // 1. Code-level Hard Filtering (Efficiency boost for Bedrock only)
    let bedrockEvents = [...events];
    if (selectedRegions.length > 0 && selectedRegions.length < 6) {
      const beforeHardFilter = bedrockEvents.length;
      bedrockEvents = bedrockEvents.filter((e: any) => {
        if (!e.mapped_region || e.mapped_region === "Unknown") return true;
        return selectedRegions.includes(e.mapped_region);
      });
      console.log(`Hard filtering: ${beforeHardFilter} -> ${bedrockEvents.length} events (Filtered by: ${selectedRegions.join(', ')})`);
    }

    // 2. Prioritize and slice events for Bedrock (LLM) context
    // We want to send about 120 events total to save tokens, but ensure 'aucklandforkids' are well-represented.
    const isKidsEvent = (e: any) => 
      e.source === 'aucklandforkids' || 
      (e.seenInSources && e.seenInSources.includes('aucklandforkids'));

    const kidsEventsPool = bedrockEvents.filter(isKidsEvent);
    const otherEventsPool = bedrockEvents.filter(e => !isKidsEvent(e));

    console.log(`Pool breakdown: ${kidsEventsPool.length} Kids events, ${otherEventsPool.length} others.`);

    // Selection logic: Up to 50 kids events, then fill the rest from others to reach ~120
    bedrockEvents = [
      ...kidsEventsPool.slice(0, 50),
      ...otherEventsPool.slice(0, 120 - Math.min(50, kidsEventsPool.length))
    ];
    console.log(`Final Bedrock context size: ${bedrockEvents.length} events`);

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

    // Filter events strictly to the exact selected dates.
    // If no explicit selectedDates array is sent (legacy clients), fall back to sat/sun filter.
    const beforeWeekendCount = events.length;
    const selectedDateSet = new Set(
      Array.isArray(selectedDates) && selectedDates.length > 0 
        ? selectedDates 
        : [startDate, endDate]
    );
    const dateFilter = (e: any) => {
      if (!e.datetime_start) return false;
      const eventDate = e.datetime_start.substring(0, 10); // "YYYY-MM-DD"
      if (Array.isArray(selectedDates) && selectedDates.length > 0) {
        return selectedDateSet.has(eventDate);
      }
      const dow = new Date(e.datetime_start).getDay();
      return dow === 0 || dow === 6; // 0=Sun, 6=Sat legacy fallback
    };
    events = events.filter(dateFilter);
    bedrockEvents = bedrockEvents.filter(dateFilter);
    if (beforeWeekendCount - events.length > 0) {
      console.log(`Filtered out ${beforeWeekendCount - events.length} non-selected/non-weekend events`);
    }

    // Family mode: extra keyword filtering
    if (audience === 'Family') {
      const beforeCount = events.length;
      events = events.filter((e: any) => isAppropriateForFamily(e));
      bedrockEvents = bedrockEvents.filter((e: any) => isAppropriateForFamily(e));
      
      const filtered = beforeCount - events.length;
      if (filtered > 0) {
        console.log(`Family mode: filtered out ${filtered} inappropriate events`);
      }
    }

    // Parse ISO YYYY-MM-DD dates UTC-safely to prevent timezone-shift day mismatches on local/server environment
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
      : [startDate, endDate]; // fallback
      
    const humanDates = datesToPlan.map(d => formatIsoToHumanStr(d));
    console.log(`Calculated dynamic dates to plan:`, datesToPlan, humanDates);

    // 2. Call Bedrock for AI response
    const bedrock = new BedrockRuntimeClient({ region: 'ap-southeast-2' });
    
    const eventsContext = bedrockEvents.length > 0 
      ? `AVAILABLE AUCKLAND EVENTS THIS WEEKEND:\n` + bedrockEvents.map((e: any) => {
          const shortDesc = e.description ? e.description.substring(0, 150).replace(/\n/g, ' ') + '...' : 'No description';
          const regionLabel = e.mapped_region || "Unknown";
          const sourceLabel = e.source || (e.seenInSources && e.seenInSources[0]) || 'general';
          return `- [ID: ${e.SK.split('#')[2]}] ${e.name} | Time: ${e.datetime_start} | Loc: ${e.location_summary || 'Auckland'} (Region: ${regionLabel}) | Source: ${sourceLabel} | Free: ${e.is_free ? 'Yes' : 'No'} | Desc: ${shortDesc}`;
        }).join('\n')
      : 'Note: No specific event data is currently available. Please provide general Auckland recommendations.';

    // Build audience-specific instructions
    let audienceInstruction = '';
    if (audience === 'Family') {
      audienceInstruction = `\nFAMILY-FRIENDLY REQUIREMENT: This itinerary is for a family including children. ONLY recommend family-friendly, age-appropriate events and activities. Exclude ALL adult-oriented, nightlife, bar, or mature content. 
PRIORITIZATION: Events with "Source: aucklandforkids" are specifically curated for children and families. You MUST prioritize these events over others when creating the plan.
General priorities: parks, museums, markets, outdoor activities, and child-friendly venues.`;
    }

    // Build chronological list instructions and constraints dynamically
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

IMPORTANT INSTRUCTIONS:
1. If specific events are provided above, include relevant ones in the itinerary and reference their [ID: xxx]
2. Include specific venue names and activity details
3. Provide actual cost estimates based on the budget level
4. When recommending an event from the list above, explicitly mention its [ID: xxx] so the frontend can link it

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
              "title": "Activity Name",
              "time": "9:00 AM – 11:00 AM",
              "cost": "$20-30",
              "description": "Brief description of the activity",
              "location": "Venue name, Suburb",
              "eventId": "883357 or null if not from the events list"
            }
          ]
        },
        {
          "period": "Lunch",
          "activities": [{ "title": "...", "time": "...", "cost": "...", "description": "...", "location": "...", "eventId": null }]
        },
        {
          "period": "Afternoon",
          "activities": [...]
        },
        {
          "period": "Evening",
          "activities": [...]
        }
      ],
      "estimatedTotal": "$65-85"
    }
  ]
}

Each day should have 4-6 activities across Morning, Lunch, Afternoon, and Evening time slots. Ensure cost estimates are realistic for Auckland, New Zealand.`;
    
    // Build Bedrock invocation options
    const invokeParams: any = {
      modelId: 'global.anthropic.claude-haiku-4-5-20251001-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        messages: [
          { role: "user", content: prompt }
        ]
      })
    };



    const command = new InvokeModelWithResponseStreamCommand(invokeParams);
    
    console.log("Invoking Bedrock model...");
    const response = await bedrock.send(command);
    
    if (!response.body) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: "No response body from Bedrock", success: false })
      };
    }
    
    // Collect streamed response
    let fullResponse = '';
    for await (const chunk of response.body) {
      if (chunk.chunk?.bytes) {
        const parsed = JSON.parse(Buffer.from(chunk.chunk.bytes).toString());
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          fullResponse += parsed.delta.text;
        }
      }
    }
    
    console.log("Successfully generated response, length:", fullResponse.length);

    // Parse the structured JSON response from AI
    let itinerary: any = null;
    try {
      // Clean up potential markdown code fences
      let jsonStr = fullResponse.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      const parsedJson = JSON.parse(jsonStr);
      itinerary = validateItinerary(parsedJson);
    } catch (parseErr) {
      console.error("Failed to parse or validate AI JSON response, returning raw text:", parseErr);
      // Fallback: return as raw itinerary text
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          itinerary: null,
          rawItinerary: fullResponse,
          recommendedEvents: [],
          otherEvents: events.map((e: any) => ({
            id: e.SK.split('#')[2] || e.id,
            name: e.name,
            description: e.description,
            image_url: e.image_url,
            datetime_start: e.datetime_start,
            datetime_end: e.datetime_end,
            location_summary: e.location_summary,
            is_free: e.is_free,
            url: e.url,
            mapped_region: e.mapped_region,
            source: e.source || 'eventfinda'
          }))
        })
      };
    }

    // Extract event IDs mentioned in the itinerary
    const mentionedIds = new Set<string>();
    if (itinerary?.days) {
      for (const day of itinerary.days) {
        for (const slot of day.timeSlots || []) {
          for (const activity of slot.activities || []) {
            if (activity.eventId && activity.eventId !== 'null' && activity.eventId !== null) {
              mentionedIds.add(String(activity.eventId));
            }
          }
        }
      }
    }

    // Also scan the raw response for [ID: xxx] patterns as fallback
    const idMatches = fullResponse.matchAll(/\[ID:\s*(\d+)\]/g);
    for (const match of idMatches) {
      mentionedIds.add(match[1]);
    }

    console.log("Mentioned event IDs:", Array.from(mentionedIds));

    // Format events: split into recommended (AI-selected) and other (browsable)
    const allFormattedEvents = events.map((e: any) => ({
      id: e.SK.split('#')[2] || e.id,
      name: e.name,
      description: e.description,
      image_url: e.image_url,
      datetime_start: e.datetime_start,
      datetime_end: e.datetime_end,
      location_summary: e.location_summary,
      is_free: e.is_free,
      url: e.url,
      mapped_region: e.mapped_region,
      source: e.source || 'eventfinda'
    }));

    const recommendedEvents = allFormattedEvents.filter((e: any) => mentionedIds.has(String(e.id)));
    const otherEvents = allFormattedEvents.filter((e: any) => !mentionedIds.has(String(e.id)));

    const responseBodyStr = JSON.stringify({ 
      success: true,
      itinerary,
      recommendedEvents,
      otherEvents
    });

    try {
      await docClient.send(new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: {
          PK: cacheKey,
          SK: 'RESULT',
          data: responseBodyStr,
          ttl: Math.floor(Date.now() / 1000) + 86400 // 24 hours
        }
      }));
    } catch (e) {
      console.error("Failed to save cache", e);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: responseBodyStr
    };
    
  } catch (error) {
    console.error("Handler error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: errorMessage,
        success: false 
      })
    };
  }
};
*/