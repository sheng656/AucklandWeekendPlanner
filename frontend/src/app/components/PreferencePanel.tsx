"use client";

import { motion } from "framer-motion";
import { Sparkles, Users, Wallet, CalendarDays, Map } from "lucide-react";
import { getWeatherHint, weatherEmoji } from "./WeatherWidget";
import { audienceOptions, budgetOptions, regionOptions, choicePill, choicePillActive } from "../../lib/constants";
import type { Audience, Budget, SelectedDate, Region, WeatherForecast } from "../../types";

interface PreferencePanelProps {
  audience: Audience;
  setAudience: (v: Audience) => void;
  budget: Budget;
  setBudget: (v: Budget) => void;
  selectedDates: SelectedDate[];
  toggleDate: (v: SelectedDate) => void;
  availableDates: { thisWeekend: SelectedDate[]; nextWeekend: SelectedDate[] };
  region: Region[];
  toggleRegion: (v: Region) => void;
  weatherForecast: WeatherForecast[];
  onGenerate: () => void;
  onBuildManually?: () => void;
}

export default function PreferencePanel({
  audience, setAudience,
  budget, setBudget,
  selectedDates, toggleDate,
  availableDates,
  region, toggleRegion,
  weatherForecast,
  onGenerate,
  onBuildManually
}: PreferencePanelProps) {
  const spring = { type: "spring" as const, stiffness: 300, damping: 20 };

  return (
    <motion.section
      key="preferences"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, y: -15 }}
      transition={spring}
      className="glass-panel p-3 md:p-6 flex flex-col relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-600" />

      <div className="mb-2 md:mb-5 mt-0.5">
        <h2 className="text-base md:text-xl font-bold flex items-center gap-2 text-zinc-800">
          <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
          Design Your Perfect Weekend
        </h2>
        <p className="text-[11px] md:text-sm text-zinc-500 mt-0.5">
          Set your preferences and let AI craft a personalized itinerary
          with real events.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-4 preference-grid">
        {/* Who */}
        <div className="bg-white/40 dark:bg-zinc-800/40 border border-white/60 dark:border-zinc-700/60 rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-zinc-600 mb-2 md:mb-2.5">
            <Users className="w-4 h-4 text-blue-500" /> Who&apos;s going?
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {audienceOptions.map((o) => (
              <button
                key={o}
                onClick={() => setAudience(o)}
                className={audience === o ? choicePillActive : choicePill}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div className="bg-white/40 dark:bg-zinc-800/40 border border-white/60 dark:border-zinc-700/60 rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-zinc-600 mb-2 md:mb-2.5">
            <Wallet className="w-4 h-4 text-blue-500" /> Budget Level
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {budgetOptions.map((o) => (
              <button
                key={o}
                onClick={() => setBudget(o)}
                className={budget === o ? choicePillActive : choicePill}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* When — with weather hints */}
        <div className="bg-white/40 dark:bg-zinc-800/40 border border-white/60 dark:border-zinc-700/60 rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-zinc-600 mb-2">
            <CalendarDays className="w-4 h-4 text-blue-500" /> When?
          </div>
          <div className="space-y-3">
            {availableDates.thisWeekend.length > 0 && (
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                  This Weekend
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {availableDates.thisWeekend.map((o) => {
                    const isSelected = selectedDates.some((d) => d.date === o.date);
                    const hint = getWeatherHint(weatherForecast, o.date);
                    return (
                      <button
                        key={o.date}
                        onClick={() => toggleDate(o)}
                        className={isSelected ? choicePillActive : choicePill}
                      >
                        <span className="text-[11px] md:text-xs font-semibold">{o.label}</span>
                        {hint && (
                          <span className="weather-hint mt-0.5">
                            <span className="text-xs md:text-sm">{weatherEmoji(hint.icon)}</span>
                            <span className="text-[9px] md:text-[10px] ml-0.5">{hint.temp}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {availableDates.nextWeekend.length > 0 && (
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                  Next Weekend
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {availableDates.nextWeekend.map((o) => {
                    const isSelected = selectedDates.some((d) => d.date === o.date);
                    const hint = getWeatherHint(weatherForecast, o.date);
                    return (
                      <button
                        key={o.date}
                        onClick={() => toggleDate(o)}
                        className={isSelected ? choicePillActive : choicePill}
                      >
                        <span className="text-[11px] md:text-xs font-semibold">{o.label}</span>
                        {hint && (
                          <span className="weather-hint mt-0.5">
                            <span className="text-xs md:text-sm">{weatherEmoji(hint.icon)}</span>
                            <span className="text-[9px] md:text-[10px] ml-0.5">{hint.temp}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Where */}
        <div className="bg-white/40 dark:bg-zinc-800/40 border border-white/60 dark:border-zinc-700/60 rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-xs md:text-sm font-semibold text-zinc-600 mb-2 md:mb-2.5">
            <Map className="w-4 h-4 text-blue-500" /> Where?
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {regionOptions.map((o) => (
              <button
                key={o}
                onClick={() => toggleRegion(o)}
                className={region.includes(o) ? choicePillActive : choicePill}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
      </div>

      <motion.button
        onClick={onGenerate}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 md:px-6 md:py-3.5 text-white font-bold text-sm md:text-base shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-shadow cursor-pointer relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-white/20 w-full h-full -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12" />
        <span className="flex items-center justify-center gap-2 relative z-10">
          <Sparkles className="w-4 h-4 md:w-5 md:h-5" /> Generate Itinerary
        </span>
      </motion.button>

      {onBuildManually && (
        <button
          onClick={onBuildManually}
          className="mt-3 w-full text-center text-xs font-semibold text-blue-500 hover:text-blue-600 hover:underline transition-all cursor-pointer"
        >
          Or build your own itinerary manually →
        </button>
      )}
    </motion.section>
  );
}
