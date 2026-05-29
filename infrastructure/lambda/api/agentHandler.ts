/**
 * Agent Handler - Conversational AI Assistant for Auckland Weekend Planner
 * Handles chat interactions with multi-LLM fallback and rate limiting
 */

import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
import { LLMFallbackChain, LLMInvokeOptions } from '../shared/llm';
import { 
  checkRateLimit, 
  generateCacheKey, 
  getCachedData, 
  setCachedData,
  logMetric,
  hashIP 
} from '../shared/rateLimit';

// In-memory cache for SSM parameters (survives across warm Lambda invocations)
let cachedGeminiApiKey: string | undefined = undefined;

/**
 * Load Gemini API key from SSM Parameter Store with in-memory caching
 */
async function getGeminiApiKey(): Promise<string | undefined> {
  if (cachedGeminiApiKey) {
    console.log('[SSM] Using cached Gemini API key');
    return cachedGeminiApiKey;
  }

  try {
    const ssmClient = new SSMClient({ region: 'ap-southeast-2' });
    const command = new GetParameterCommand({
      Name: '/AucklandPlanner/Config/GEMINI_API_KEY',
      WithDecryption: true
    });

    const response = await ssmClient.send(command);
    cachedGeminiApiKey = response.Parameter?.Value;
    
    if (cachedGeminiApiKey) {
      console.log('[SSM] Successfully loaded and cached Gemini API key');
    } else {
      console.warn('[SSM] Gemini API key not found in Parameter Store');
    }

    return cachedGeminiApiKey;
  } catch (error) {
    console.error('[SSM] Error loading Gemini API key:', error);
    return undefined;
  }
}

/**
 * Handle agent chat requests
 */
export async function handleAgentRequest(
  event: any,
  docClient: DynamoDBDocumentClient,
  tableName: string
): Promise<any> {
  console.log('[Agent] Processing agent request');

  try {
    // Extract IP address for rate limiting
    const ipAddress = event.requestContext?.http?.sourceIp || 'unknown';
    console.log(`[Agent] Request from IP: ${ipAddress}`);

    // Check rate limit (40 requests/IP/day)
    const rateLimitResult = await checkRateLimit(docClient, tableName, ipAddress);
    
    if (!rateLimitResult.allowed) {
      console.warn(`[Agent] Rate limit exceeded for IP: ${ipAddress}`);
      return {
        statusCode: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetAt)
        },
        body: JSON.stringify({
          error: 'Rate limit exceeded',
          message: `You have exceeded the daily limit of ${rateLimitResult.limit} requests. Please try again tomorrow.`,
          resetAt: rateLimitResult.resetAt
        })
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { 
      userMessage, 
      currentItinerary, 
      selectedDates, 
      region, 
      audience, 
      budget,
      chatHistory
    } = body;

    if (!userMessage) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'userMessage is required' })
      };
    }

    console.log(`[Agent] User message: ${userMessage.substring(0, 100)}...`);

    // Generate cache key (including chatHistory to avoid collision on multi-turn conversations)
    const cacheKey = generateCacheKey({
      userMessage,
      currentItinerary,
      selectedDates,
      region,
      audience,
      budget,
      chatHistory
    });

    // Check cache
    const cachedResponse = await getCachedData(docClient, tableName, cacheKey);
    if (cachedResponse) {
      console.log('[Agent] Returning cached response');
      return {
        statusCode: 200,
        headers: { 
          'Content-Type': 'application/json', 
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'HIT'
        },
        body: cachedResponse
      };
    }

    // Fetch available events from DynamoDB
    const events = await fetchAvailableEvents(docClient, tableName, selectedDates);
    console.log(`[Agent] Fetched ${events.length} available events`);

    // Build context for LLM
    const systemInstruction = buildSystemInstruction(audience, budget, region);
    const prompt = buildAgentPrompt(userMessage, currentItinerary, events, selectedDates, chatHistory);

    // Initialize LLM with fallback chain
    const geminiApiKey = await getGeminiApiKey();
    const llm = new LLMFallbackChain(geminiApiKey);

    // Invoke LLM with JSON response format
    const llmOptions: LLMInvokeOptions = {
      prompt,
      systemInstruction,
      maxTokens: 2000,
      temperature: 0.7,
      responseFormat: 'json'
    };

    const llmResponse = await llm.invoke(llmOptions);

    // Log metrics
    await logMetric(docClient, tableName, {
      provider: llmResponse.provider,
      model: llmResponse.model,
      inputTokens: llmResponse.inputTokens,
      outputTokens: llmResponse.outputTokens,
      fallbackCount: llmResponse.fallbackCount,
      errorReason: llmResponse.errorReason,
      latencyMs: llmResponse.latencyMs,
      ipHash: hashIP(ipAddress),
      endpoint: '/api/v2/agent'
    });

    if (!llmResponse.success) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          error: 'All LLM providers failed',
          message: 'Unable to process your request at this time. Please try again later.',
          details: llmResponse.errorReason
        })
      };
    }

    // Parse agent response
    const agentResponse = LLMFallbackChain.parseAgentResponse(llmResponse.content);

    const responseBody = JSON.stringify({
      success: true,
      message: agentResponse.message,
      commands: agentResponse.commands || [],
      provider: llmResponse.provider,
      model: llmResponse.model,
      fallbackCount: llmResponse.fallbackCount
    });

    // Cache the response
    await setCachedData(docClient, tableName, cacheKey, responseBody, { ttlSeconds: 3600 }); // 1 hour cache

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json', 
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS',
        'X-RateLimit-Remaining': String(rateLimitResult.limit - rateLimitResult.currentCount)
      },
      body: responseBody
    };

  } catch (error) {
    console.error('[Agent] Error processing request:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: errorMessage
      })
    };
  }
}

/**
 * Fetch available events from DynamoDB for the selected dates
 */
async function fetchAvailableEvents(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  selectedDates: string[]
): Promise<any[]> {
  if (!selectedDates || selectedDates.length === 0) {
    return [];
  }

  const sorted = [...selectedDates].sort();
  const startDate = sorted[0];
  const endDate = sorted[sorted.length - 1];

  try {
    const query = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":pk": "REGION#AUCKLAND",
        ":start": `EVENT#${startDate}`,
        ":end": `EVENT#${endDate}\uffff`
      },
      Limit: 100 // Limit to 100 events for context window
    });

    const result = await docClient.send(query);
    return result.Items || [];
  } catch (error) {
    console.error('[Agent] Error fetching events:', error);
    return [];
  }
}

/**
 * Build system instruction for the LLM
 */
function buildSystemInstruction(audience: string, budget: string, region: string[]): string {
  return `You are an AI assistant for the Auckland Weekend Planner. Your role is to help users modify their weekend itinerary through natural conversation.

RESPONSE FORMAT:
You MUST respond with valid JSON in this exact structure:
{
  "message": "Your conversational response to the user",
  "commands": [
    {
      "type": "REMOVE" | "ADD" | "SWAP",
      "dayIdx": 0,
      "slotIdx": 1,
      "actIdx": 0,
      "eventId": "12345"
    }
  ]
}

COMMAND TYPES:
- REMOVE: Remove an activity from the itinerary (requires dayIdx, slotIdx, actIdx)
- ADD: Add an event to a time slot (requires dayIdx, slotIdx, actIdx, eventId)
- SWAP: Replace an activity with another event (requires dayIdx, slotIdx, actIdx, eventId)

USER PREFERENCES:
- Audience: ${audience}
- Budget: ${budget}
- Regions: ${Array.isArray(region) ? region.join(', ') : region}

GUIDELINES:
1. Be conversational and friendly
2. Explain why you're making changes
3. Only include commands when you're actually modifying the itinerary
4. If just answering a question, set commands to an empty array
5. Respect the user's preferences (audience, budget, region)
6. Prioritize family-friendly events for Family audience`;
}

/**
 * Build the agent prompt with context and multi-turn chat history
 */
function buildAgentPrompt(
  userMessage: string,
  currentItinerary: any,
  events: any[],
  selectedDates: string[],
  chatHistory?: Array<{ role: string; content: string }>
): string {
  const itineraryContext = currentItinerary 
    ? `\n\nCURRENT ITINERARY:\n${JSON.stringify(currentItinerary, null, 2)}`
    : '\n\nNo itinerary has been created yet.';

  const eventsContext = events.length > 0
    ? `\n\nAVAILABLE EVENTS:\n${events.slice(0, 50).map((e: any, idx: number) => 
        `${idx}. [ID: ${e.SK?.split('#')[2]}] ${e.name} - ${e.location_summary} (${e.is_free ? 'Free' : 'Paid'})`
      ).join('\n')}`
    : '\n\nNo specific events available for the selected dates.';

  const datesContext = selectedDates && selectedDates.length > 0
    ? `\n\nSELECTED DATES: ${selectedDates.join(', ')}`
    : '';

  let historyContext = '';
  if (chatHistory && chatHistory.length > 0) {
    historyContext = `\n\nCONVERSATION HISTORY:\n${chatHistory.map(m => {
      const speaker = m.role === 'user' ? 'User' : 'Assistant';
      return `${speaker}: ${m.content}`;
    }).join('\n')}`;
  }

  return `${itineraryContext}${eventsContext}${datesContext}${historyContext}

USER MESSAGE: ${userMessage}

Please respond with your suggestions and any itinerary modifications in the required JSON format.`;
}

// Made with Bob
