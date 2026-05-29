import { NextResponse } from 'next/server';

// Proxy for agent/chat endpoint to bypass CORS during local development
export async function POST(request: Request) {
  try {
    const body = await request.json();
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;

    if (!apiUrl) {
      return NextResponse.json(
        { error: 'API_URL is not configured and no fallback is available.' }, 
        { status: 500 }
      );
    }
    
    apiUrl = `${apiUrl.replace(/\/+$/, '')}/api/v2/agent`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Agent proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to agent API' }, 
      { status: 500 }
    );
  }
}

// Made with Bob
