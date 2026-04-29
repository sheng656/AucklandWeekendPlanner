import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime";

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
    const events = eventsData.Items || [];
    console.log(`Retrieved ${events.length} events from DynamoDB:`, JSON.stringify(events));
    
    // 2. Call Bedrock for AI response
    const bedrock = new BedrockRuntimeClient({ region: 'ap-southeast-2' });
    
    const eventsContext = events.length > 0 
      ? `Here are the actual Auckland events available this weekend:\n${events.map((e: any) => `- [ID: ${e.SK.split('#')[2]}] ${e.name}: ${e.description || 'No description'} (${e.datetime_start}) - Location: ${e.location_summary || 'Unknown'}`).join('\n')}`
      : 'Note: No specific event data is currently available. Please provide general Auckland recommendations.';
    
    const prompt = `You are an experienced Auckland weekend planner AI assistant. Your task is to create a detailed, personalized weekend itinerary.

${eventsContext}

User Preferences:
- Group Type: ${audience}
- Budget Level: ${budget}
- Days: ${tripDays}
- Region: ${region}

IMPORTANT INSTRUCTIONS:
1. If specific events are provided above, MUST include them in the itinerary
2. Include specific venue names, addresses, and activity details
3. Format clearly with time slots (Morning, Afternoon, Evening)
4. Provide actual cost estimates for activities based on the budget level
5. Use Markdown formatting with headers and bullet points
6. When recommending an event from the list above, explicitly mention its [ID: xxx] in the text so the frontend can link it to the visual card.

Create a detailed 2-day (or 1-day if specified) Auckland weekend itinerary.`;
    
    const command = new InvokeModelWithResponseStreamCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1500,
        messages: [
          { role: "user", content: prompt }
        ]
      })
    });
    
    console.log("Invoking Bedrock model...");
    const response = await bedrock.send(command);
    
    if (!response.body) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "No response body from Bedrock" })
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
    
    // Format events for frontend consumption (removing dynamo PK/SK details)
    const formattedEvents = events.map((e: any) => ({
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

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        success: true,
        itinerary: fullResponse,
        events: formattedEvents
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