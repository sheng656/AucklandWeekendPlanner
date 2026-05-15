"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Droplets, Wind, ChevronDown } from "lucide-react";

import type { WeatherData, WeatherForecast, WeatherCurrent } from "../../types";

// Map day option to forecast for inline hint
export function getWeatherHint(
  forecast: WeatherForecast[],
  dayOption: string
): { icon: string; temp: string } | null {
  if (!forecast.length) return null;
  
  const target = forecast.find(f => {
    const day = new Date(f.date).getDay();
    if (dayOption === "Saturday") return day === 6;
    if (dayOption === "Sunday") return day === 0;
    return false;
  });
  
  if (dayOption === "Both Days") {
    return null;
  }

  if (!target) return null;
  return { icon: target.icon, temp: `${target.temp_min}–${target.temp_max}°` };
}

// Emoji-based weather icons for clear display at any size
export function weatherEmoji(code: string): string {
  const base = code.replace('n', 'd'); // normalize night to day
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
            <span className="text-xs md:text-sm font-semibold text-zinc-700">
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
          >
            <div className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wider">
              5-Day Forecast
            </div>
            <div className="flex gap-2">
              {weather.forecast.map((day) => (
                <div
                  key={day.date}
                  className={`weather-day-card ${day.isWeekend ? "weather-day-weekend" : ""}`}
                >
                  <span className={`text-xs font-bold ${day.isWeekend ? "text-blue-600" : "text-zinc-500"}`}>
                    {day.dayName}
                  </span>
                  <span className="text-2xl leading-none">
                    {weatherEmoji(day.icon)}
                  </span>
                  <div className="text-center">
                    <span className="text-sm font-bold text-zinc-800">{day.temp_max}°</span>
                    <span className="text-xs text-zinc-400 ml-0.5">{day.temp_min}°</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                    <Droplets className="w-2.5 h-2.5" />
                    {day.humidity}%
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                    <Wind className="w-2.5 h-2.5" />
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

