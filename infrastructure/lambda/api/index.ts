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
      Limit: 20
    });
    
    console.log("Querying DynamoDB table:", process.env.TABLE_NAME);
    const eventsData = await docClient.send(query);
    let events = eventsData.Items || [];
    console.log(`Retrieved ${events.length} events from DynamoDB`);

    // Family mode: extra keyword filtering on input events
    if (audience === 'Family') {
      const beforeCount = events.length;
      events = events.filter((e: any) => isAppropriateForFamily(e));
      const filtered = beforeCount - events.length;
      if (filtered > 0) {
        console.log(`Family mode: filtered out ${filtered} inappropriate events`);
      }
    }
    
    // 2. Call Bedrock for AI response
    const bedrock = new BedrockRuntimeClient({ region: 'ap-southeast-2' });
    
    const eventsContext = events.length > 0 
      ? `Here are the actual Auckland events available this weekend:\n${events.map((e: any) => `- [ID: ${e.SK.split('#')[2]}] ${e.name}: ${e.description || 'No description'} (${e.datetime_start}) - Location: ${e.location_summary || 'Unknown'} - Free: ${e.is_free ? 'Yes' : 'No'}`).join('\n')}`
      : 'Note: No specific event data is currently available. Please provide general Auckland recommendations.';

    // Build audience-specific instructions
    let audienceInstruction = '';
    if (audience === 'Family') {
      audienceInstruction = `\nFAMILY-FRIENDLY REQUIREMENT: This itinerary is for a family including children. ONLY recommend family-friendly, age-appropriate events and activities. Exclude ALL adult-oriented, nightlife, bar, or mature content. Prioritize parks, museums, markets, outdoor activities, and child-friendly venues.`;
    }

    // Build tripDays constraint
    let dayInstruction = '';
    if (tripDays === 'Saturday') {
      dayInstruction = 'Create a plan for SATURDAY ONLY. Do NOT include Sunday. The "days" array must contain exactly ONE entry for Saturday.';
    } else if (tripDays === 'Sunday') {
      dayInstruction = 'Create a plan for SUNDAY ONLY. Do NOT include Saturday. The "days" array must contain exactly ONE entry for Sunday.';
    } else {
      dayInstruction = 'Create a full Saturday + Sunday plan. The "days" array must contain TWO entries.';
    }
    
    const prompt = `You are an experienced Auckland weekend planner AI assistant. Your task is to create a detailed, personalized weekend itinerary.

${eventsContext}

User Preferences:
- Group Type: ${audience}
- Budget Level: ${budget}
- Days: ${tripDays}
- Region: ${region}
${audienceInstruction}

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
      "date": "the actual date string, e.g. May 3",
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
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
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

    // Apply Bedrock Guardrails if configured
    if (process.env.GUARDRAIL_ID && process.env.GUARDRAIL_VERSION) {
      invokeParams.guardrailIdentifier = process.env.GUARDRAIL_ID;
      invokeParams.guardrailVersion = process.env.GUARDRAIL_VERSION;
    }

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
            url: e.url
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
      url: e.url
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