import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime";

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

export const handler = async (event: any) => {
  console.log("Handler invoked with event:", JSON.stringify(event));
  
  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { audience, budget, tripDays, region, query: userQuery } = body;
    
    console.log("Request params:", { audience, budget, tripDays, region });
    
    // 1. Fetch pre-warmed data from DynamoDB
    const ddbClient = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(ddbClient);
    
    const query = new QueryCommand({
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": "REGION#AUCKLAND"
      },
      Limit: 100 // Increased limit to allow for filtering
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
        // If the event hasn't been tagged yet (old data) or is tagged as Unknown, keep it for LLM to decide
        if (!e.mapped_region || e.mapped_region === "Unknown") return true;
        // If it matches one of the selected regions, keep it
        return selectedRegions.includes(e.mapped_region);
      });
      console.log(`Hard filtering: ${beforeHardFilter} -> ${bedrockEvents.length} events (Filtered by: ${selectedRegions.join(', ')})`);
    }

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

    // Ensure we only process weekend events (Saturday, Sunday)
    const beforeWeekendCount = events.length;
    const weekendFilter = (e: any) => {
      if (!e.datetime_start) return false;
      const date = new Date(e.datetime_start);
      const dow = date.getDay();
      return dow === 0 || dow === 6; // 0=Sun, 6=Sat
    };
    events = events.filter(weekendFilter);
    bedrockEvents = bedrockEvents.filter(weekendFilter);
    if (beforeWeekendCount - events.length > 0) {
      console.log(`Filtered out ${beforeWeekendCount - events.length} non-weekend events`);
    }

    // Family mode: extra keyword filtering on input events
    if (audience === 'Family') {
      const beforeCount = events.length;
      events = events.filter((e: any) => isAppropriateForFamily(e));
      bedrockEvents = bedrockEvents.filter((e: any) => isAppropriateForFamily(e));
      const filtered = beforeCount - events.length;
      if (filtered > 0) {
        console.log(`Family mode: filtered out ${filtered} inappropriate events`);
      }
    }

    // Calculate this weekend's actual dates
    const today = new Date();
    const dayOfWeek = today.getDay();
    let saturdayDate: Date, sundayDate: Date;
    
    if (dayOfWeek === 6) {
      // Today is Saturday
      saturdayDate = new Date(today);
      sundayDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    } else if (dayOfWeek === 0) {
      // Today is Sunday; next weekend is Sat/Sun
      saturdayDate = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);
      sundayDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    } else {
      // Mon-Fri: this Saturday & Sunday
      const daysToSaturday = (6 - dayOfWeek + 7) % 7;
      saturdayDate = new Date(today.getTime() + daysToSaturday * 24 * 60 * 60 * 1000);
      sundayDate = new Date(saturdayDate.getTime() + 24 * 60 * 60 * 1000);
    }
    
    const formatDateString = (date: Date) => {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${months[date.getMonth()]} ${date.getDate()}`;
    };
    
    const saturdayStr = formatDateString(saturdayDate);
    const sundayStr = formatDateString(sundayDate);
    
    console.log(`Calculated weekend dates: Saturday=${saturdayStr}, Sunday=${sundayStr}`);
    
    // 2. Call Bedrock for AI response
    const bedrock = new BedrockRuntimeClient({ region: 'ap-southeast-2' });
    
    const eventsContext = bedrockEvents.length > 0 
      ? `AVAILABLE AUCKLAND EVENTS THIS WEEKEND:\n` + bedrockEvents.map((e: any) => {
          const shortDesc = e.description ? e.description.substring(0, 150).replace(/\n/g, ' ') + '...' : 'No description';
          const regionLabel = e.mapped_region || "Unknown";
          return `- [ID: ${e.SK.split('#')[2]}] ${e.name} | Time: ${e.datetime_start} | Loc: ${e.location_summary || 'Auckland'} (Region: ${regionLabel}) | Free: ${e.is_free ? 'Yes' : 'No'} | Desc: ${shortDesc}`;
        }).join('\n')
      : 'Note: No specific event data is currently available. Please provide general Auckland recommendations.';

    // Build audience-specific instructions
    let audienceInstruction = '';
    if (audience === 'Family') {
      audienceInstruction = `\nFAMILY-FRIENDLY REQUIREMENT: This itinerary is for a family including children. ONLY recommend family-friendly, age-appropriate events and activities. Exclude ALL adult-oriented, nightlife, bar, or mature content. Prioritize parks, museums, markets, outdoor activities, and child-friendly venues.`;
    }

    // Build tripDays constraint
    let dayInstruction = '';
    if (tripDays === 'Saturday') {
      dayInstruction = `Create a plan for SATURDAY ONLY (${saturdayStr}). Do NOT include Sunday. The "days" array must contain exactly ONE entry for Saturday. Use date "${saturdayStr}" in the JSON.`;
    } else if (tripDays === 'Sunday') {
      dayInstruction = `Create a plan for SUNDAY ONLY (${sundayStr}). Do NOT include Saturday. The "days" array must contain exactly ONE entry for Sunday. Use date "${sundayStr}" in the JSON.`;
    } else {
      dayInstruction = `Create a full Saturday + Sunday plan. The "days" array must contain TWO entries:\n- First entry for Saturday with date "${saturdayStr}"\n- Second entry for Sunday with date "${sundayStr}"`;
    }
    
    const prompt = `You are an experienced Auckland weekend planner AI assistant. Your task is to create a detailed, personalized weekend itinerary.

${eventsContext}

User Preferences:
- Group Type: ${audience}
- Budget Level: ${budget}
- Days: ${tripDays}
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
      "dayName": "Saturday",
      "date": "${saturdayStr}",
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
      itinerary = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse AI JSON response, returning raw text:", parseErr);
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        success: true,
        itinerary,
        recommendedEvents,
        otherEvents
      })
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