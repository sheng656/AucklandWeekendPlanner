"use client";

import React, { useEffect, useRef } from "react";
import { X, Calendar, Clock, CalendarPlus } from "lucide-react";
import type { DayPlan, EventData } from "../../types";

interface AddToTimelineDropdownProps {
  event: EventData;
  itinerary: DayPlan[];
  onSelect: (dayIdx: number, slotIdx: number) => void;
  onAddNewDay: () => void;
  onClose: () => void;
}

export default function AddToTimelineDropdown({
  event,
  itinerary,
  onSelect,
  onAddNewDay,
  onClose,
}: AddToTimelineDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onClose]);

  // Determine if the event's date is already in the itinerary
  const eventDateStr = event.datetime_start
    ? (() => {
        const d = new Date(event.datetime_start);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })()
    : null;

  const isNewDay = !!eventDateStr && !itinerary.some((day) => day.date === eventDateStr);

  const eventDayLabel = event.datetime_start
    ? new Date(event.datetime_start).toLocaleDateString("en-NZ", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  const periods = ["Morning", "Lunch", "Afternoon", "Evening"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
      <div
        ref={containerRef}
        className="w-full max-w-sm rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl p-5 relative overflow-hidden transform scale-100 transition-transform duration-200"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-1 flex items-center gap-1.5 pr-6">
          <Calendar className="text-blue-500" size={16} />
          Add Event to Planner
        </h3>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-4 line-clamp-1">
          {event.name}
        </p>

        {/* Primary action: add new day (shown when event date isn't in plan) */}
        {isNewDay && eventDayLabel && (
          <div className="mb-2">
            <button
              onClick={() => { onAddNewDay(); onClose(); }}
              className="w-full py-2.5 px-3 rounded-xl bg-blue-500 hover:bg-blue-600 active:scale-[0.98] text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
            >
              <CalendarPlus size={14} />
              Add {eventDayLabel} to your plan
            </button>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 text-center">
              Creates a new day and places this event automatically
            </p>
          </div>
        )}

        {/* Slot picker for existing days — only shown when event date is already in the itinerary */}
        {!isNewDay && (
          <div className="space-y-4 max-h-[260px] overflow-y-auto no-scrollbar">
            {itinerary.length === 0 ? (
              <p className="text-[11px] text-gray-400 text-center py-4">
                No days in your plan yet.
              </p>
            ) : (
              itinerary.map((day, dayIdx) => (
                <div key={day.date} className="border-b border-gray-100 dark:border-white/5 last:border-none pb-3 last:pb-0">
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    {day.dayName}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {periods.map((period, slotIdx) => (
                      <button
                        key={period}
                        onClick={() => {
                          onSelect(dayIdx, slotIdx);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 justify-center py-2 px-3 rounded-lg border border-gray-100 dark:border-white/5 bg-gray-50/50 hover:bg-blue-50 hover:border-blue-200 dark:bg-white/5 dark:hover:bg-blue-950/30 dark:hover:border-blue-900 text-[11px] font-medium text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 transition-all cursor-pointer"
                      >
                        <Clock size={12} />
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
