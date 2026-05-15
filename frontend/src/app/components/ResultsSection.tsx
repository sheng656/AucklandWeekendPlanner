"use client";

import { useState, useEffect } from "react";

import { motion } from "framer-motion";
import { Loader2, RotateCcw } from "lucide-react";
import DayTimeline from "./DayTimeline";
import MoreEvents from "./MoreEvents";
import ExportActions from "./ExportActions";
import type { DayPlan, EventData, WeatherForecast } from "../../types";

interface ResultsSectionProps {
  isLoading: boolean;
  itinerary: DayPlan[] | null;
  rawItinerary: string | null;
  recommendedEvents: EventData[];
  otherEvents: EventData[];
  region: string[];
  swappingSlot: { dayIdx: number; slotIdx: number; actIdx: number } | null;
  moreEventsOpen: boolean;
  moreEventsRef: React.RefObject<HTMLDivElement | null>;
  weatherForecast: WeatherForecast[];
  onSwapClick: (dayIdx: number, slotIdx: number, actIdx: number) => void;
  onRemoveClick: (dayIdx: number, slotIdx: number, actIdx: number) => void;
  onToggleMoreEvents: () => void;
  onSelectEvent: (event: EventData) => void;
  onReset: () => void;
  onRetry: () => void;
}

export default function ResultsSection({
  isLoading,
  itinerary,
  rawItinerary,
  recommendedEvents,
  otherEvents,
  region,
  swappingSlot,
  moreEventsOpen,
  moreEventsRef,
  weatherForecast,
  onSwapClick,
  onRemoveClick,
  onToggleMoreEvents,
  onSelectEvent,
  onReset,
  onRetry
}: ResultsSectionProps) {

  // Get weather for a specific day in the timeline
  function getTimelineWeather(dayName: string) {
    const target = weatherForecast.find((f) => {
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
  }

  // Filter events based on active swap slot
  const displayEvents = (() => {
    if (!swappingSlot || !itinerary) return otherEvents;
    const period = itinerary[swappingSlot.dayIdx]?.timeSlots[swappingSlot.slotIdx]?.period;
    if (!period) return otherEvents;

    return otherEvents.filter((e) => {
      if (!e.datetime_start) return true;
      const hour = new Date(e.datetime_start).getHours();
      switch (period) {
        case "Morning": return hour >= 5 && hour < 12;
        case "Lunch": return hour >= 11 && hour < 15;
        case "Afternoon": return hour >= 12 && hour < 18;
        case "Evening": return hour >= 17 || hour < 5;
        default: return true;
      }
    });
  })();

  const [loadingStep, setLoadingStep] = useState(0);
  const loadingSteps = [
    "Analyzing your preferences...",
    "Searching for matching events...",
    "Evaluating locations and travel times...",
    "Optimizing schedule for your budget...",
    "Finalizing your weekend itinerary..."
  ];

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

  return (
    <motion.section
      key="results"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 pb-6"
    >
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
                className="text-sm font-semibold text-blue-600"
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

      {/* Structured Timeline */}
      {!isLoading && itinerary && (
        <>
          {itinerary.map((day, idx) => {
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
                onSwapClick={onSwapClick}
                onRemoveClick={onRemoveClick}
              />
            );
          })}

          {/* More Events */}
          <div ref={moreEventsRef}>
            <MoreEvents
              events={displayEvents}
              isOpen={moreEventsOpen}
              onToggle={onToggleMoreEvents}
              swappingActive={swappingSlot !== null}
              onSelectEvent={onSelectEvent}
              selectedRegions={region}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between flex-wrap gap-3 mt-2">
            <button
              onClick={onReset}
              className="export-button"
            >
              <RotateCcw className="w-4 h-4 text-blue-500" />
              <span>Start Over</span>
            </button>
            <ExportActions plan={itinerary} />
          </div>
        </>
      )}

      {/* Fallback: Raw itinerary text */}
      {!isLoading && rawItinerary && !itinerary && (
        <div className="glass-panel p-6">
          <p className="text-sm text-zinc-600 whitespace-pre-wrap leading-relaxed">
            {rawItinerary}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={onReset}
              className="export-button"
            >
              <RotateCcw className="w-4 h-4 text-blue-500" />
              <span>Start Over</span>
            </button>
            <button
              onClick={onRetry}
              className="export-button bg-blue-50 hover:bg-blue-100"
            >
              <RotateCcw className="w-4 h-4 text-blue-500" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}
    </motion.section>
  );
}
