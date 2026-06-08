import { NextResponse } from 'next/server';

// Proxy for GET /api/v2/events — forwards to the backend Lambda events endpoint.
// Allows the frontend to fetch all upcoming weekend events on page load without CORS issues.
export async function GET(request: Request) {
  try {
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;

    if (!apiUrl) {
      return NextResponse.json(
        { error: 'API_URL is not configured.' },
        { status: 500 }
      );
    }

    // Forward any query parameters (startDate, endDate) to the backend
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();
    const fullUrl = `${apiUrl.replace(/\/+$/, '')}/api/v2/events${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // 10-minute cache matching the backend Cache-Control header
      next: { revalidate: 600 },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Events proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to backend API' },
      { status: 500 }
    );
  }
}
