/**
 * LLM Provider Integration Module
 * Supports multi-tier fallback: Gemini Flash-Lite → Gemini Flash → Bedrock Claude
 */

import { BedrockRuntimeClient, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime";

// ============================================================================
// Type Definitions
// ============================================================================

export interface LLMResponse {
  success: boolean;
  content: string;
  provider: 'GoogleAIStudio' | 'AWSBedrock';
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  errorReason?: string;
  fallbackCount: number;
}

export interface LLMInvokeOptions {
  prompt: string;
  systemInstruction?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'text' | 'json';
}

export interface AgentCommand {
  type: 'REMOVE' | 'ADD' | 'SWAP';
  dayIdx?: number;
  slotIdx?: number;
  actIdx?: number;
  eventId?: string;
}

export interface AgentResponse {
  message: string;
  commands?: AgentCommand[];
}

// ============================================================================
// Google AI Studio Provider
// ============================================================================

class GoogleAIStudioProvider {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async invoke(
    model: string,
    options: LLMInvokeOptions
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const startTime = Date.now();
    
    const requestBody: any = {
      contents: [{
        parts: [{ text: options.prompt }]
      }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2000,
      }
    };

    // Add system instruction if provided
    if (options.systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: options.systemInstruction }]
      };
    }

    // Enable JSON mode if requested
    if (options.responseFormat === 'json') {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 second timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: any = await response.json();
      
      // Extract content from response
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Extract token usage
      const inputTokens = data.usageMetadata?.promptTokenCount || 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

      return { content, inputTokens, outputTokens };
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout after 6 seconds');
      }
      throw error;
    }
  }
}

// ============================================================================
// AWS Bedrock Provider
// ============================================================================

class AWSBedrockProvider {
  private client: BedrockRuntimeClient;
  private modelId = 'global.anthropic.claude-haiku-4-5-20251001-v1:0';

  constructor(region: string = 'ap-southeast-2') {
    this.client = new BedrockRuntimeClient({ region });
  }

  async invoke(
    options: LLMInvokeOptions
  ): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
    const invokeParams = {
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options.maxTokens ?? 2000,
        temperature: options.temperature ?? 0.7,
        system: options.systemInstruction || undefined,
        messages: [
          { role: "user", content: options.prompt }
        ]
      })
    };

    const command = new InvokeModelWithResponseStreamCommand(invokeParams);
    const response = await this.client.send(command);

    if (!response.body) {
      throw new Error('No response body from Bedrock');
    }

    // Collect streamed response
    let fullResponse = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of response.body) {
      if (chunk.chunk?.bytes) {
        const parsed = JSON.parse(Buffer.from(chunk.chunk.bytes).toString());
        
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          fullResponse += parsed.delta.text;
        }
        
        if (parsed.type === 'message_start' && parsed.message?.usage) {
          inputTokens = parsed.message.usage.input_tokens || 0;
        }
        
        if (parsed.type === 'message_delta' && parsed.usage) {
          outputTokens = parsed.usage.output_tokens || 0;
        }
      }
    }

    return { content: fullResponse, inputTokens, outputTokens };
  }
}

// ============================================================================
// Multi-Tier Fallback Chain
// ============================================================================

export class LLMFallbackChain {
  private googleProvider: GoogleAIStudioProvider | null = null;
  private bedrockProvider: AWSBedrockProvider;

  constructor(geminiApiKey?: string) {
    if (geminiApiKey) {
      this.googleProvider = new GoogleAIStudioProvider(geminiApiKey);
    }
    this.bedrockProvider = new AWSBedrockProvider();
  }

  /**
   * Invoke LLM with automatic fallback chain:
   * 1. Gemini 2.5 Flash-Lite (free, fast)
   * 2. Gemini 2.5 Flash (free, robust)
   * 3. AWS Bedrock Claude 4.5 Haiku (paid, guaranteed)
   */
  async invoke(options: LLMInvokeOptions): Promise<LLMResponse> {
    const startTime = Date.now();
    let fallbackCount = 0;
    let lastError: any = null;

    // Tier 1: Gemini 2.5 Flash-Lite
    if (this.googleProvider) {
      try {
        console.log('[LLM] Attempting Tier 1: Gemini 2.5 Flash-Lite');
        const result = await this.googleProvider.invoke('gemini-2.5-flash-lite', options);
        
        // Validate JSON if required
        if (options.responseFormat === 'json') {
          this.validateJSON(result.content);
        }

        const latencyMs = Date.now() - startTime;
        console.log(`[LLM] ✓ Tier 1 success (${latencyMs}ms)`);
        
        return {
          success: true,
          content: result.content,
          provider: 'GoogleAIStudio',
          model: 'gemini-2.5-flash-lite',
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs,
          fallbackCount: 0
        };
      } catch (error: any) {
        lastError = error;
        fallbackCount++;
        console.warn(`[LLM] ✗ Tier 1 failed: ${error.message}`);
      }
    }

    // Tier 2: Gemini 2.5 Flash
    if (this.googleProvider) {
      try {
        console.log('[LLM] Attempting Tier 2: Gemini 2.5 Flash');
        const result = await this.googleProvider.invoke('gemini-2.5-flash', options);
        
        // Validate JSON if required
        if (options.responseFormat === 'json') {
          this.validateJSON(result.content);
        }

        const latencyMs = Date.now() - startTime;
        console.log(`[LLM] ✓ Tier 2 success (${latencyMs}ms)`);
        
        return {
          success: true,
          content: result.content,
          provider: 'GoogleAIStudio',
          model: 'gemini-2.5-flash',
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs,
          fallbackCount: 1
        };
      } catch (error: any) {
        lastError = error;
        fallbackCount++;
        console.warn(`[LLM] ✗ Tier 2 failed: ${error.message}`);
      }
    }

    // Tier 3: AWS Bedrock Claude 4.5 Haiku (Ultimate Fallback)
    try {
      console.log('[LLM] Attempting Tier 3: AWS Bedrock Claude 4.5 Haiku');
      const result = await this.bedrockProvider.invoke(options);
      
      // Validate JSON if required
      if (options.responseFormat === 'json') {
        this.validateJSON(result.content);
      }

      const latencyMs = Date.now() - startTime;
      console.log(`[LLM] ✓ Tier 3 success (${latencyMs}ms)`);
      
      return {
        success: true,
        content: result.content,
        provider: 'AWSBedrock',
        model: 'claude-4.5-haiku',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs,
        fallbackCount: 2
      };
    } catch (error: any) {
      lastError = error;
      console.error(`[LLM] ✗ Tier 3 failed: ${error.message}`);
    }

    // All tiers failed
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      content: '',
      provider: 'AWSBedrock',
      model: 'none',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs,
      errorReason: lastError?.message || 'All LLM providers failed',
      fallbackCount
    };
  }

  /**
   * Validate JSON response and throw if invalid
   */
  private validateJSON(content: string): void {
    try {
      // Clean up potential markdown code fences
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      JSON.parse(jsonStr);
    } catch (error) {
      throw new Error('Invalid JSON response from LLM');
    }
  }

  /**
   * Parse agent response with commands
   */
  static parseAgentResponse(content: string): AgentResponse {
    try {
      // Clean up potential markdown code fences
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      const parsed = JSON.parse(jsonStr);
      
      return {
        message: parsed.message || content,
        commands: parsed.commands || []
      };
    } catch (error) {
      // Fallback: treat entire content as message
      return {
        message: content,
        commands: []
      };
    }
  }
}

// Made with Bob
