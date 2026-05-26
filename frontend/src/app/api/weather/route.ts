import { NextResponse } from 'next/server';

const AUCKLAND_LAT = -36.8485;
const AUCKLAND_LON = 174.7633;

interface DailyForecast {
  date: string;
  dayName: string;
  temp_min: number;
  temp_max: number;
  icon: string; // WMO weather code string
  description: string;
  humidity: number;
  windSpeed: number;
  isWeekend: boolean;
}

const rateLimit = new Map<string, { count: number; expiresAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// Helper to convert WMO code to human description
function getWMODescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code === 51 || code === 53 || code === 55) return "Drizzle";
  if (code === 56 || code === 57) return "Freezing drizzle";
  if (code === 61) return "Light rain";
  if (code === 63) return "Moderate rain";
  if (code === 65) return "Heavy rain";
  if (code === 66 || code === 67) return "Freezing rain";
  if (code === 71 || code === 73 || code === 75) return "Snowfall";
  if (code === 77) return "Snow grains";
  if (code === 80 || code === 81 || code === 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Cloudy";
}

export async function GET(request: Request) {
  // Simple in-memory rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const now = Date.now();
  const record = rateLimit.get(ip);
  if (record && record.expiresAt > now) {
    if (record.count >= RATE_LIMIT_MAX) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    record.count++;
  } else {
    rateLimit.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
  }

  try {
    // Fetch 14-day weather forecast with current weather from free Open-Meteo API
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${AUCKLAND_LAT}&longitude=${AUCKLAND_LON}&daily=weather_code,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_max&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=Pacific/Auckland&forecast_days=14`;

    const res = await fetch(url, { next: { revalidate: 1800 } });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Open-Meteo API error:', res.status, errText);
      return NextResponse.json(
        { error: `Open-Meteo API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Map current weather
    const current = data.current ? {
      temp: Math.round(data.current.temperature_2m),
      icon: String(data.current.weather_code),
      description: getWMODescription(data.current.weather_code),
      humidity: Math.round(data.current.relative_humidity_2m),
    } : null;

    // Map 14-day daily forecast
    const forecast: DailyForecast[] = [];
    const daily = data.daily || {};
    const times = daily.time || [];

    for (let i = 0; i < times.length; i++) {
      const dateKey = times[i];
      const [year, month, day] = dateKey.split('-').map(Number);
      const nzDate = new Date(year, month - 1, day);
      const dayOfWeek = nzDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayName = nzDate.toLocaleDateString('en-NZ', { weekday: 'short' });

      forecast.push({
        date: dateKey,
        dayName,
        temp_min: Math.round(daily.temperature_2m_min?.[i] ?? 0),
        temp_max: Math.round(daily.temperature_2m_max?.[i] ?? 0),
        icon: String(daily.weather_code?.[i] ?? 0),
        description: getWMODescription(daily.weather_code?.[i] ?? 0),
        humidity: Math.round(daily.relative_humidity_2m_mean?.[i] ?? 0),
        windSpeed: Math.round((daily.wind_speed_10m_max?.[i] ?? 0) * 10) / 10,
        isWeekend,
      });
    }

    return NextResponse.json({ current, forecast });
  } catch (error) {
    console.error('Weather API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    );
  }
}
