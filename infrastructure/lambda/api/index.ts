import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime";

export const handler = awslambda.streamifyResponse(
  async (event: any, responseStream: import("stream").Writable) => {
    // 1. Fetch pre-warmed data from DynamoDB instantly
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
    
    const eventsData = await docClient.send(query);
    const eventsStr = JSON.stringify(eventsData.Items || []);
    
    // 2. Stream Response from Bedrock via SSE (or direct raw stream if Next.js handles it)
    const bedrock = new BedrockRuntimeClient({ region: 'ap-southeast-2' });
    
    const prompt = `Human: You are an Auckland weekend planner AI.
Here is the latest live event data: ${eventsStr}
Plan a personalized weekend based on this data. Use Markdown. Assitant:`;
    
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
    
    try {
      const response = await bedrock.send(command);
      if (!response.body) return;
      
      for await (const chunk of response.body) {
        if (chunk.chunk?.bytes) {
          const parsedChunk = JSON.parse(Buffer.from(chunk.chunk.bytes).toString());
          if (parsedChunk.type === 'content_block_delta') {
            responseStream.write(parsedChunk.delta.text);
          }
        }
      }
      responseStream.end();
    } catch (e) {
      console.error(e);
      responseStream.write("Error processing stream.");
      responseStream.end();
    }
  }
);