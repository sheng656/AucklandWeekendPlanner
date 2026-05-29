/**
 * Rate Limiting & Caching Utilities
 * Uses DynamoDB with TTL for zero-cost storage management
 */

import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import * as crypto from 'crypto';

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  resetAt: number; // Unix timestamp
}

/**
 * Check and increment rate limit for an IP address
 * Limit: 40 requests per IP per day
 */
export async function checkRateLimit(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  ipAddress: string
): Promise<RateLimitResult> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const pk = `LIMIT#IP#${ipAddress}`;
  const sk = `DATE#${today}`;
  
  // Calculate TTL: midnight of next day (UTC)
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  const ttl = Math.floor(tomorrow.getTime() / 1000);

  const DAILY_LIMIT = 40;

  try {
    // Try to get existing record
    const getResult = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { PK: pk, SK: sk }
    }));

    if (getResult.Item) {
      const currentCount = getResult.Item.count || 0;
      
      if (currentCount >= DAILY_LIMIT) {
        return {
          allowed: false,
          currentCount,
          limit: DAILY_LIMIT,
          resetAt: ttl
        };
      }

      // Increment count
      const updateResult = await docClient.send(new UpdateCommand({
        TableName: tableName,
        Key: { PK: pk, SK: sk },
        UpdateExpression: 'SET #count = #count + :inc',
        ExpressionAttributeNames: { '#count': 'count' },
        ExpressionAttributeValues: { ':inc': 1 },
        ReturnValues: 'ALL_NEW'
      }));

      return {
        allowed: true,
        currentCount: updateResult.Attributes?.count || currentCount + 1,
        limit: DAILY_LIMIT,
        resetAt: ttl
      };
    } else {
      // Create new record with count = 1
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
          PK: pk,
          SK: sk,
          count: 1,
          ttl,
          createdAt: new Date().toISOString()
        }
      }));

      return {
        allowed: true,
        currentCount: 1,
        limit: DAILY_LIMIT,
        resetAt: ttl
      };
    }
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      currentCount: 0,
      limit: DAILY_LIMIT,
      resetAt: ttl
    };
  }
}

// ============================================================================
// Request Caching
// ============================================================================

export interface CacheOptions {
  ttlSeconds?: number; // Default: 24 hours
}

export interface CachedData {
  data: any;
  cachedAt: string;
  expiresAt: number;
}

/**
 * Generate cache key from request parameters
 */
export function generateCacheKey(params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {} as Record<string, any>);
  
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify(sortedParams))
    .digest('hex');
  
  return `CACHE#${hash}`;
}

/**
 * Get cached data if it exists and hasn't expired
 */
export async function getCachedData(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  cacheKey: string
): Promise<any | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { PK: cacheKey, SK: 'AGENT_RESULT' }
    }));

    if (result.Item && result.Item.data) {
      console.log(`[Cache] Hit for key: ${cacheKey}`);
      return result.Item.data;
    }

    console.log(`[Cache] Miss for key: ${cacheKey}`);
    return null;
  } catch (error) {
    console.error('[Cache] Error reading cache:', error);
    return null;
  }
}

/**
 * Store data in cache with TTL
 */
export async function setCachedData(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  cacheKey: string,
  data: any,
  options: CacheOptions = {}
): Promise<void> {
  const ttlSeconds = options.ttlSeconds || 86400; // 24 hours default
  const ttl = Math.floor(Date.now() / 1000) + ttlSeconds;
  const now = new Date().toISOString();

  try {
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: cacheKey,
        SK: 'AGENT_RESULT',
        data,
        cachedAt: now,
        ttl
      }
    }));

    console.log(`[Cache] Stored data for key: ${cacheKey} (expires in ${ttlSeconds}s)`);
  } catch (error) {
    console.error('[Cache] Error writing cache:', error);
    // Don't throw - caching is optional
  }
}

// ============================================================================
// Metrics Logging
// ============================================================================

export interface MetricData {
  provider: 'GoogleAIStudio' | 'AWSBedrock';
  model: string;
  inputTokens: number;
  outputTokens: number;
  fallbackCount: number;
  errorReason?: string;
  latencyMs: number;
  ipHash: string; // Hashed for GDPR compliance
  endpoint: string; // '/api/v2/agent' or '/api/v2/plan'
}

/**
 * Log LLM invocation metrics to DynamoDB
 */
export async function logMetric(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  metric: MetricData
): Promise<void> {
  const timestamp = new Date().toISOString();
  const pk = 'METRIC#LOG';
  const sk = `TIMESTAMP#${timestamp}`;
  
  // TTL: 30 days from now
  const ttl = Math.floor(Date.now() / 1000) + (30 * 86400);

  try {
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: pk,
        SK: sk,
        ...metric,
        timestamp,
        ttl
      }
    }));

    console.log(`[Metrics] Logged: ${metric.provider}/${metric.model} - ${metric.latencyMs}ms`);
  } catch (error) {
    console.error('[Metrics] Error logging metric:', error);
    // Don't throw - metrics are optional
  }
}

/**
 * Hash IP address for GDPR-compliant logging
 */
export function hashIP(ipAddress: string): string {
  return crypto
    .createHash('sha256')
    .update(ipAddress + process.env.IP_SALT || 'auckland-planner-salt')
    .digest('hex')
    .substring(0, 16);
}

// Made with Bob
