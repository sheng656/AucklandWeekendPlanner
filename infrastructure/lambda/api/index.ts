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
    const eventsStr = JSON.stringify(eventsData.Items || []);
    console.log("Retrieved events from DynamoDB");
    
    // 2. Call Bedrock for AI response
    const bedrock = new BedrockRuntimeClient({ region: 'ap-southeast-2' });
    
    const prompt = `Human: You are an Auckland weekend planner AI.
Here is the latest live event data: ${eventsStr}

User preferences:
- Audience: ${audience}
- Budget: ${budget}
- Trip Days: ${tripDays}
- Region: ${region}

Plan a personalized weekend itinerary based on these preferences and available events. Use Markdown format with clear sections.`;
    
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
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        success: true,
        itinerary: fullResponse 
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