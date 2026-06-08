"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Settings, RotateCcw, Calendar, CheckSquare, Sparkles } from "lucide-react";
import PreferencePanel from "./PreferencePanel";
import DayTimeline from "./DayTimeline";
import ExportActions from "./ExportActions";
import { weatherEmoji } from "./WeatherWidget";

interface TimelinePanelProps {
  plannerState: any;
}

export default function TimelinePanel({ plannerState }: TimelinePanelProps) {
  const {
    audience, setAudience,
    budget, setBudget,
    selectedDates, toggleDate, availableDates,
    region, toggleRegion,
    isLoading,
    itinerary,
    recommendedEvents,
    swappingSlot,
    weatherForecast,
    handlePlanWeekend,
    handleReset,
    handleRemoveActivity,
    handleSwapClick,
    createEmptyTimeline
  } = plannerState;

  const [showPrefs, setShowPrefs] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingSteps = [
    "Analyzing your preferences...",
    "Searching for matching events...",
    "Evaluating locations and travel times...",
    "Optimizing schedule for your budget...",
    "Finalizing your weekend itinerary..."
  ];

  // Advance loading steps
  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep((prev) => Math.min(prev + 1, loadingSteps.length - 1));
    }, 2500);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Weather extraction helper
  const getTimelineWeather = (dayName: string) => {
    const target = weatherForecast.find((f: any) => {
      const dow = new Date(f.date).getDay();
      if (dayName === "Saturday") return dow === 6;
      if (dayName === "Sunday") return dow === 0;
      return false;
    });
    if (!target) return {};
    return {
      icon: target.icon,
      temp: `${target.temp_min}–${target.temp_max}°C`,
    };
  };

  return (
    <div className="flex flex-col h-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl overflow-hidden shadow-xl">
      {/* Header (only visible when in timeline/loading state) */}
      {(itinerary || isLoading) && (
        <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-white/20 dark:bg-slate-900/20 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Calendar className="text-blue-500" size={18} />
              Weekend Schedule
            </h2>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              Review, edit, and export your personal weekend plans.
            </p>
          </div>

          {!isLoading && itinerary && (
            <button
              onClick={() => setShowPrefs(prev => !prev)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                showPrefs
                  ? "bg-blue-50 border-blue-200 text-blue-500 dark:bg-blue-950/20 dark:border-blue-900"
                  : "bg-white/50 border-gray-200 text-gray-500 hover:text-gray-700 dark:bg-slate-900/50 dark:border-white/10 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
              title="Toggle Preferences"
            >
              <Settings size={16} className={showPrefs ? "animate-spin-once" : ""} />
            </button>
          )}
        </div>
      )}

      {/* Main Panel Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-0">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col gap-4">
            <div className="skeleton-card">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <motion.span 
                  key={loadingStep}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-semibold text-blue-600"
                >
                  {loadingSteps[loadingStep]}
                </motion.span>
              </div>
              <div className="space-y-3">
                <div className="skeleton-bar w-2/3" />
                <div className="skeleton-bar w-4/5" />
                <div className="skeleton-bar w-1/2" />
                <div className="skeleton-bar w-3/4" />
              </div>
            </div>
            <div className="skeleton-card">
              <div className="space-y-3">
                <div className="skeleton-bar w-1/3" />
                <div className="skeleton-bar w-3/5" />
                <div className="skeleton-bar w-2/5" />
              </div>
            </div>
          </div>
        )}

        {/* Config Mode (Default State, no timeline and not loading) */}
        {!isLoading && !itinerary && (
          <div className="space-y-4">
            <PreferencePanel
              audience={audience}
              setAudience={setAudience}
              budget={budget}
              setBudget={setBudget}
              selectedDates={selectedDates}
              toggleDate={toggleDate}
              availableDates={availableDates}
              region={region}
              toggleRegion={toggleRegion}
              weatherForecast={weatherForecast}
              onGenerate={handlePlanWeekend}
              onBuildManually={() => createEmptyTimeline(selectedDates)}
            />
          </div>
        )}

        {/* Itinerary Mode (with collapsible preferences panel) */}
        {!isLoading && itinerary && (
          <div className="space-y-4">
            <AnimatePresence>
              {showPrefs && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pb-3 border-b border-gray-100 dark:border-white/5">
                    <PreferencePanel
                      audience={audience}
                      setAudience={setAudience}
                      budget={budget}
                      setBudget={setBudget}
                      selectedDates={selectedDates}
                      toggleDate={toggleDate}
                      availableDates={availableDates}
                      region={region}
                      toggleRegion={toggleRegion}
                      weatherForecast={weatherForecast}
                      onGenerate={() => {
                        handlePlanWeekend();
                        setShowPrefs(false);
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {itinerary.map((day: any, idx: number) => {
                const w = getTimelineWeather(day.dayName);
                return (
                  <DayTimeline
                    key={idx}
                    day={day}
                    dayIndex={idx}
                    weatherIcon={w.icon}
                    weatherTemp={w.temp}
                    recommendedEvents={recommendedEvents}
                    swappingSlot={swappingSlot}
                    onSwapClick={handleSwapClick}
                    onRemoveClick={handleRemoveActivity}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer (Reset / Export actions, only when itinerary is active and not loading) */}
      {!isLoading && itinerary && (
        <div className="p-4 border-t border-gray-100 dark:border-white/5 bg-white/20 dark:bg-slate-900/20 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300 text-[11px] font-bold transition-all cursor-pointer"
          >
            <RotateCcw size={13} className="text-blue-500" />
            Start Over
          </button>
          <ExportActions plan={itinerary} />
        </div>
      )}
    </div>
  );
}
