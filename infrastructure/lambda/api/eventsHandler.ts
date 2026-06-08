import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { computeTwoWeekendRanges } from '../shared/utils';

/**
 * GET /api/v2/events
 *
 * Returns raw event data for the upcoming two weekends without invoking the LLM.
 * This allows the frontend to display an event browser on page load.
 * Does NOT count against rate limits.
 *
 * Query params (all optional):
 *   - startDate: ISO YYYY-MM-DD  (defaults to this weekend's Saturday)
 *   - endDate:   ISO YYYY-MM-DD  (defaults to next weekend's Sunday)
 */
export async function handleEventsRequest(
  event: any,
  docClient: DynamoDBDocumentClient,
  tableName: string
) {
  try {
    // Parse optional date range from query string parameters
    const queryParams = event.queryStringParameters || {};
    
    let startDate: string;
    let endDate: string;

    if (queryParams.startDate && queryParams.endDate) {
      startDate = queryParams.startDate;
      endDate = queryParams.endDate;
    } else {
      // Default: cover both this weekend and next weekend so the browser is always populated
      const ranges = computeTwoWeekendRanges();
      startDate = ranges.thisWeekend.saturday;
      endDate = ranges.nextWeekend.sunday;
    }

    console.log(`[eventsHandler] Fetching events from ${startDate} to ${endDate}`);

    // Query DynamoDB for all events in the date range
    const query = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":pk": "REGION#AUCKLAND",
        ":start": `EVENT#${startDate}`,
        ":end": `EVENT#${endDate}\uffff`
      },
    });

    const eventsData = await docClient.send(query);
    const rawEvents = eventsData.Items || [];
    console.log(`[eventsHandler] Retrieved ${rawEvents.length} raw events`);

    // Map DynamoDB records to the frontend EventData shape
    const events = rawEvents.map((e: any) => ({
      id: e.SK ? e.SK.split('#')[2] : null,
      name: e.name || '',
      description: e.description || '',
      url: e.url || '',
      datetime_start: e.datetime_start || '',
      datetime_end: e.datetime_end || '',
      location_summary: e.location_summary || '',
      is_free: Boolean(e.is_free),
      image_url: e.image_url || '',
      source: e.source || (e.seenInSources && e.seenInSources[0]) || 'eventfinda',
      mapped_region: e.mapped_region || 'Unknown',
    }));

    // Filter out events with no valid ID (shouldn't happen but defensive)
    const validEvents = events.filter((e: any) => e.id);

    console.log(`[eventsHandler] Returning ${validEvents.length} events`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // 10-minute browser cache to reduce DynamoDB reads on rapid refreshes
        'Cache-Control': 'public, max-age=600',
      },
      body: JSON.stringify({
        success: true,
        events: validEvents,
        meta: {
          count: validEvents.length,
          startDate,
          endDate,
        }
      })
    };

  } catch (error: any) {
    console.error('[eventsHandler] Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch events',
        message: error.message,
      })
    };
  }
}
