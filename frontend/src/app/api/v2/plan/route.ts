import { NextResponse } from 'next/server';

// This proxy is primarily for local development to bypass CORS or when NEXT_PUBLIC_API_URL is not set
export async function POST(request: Request) {
  try {
    const body = await request.json();
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;

    if (!apiUrl) {
      // Provide a mock response or error if backend is truly not configured
      return NextResponse.json({ error: 'API_URL is not configured and no fallback is available.' }, { status: 500 });
    }
    
    apiUrl = apiUrl.replace(/\/+$/, '');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Failed to connect to backend API' }, { status: 500 });
  }
}
