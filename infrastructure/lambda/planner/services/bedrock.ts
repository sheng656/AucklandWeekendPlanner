import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION || 'ap-southeast-2',
});

export const generateItinerary = async (inputs: any, weather: any, events: any[]) => {
  const systemPrompt = `You are an expert Auckland local tour guide. Create a structured weekend itinerary based on the user's inputs: ${JSON.stringify(inputs)}. 
  Weather forecast context: ${weather ? JSON.stringify(weather.list.slice(0, 5)) : 'unknown'}. 
  Current Events: ${JSON.stringify(events.map((e: any) => e.name + ' at ' + e.location_summary))}.
  
  Please provide the output strictly as a JSON object with the following schema:
  {
    "title": "A catchy title for the weekend",
    "description": "Short summary",
    "days": [
      {
        "day": "Saturday",
        "activities": [
          { "time": "Morning", "title": "...", "description": "...", "location": "..." },
          { "time": "Afternoon", "title": "...", "description": "...", "location": "..." },
          { "time": "Evening", "title": "...", "description": "...", "location": "..." }
        ]
      }
    ]
  }
  Do not include any other text besides the JSON code.`;

  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [
      { role: "user", content: "Generate the itinerary JSON." }
    ],
    temperature: 0.7,
  };

  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await client.send(command);
    const resultString = new TextDecoder().decode(response.body);
    const result = JSON.parse(resultString);

    const jsonExtract = result.content[0].text;
    const startIndex = jsonExtract.indexOf('{');
    const endIndex = jsonExtract.lastIndexOf('}');
    
    if (startIndex !== -1 && endIndex !== -1) {
      return JSON.parse(jsonExtract.substring(startIndex, endIndex + 1));
    }
    return JSON.parse(jsonExtract);

  } catch (error) {
    console.error('Error calling Bedrock:', error);
    throw new Error('Failed to generate itinerary');
  }
};

export const generateChatReply = async (messages: any[], context: any) => {
  const systemPrompt = `You are a helpful Auckland local tour guide AI. The user has generated a weekend itinerary based on these preferences and context: ${JSON.stringify(context)}. 
  Answer their follow-up questions, suggest alternative activities, or adjust the plan. Keep it conversational, helpful, and concise. Format your answers in Markdown.`;

  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1500,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    temperature: 0.7,
  };

  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await client.send(command);
    const resultString = new TextDecoder().decode(response.body);
    const result = JSON.parse(resultString);

    return result.content[0].text;
  } catch (error) {
    console.error('Error calling Bedrock for chat:', error);
    throw new Error('Failed to generate chat reply');
  }
};
