"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Droplets, Wind, ChevronDown, CalendarDays } from "lucide-react";

import type { WeatherData, WeatherForecast } from "../../types";

// Map exact date to forecast for inline hint
export function getWeatherHint(
  forecast: WeatherForecast[],
  isoDate: string
): { icon: string; temp: string } | null {
  if (!forecast.length) return null;
  
  const target = forecast.find(f => f.date === isoDate);
  if (!target) return null;
  
  return { icon: target.icon, temp: `${target.temp_min}–${target.temp_max}°` };
}

// Emoji-based weather icons for clear display at any size
export function weatherEmoji(code: string): string {
  const numericCode = parseInt(code, 10);
  if (isNaN(numericCode)) {
    // Fallback to old behavior if a legacy OpenWeather code is passed
    const base = code.replace('n', 'd');
    const map: Record<string, string> = {
      '01d': '☀️', // clear sky
      '02d': '⛅',  // few clouds
      '03d': '☁️', // scattered clouds
      '04d': '☁️', // broken/overcast clouds
      '09d': '🌧️', // shower rain
      '10d': '🌦️', // rain
      '11d': '⛈️',  // thunderstorm
      '13d': '🌨️', // snow
      '50d': '🌫️', // mist
    };
    return map[base] || '☁️';
  }

  // WMO weather interpretation codes
  if (numericCode === 0) return '☀️'; // Clear sky
  if (numericCode === 1 || numericCode === 2) return '⛅'; // Mainly clear / partly cloudy
  if (numericCode === 3) return '☁️'; // Overcast
  if (numericCode === 45 || numericCode === 48) return '🌫️'; // Foggy
  if (numericCode === 51 || numericCode === 53 || numericCode === 55) return '🌦️'; // Drizzle
  if (numericCode === 56 || numericCode === 57) return '🌦️'; // Freezing drizzle
  if (numericCode === 61 || numericCode === 63 || numericCode === 65) return '🌧️'; // Rain
  if (numericCode === 66 || numericCode === 67) return '🌧️'; // Freezing rain
  if (numericCode === 71 || numericCode === 73 || numericCode === 75) return '🌨️'; // Snowfall
  if (numericCode === 77) return '🌨️'; // Snow grains
  if (numericCode === 80 || numericCode === 81 || numericCode === 82) return '🌧️'; // Rain showers
  if (numericCode === 85 || numericCode === 86) return '🌨️'; // Snow showers
  if (numericCode >= 95) return '⛈️'; // Thunderstorm
  return '☁️';
}

interface WeatherWidgetProps {
  weather: WeatherData | null;
  error?: boolean;
}

export default function WeatherWidget({ weather, error }: WeatherWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    if (expanded) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [expanded]);

  if (error || !weather) {
    return (
      <div className="weather-pill">
        <Cloud className="w-4 h-4 text-zinc-400" />
        <span className="text-sm text-zinc-500">{error ? "—" : "..."}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="weather-pill group"
        aria-label="Toggle weather forecast"
      >
        {weather.current && (
          <>
            <span className="text-base md:text-lg leading-none">
              {weatherEmoji(weather.current.icon)}
            </span>
            <span className="text-xs md:text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {weather.current.temp}°C
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="weather-forecast-panel"
            style={{ right: 0 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                14-Day Forecast
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 animate-pulse">
                Scroll to see more →
              </span>
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar max-w-[88vw] sm:max-w-[480px] md:max-w-[620px] snap-x scroll-smooth">
              {weather.forecast.map((day) => (
                <div
                  key={day.date}
                  className={`weather-day-card snap-start relative border transition-all ${
                    day.isWeekend
                      ? "bg-gradient-to-b from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/80 dark:border-blue-900/40 shadow-sm"
                      : "border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
                  }`}
                >
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                    day.isWeekend
                      ? "bg-blue-100/70 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}>
                    {day.dayName}
                  </span>
                  
                  <span className="text-2.5xl leading-none my-1" title={day.description}>
                    {weatherEmoji(day.icon)}
                  </span>
                  
                  <div className="text-center">
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{day.temp_max}°</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-0.5">{day.temp_min}°</span>
                  </div>
                  
                  <div className="flex items-center gap-1 text-[9px] text-zinc-400 dark:text-zinc-500 mt-1">
                    <Droplets className="w-2.5 h-2.5 text-blue-400" />
                    {day.humidity}%
                  </div>
                  
                  <div className="flex items-center gap-1 text-[9px] text-zinc-400 dark:text-zinc-500">
                    <Wind className="w-2.5 h-2.5 text-cyan-400" />
                    {day.windSpeed}m/s
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
