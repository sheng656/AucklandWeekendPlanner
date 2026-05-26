"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Droplets, Wind, ChevronDown, CalendarDays, Eye, EyeOff } from "lucide-react";

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
  const [showAllDaysMobile, setShowAllDaysMobile] = useState(false);
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

  // Filter weekend days for mobile collapsed mode
  const weekendDays = weather.forecast.filter(day => day.isWeekend);

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
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="text-xs font-extrabold text-zinc-600 dark:text-zinc-300 uppercase tracking-widest flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-blue-500" />
                Weather Forecast
              </div>
              <span className="text-[10px] text-zinc-400 font-semibold md:hidden">
                {showAllDaysMobile ? "14-Day View" : "Weekend Focus"}
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold hidden md:inline">
                Auckland (14 Days)
              </span>
            </div>

            {/* ================= DESKTOP VIEW: 2-Row Grid (7 Columns × 2 Rows) ================= */}
            <div className="hidden md:flex flex-col gap-5 min-w-[560px] lg:min-w-[620px]">
              {/* Week 1 */}
              <div>
                <div className="text-[9px] uppercase font-extrabold tracking-widest text-zinc-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  This Week
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {weather.forecast.slice(0, 7).map((day) => (
                    <div
                      key={day.date}
                      className={`weather-day-card border transition-all ${
                        day.isWeekend
                          ? "bg-gradient-to-b from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/80 dark:border-blue-900/40 shadow-sm"
                          : "border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
                      }`}
                    >
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        day.isWeekend
                          ? "bg-blue-100/70 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}>
                        {day.dayName}
                      </span>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">
                        {day.date.slice(5).replace('-', '/')}
                      </span>
                      <span className="text-2xl leading-none my-1" title={day.description}>
                        {weatherEmoji(day.icon)}
                      </span>
                      <div className="text-center">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{day.temp_max}°</span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-0.5">{day.temp_min}°</span>
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
              </div>

              {/* Week 2 */}
              <div>
                <div className="text-[9px] uppercase font-extrabold tracking-widest text-zinc-400 dark:text-zinc-500 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  Next Week
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {weather.forecast.slice(7, 14).map((day) => (
                    <div
                      key={day.date}
                      className={`weather-day-card border transition-all ${
                        day.isWeekend
                          ? "bg-gradient-to-b from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/80 dark:border-blue-900/40 shadow-sm"
                          : "border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20"
                      }`}
                    >
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        day.isWeekend
                          ? "bg-blue-100/70 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300"
                          : "text-zinc-400 dark:text-zinc-500"
                      }`}>
                        {day.dayName}
                      </span>
                      <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium">
                        {day.date.slice(5).replace('-', '/')}
                      </span>
                      <span className="text-2xl leading-none my-1" title={day.description}>
                        {weatherEmoji(day.icon)}
                      </span>
                      <div className="text-center">
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{day.temp_max}°</span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-0.5">{day.temp_min}°</span>
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
              </div>
            </div>

            {/* ================= MOBILE VIEW: Option B (Core Weekends Focus / Collapsible View) ================= */}
            <div className="md:hidden max-w-[85vw] sm:max-w-[340px]">
              {!showAllDaysMobile ? (
                /* Collapsed: 2x2 Grid of Core Weekends */
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] font-semibold text-zinc-400 mb-1">
                    ✨ Featured target weekends:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {weekendDays.map((day) => (
                      <div
                        key={day.date}
                        className="weather-day-card relative border bg-gradient-to-b from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/80 dark:border-blue-900/40 shadow-sm p-2.5 flex flex-col items-center justify-between text-center min-h-[110px]"
                      >
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100/70 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
                          {day.dayName}
                        </span>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-semibold my-0.5">
                          {day.date.slice(5).replace('-', '/')}
                        </span>
                        <span className="text-2.5xl leading-none my-1" title={day.description}>
                          {weatherEmoji(day.icon)}
                        </span>
                        <div className="text-center font-bold text-xs text-zinc-800 dark:text-zinc-200">
                          {day.temp_max}°<span className="text-[10px] text-zinc-400 dark:text-zinc-500 ml-1 font-normal">{day.temp_min}°</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Expanded: Elegant Compact Vertical List of all 14 Days */
                <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-1 no-scrollbar scroll-smooth">
                  {weather.forecast.map((day) => (
                    <div
                      key={day.date}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all ${
                        day.isWeekend
                          ? "bg-gradient-to-r from-blue-50/30 to-indigo-50/30 dark:from-blue-950/10 dark:to-indigo-950/10 border-blue-100/60 dark:border-blue-900/30"
                          : "border-zinc-100/60 dark:border-zinc-800/40 bg-zinc-50/10 dark:bg-zinc-800/5"
                      }`}
                    >
                      {/* Date & Day Badge */}
                      <div className="flex items-center gap-1.5">
                        <span className={`w-11 text-[9px] font-extrabold uppercase py-0.5 rounded-full text-center tracking-wider ${
                          day.isWeekend 
                            ? "bg-blue-100/70 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300" 
                            : "bg-zinc-100/50 dark:bg-zinc-800/40 text-zinc-400 dark:text-zinc-500"
                        }`}>
                          {day.dayName}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                          {day.date.slice(5).replace('-', '/')}
                        </span>
                      </div>

                      {/* Weather Emoji & Description */}
                      <div className="flex items-center gap-1 flex-1 pl-3 pr-2 min-w-0">
                        <span className="text-lg leading-none flex-shrink-0">{weatherEmoji(day.icon)}</span>
                        <span className="text-[9px] text-zinc-500 dark:text-zinc-400 truncate">{day.description}</span>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        {/* Humidity */}
                        <div className="flex items-center gap-0.5 text-[9px] text-zinc-400">
                          <Droplets className="w-2.5 h-2.5 text-blue-400/80" />
                          {day.humidity}%
                        </div>
                        {/* Temps */}
                        <div className="text-right font-bold w-11 text-zinc-700 dark:text-zinc-300">
                          {day.temp_max}°<span className="text-zinc-400 dark:text-zinc-500 font-normal ml-0.5">{day.temp_min}°</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Toggle Button for Mobile */}
              <button
                onClick={() => setShowAllDaysMobile(!showAllDaysMobile)}
                className="w-full text-center text-[10px] font-bold text-blue-500 hover:text-blue-600 mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-center gap-1 cursor-pointer transition-colors"
              >
                {showAllDaysMobile ? (
                  <>
                    <EyeOff className="w-3 h-3" />
                    Show Less (Weekends Focus)
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3" />
                    Show All 14 Days
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
