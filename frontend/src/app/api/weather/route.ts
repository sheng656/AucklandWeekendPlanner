import { NextResponse } from 'next/server';

const AUCKLAND_LAT = -36.8485;
const AUCKLAND_LON = 174.7633;

interface ForecastEntry {
  dt: number;
  main: { temp: number; temp_min: number; temp_max: number; humidity: number };
  weather: { id: number; main: string; description: string; icon: string }[];
  wind: { speed: number };
}

interface DailyForecast {
  date: string;
  dayName: string;
  temp_min: number;
  temp_max: number;
  icon: string;
  description: string;
  humidity: number;
  windSpeed: number;
  isWeekend: boolean;
}

export async function GET() {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenWeather API key not configured' },
      { status: 500 }
    );
  }

  try {
    // Fetch 5-day / 3-hour forecast (free tier)
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${AUCKLAND_LAT}&lon=${AUCKLAND_LON}&appid=${apiKey}&units=metric`;
    const forecastRes = await fetch(forecastUrl, { next: { revalidate: 1800 } }); // cache 30 min

    if (!forecastRes.ok) {
      const errText = await forecastRes.text();
      console.error('OpenWeather forecast error:', forecastRes.status, errText);
      return NextResponse.json(
        { error: `OpenWeather API error: ${forecastRes.status}` },
        { status: forecastRes.status }
      );
    }

    const forecastData = await forecastRes.json();
    const entries: ForecastEntry[] = forecastData.list || [];

    // Also fetch current weather
    const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${AUCKLAND_LAT}&lon=${AUCKLAND_LON}&appid=${apiKey}&units=metric`;
    const currentRes = await fetch(currentUrl, { next: { revalidate: 1800 } });
    let current = null;

    if (currentRes.ok) {
      const currentData = await currentRes.json();
      current = {
        temp: Math.round(currentData.main.temp),
        icon: currentData.weather[0]?.icon || '01d',
        description: currentData.weather[0]?.description || 'clear sky',
        humidity: currentData.main.humidity,
      };
    }

    // Aggregate 3-hour entries into daily summaries using NZ timezone date key
    const dailyMap = new Map<string, ForecastEntry[]>();
    for (const entry of entries) {
      // Use YYYY-MM-DD format in NZ timezone as key for consistent grouping
      const nzDateStr = new Date(entry.dt * 1000).toLocaleDateString('en-CA', {
        timeZone: 'Pacific/Auckland',
      }); // en-CA gives YYYY-MM-DD format
      if (!dailyMap.has(nzDateStr)) {
        dailyMap.set(nzDateStr, []);
      }
      dailyMap.get(nzDateStr)!.push(entry);
    }

    const forecast: DailyForecast[] = [];
    for (const [dateKey, dayEntries] of dailyMap) {
      if (forecast.length >= 5) break;

      // Parse dateKey (YYYY-MM-DD) to get day of week in NZ timezone
      const [year, month, day] = dateKey.split('-').map(Number);
      const nzDate = new Date(year, month - 1, day);
      const dayOfWeek = nzDate.getDay(); // 0=Sun, 6=Sat

      // Find the midday entry (in NZ time) for representative weather icon
      const middayEntry = dayEntries.find(e => {
        const nzHour = parseInt(new Date(e.dt * 1000).toLocaleString('en-US', {
          timeZone: 'Pacific/Auckland', hour: 'numeric', hour12: false,
        }));
        return nzHour >= 11 && nzHour <= 14;
      }) || dayEntries[Math.floor(dayEntries.length / 2)];

      const tempMin = Math.round(Math.min(...dayEntries.map(e => e.main.temp_min)));
      const tempMax = Math.round(Math.max(...dayEntries.map(e => e.main.temp_max)));
      const avgHumidity = Math.round(dayEntries.reduce((sum, e) => sum + e.main.humidity, 0) / dayEntries.length);
      const avgWind = Math.round(dayEntries.reduce((sum, e) => sum + e.wind.speed, 0) / dayEntries.length * 10) / 10;

      const dayName = nzDate.toLocaleDateString('en-NZ', { weekday: 'short' });

      forecast.push({
        date: dateKey,
        dayName,
        temp_min: tempMin,
        temp_max: tempMax,
        icon: middayEntry.weather[0]?.icon || '01d',
        description: middayEntry.weather[0]?.description || 'clear sky',
        humidity: avgHumidity,
        windSpeed: avgWind,
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
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
