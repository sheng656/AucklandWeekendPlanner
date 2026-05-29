/**
 * Metrics Handler - Aggregates model usage, fallback, latency, and token metrics from DynamoDB
 */

import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

export async function handleMetricsRequest(
  event: any,
  docClient: DynamoDBDocumentClient,
  tableName: string
): Promise<any> {
  console.log('[Metrics] Aggregating operational statistics');

  try {
    // Query last 100 logs from DynamoDB (descending order)
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': 'METRIC#LOG'
      },
      ScanIndexForward: false, // Newest first
      Limit: 100
    });

    const result = await docClient.send(command);
    const logs = result.Items || [];

    // Aggregate statistics
    const totalCount = logs.length;
    let totalLatency = 0;
    let fallbackCallsCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    
    const modelDistribution: Record<string, number> = {};
    const providerDistribution: Record<string, number> = {};
    const modelLatency: Record<string, { count: number; sum: number }> = {};
    const recentErrors: Array<{ model: string; error: string; timestamp: string }> = [];

    for (const log of logs) {
      // Latency
      totalLatency += log.latencyMs || 0;

      // Fallbacks
      if (log.fallbackCount && log.fallbackCount > 0) {
        fallbackCallsCount++;
      }

      // Tokens
      totalInputTokens += log.inputTokens || 0;
      totalOutputTokens += log.outputTokens || 0;

      // Models
      const model = log.model || 'Unknown';
      modelDistribution[model] = (modelDistribution[model] || 0) + 1;

      // Providers
      const provider = log.provider || 'Unknown';
      providerDistribution[provider] = (providerDistribution[provider] || 0) + 1;

      // Latency by model
      if (!modelLatency[model]) {
        modelLatency[model] = { count: 0, sum: 0 };
      }
      modelLatency[model].count++;
      modelLatency[model].sum += log.latencyMs || 0;

      // Errors
      if (log.errorReason) {
        recentErrors.push({
          model,
          error: log.errorReason,
          timestamp: log.timestamp || new Date().toISOString()
        });
      }
    }

    // Format Model Latencies and Percentages
    const aggregatedModels = Object.keys(modelDistribution).map(model => ({
      model,
      count: modelDistribution[model],
      percentage: totalCount > 0 ? Math.round((modelDistribution[model] / totalCount) * 100) : 0,
      avgLatencyMs: modelLatency[model].count > 0 ? Math.round(modelLatency[model].sum / modelLatency[model].count) : 0
    }));

    const aggregatedProviders = Object.keys(providerDistribution).map(provider => ({
      provider,
      count: providerDistribution[provider],
      percentage: totalCount > 0 ? Math.round((providerDistribution[provider] / totalCount) * 100) : 0
    }));

    const aggregatedStats = {
      totalInvocations: totalCount,
      avgLatencyMs: totalCount > 0 ? Math.round(totalLatency / totalCount) : 0,
      fallbackRatePercentage: totalCount > 0 ? Math.round((fallbackCallsCount / totalCount) * 100) : 0,
      totalTokensUsed: totalInputTokens + totalOutputTokens,
      avgTokensPerRequest: totalCount > 0 ? Math.round((totalInputTokens + totalOutputTokens) / totalCount) : 0,
      modelStats: aggregatedModels,
      providerStats: aggregatedProviders,
      recentErrors: recentErrors.slice(0, 10), // Limit to last 10 errors
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({
        success: true,
        summary: aggregatedStats,
        rawLogs: logs.slice(0, 50) // Return only the last 50 logs to keep payload size small
      })
    };

  } catch (error) {
    console.error('[Metrics] Aggregation failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown internal server error'
      })
    };
  }
}
