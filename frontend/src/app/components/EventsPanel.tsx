"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Calendar, MapPin, DollarSign, Clock, Share2, Tag, ChevronDown, Check, Plus, ArrowRightLeft } from "lucide-react";
import type { EventData, Region, SelectedDate, DayPlan } from "../../types";
import { regionOptions } from "../../lib/constants";

interface EventsPanelProps {
  // useEvents hook outputs
  eventsState: any;
  // usePlanner hook outputs
  plannerState: any;
}

export default function EventsPanel({ eventsState, plannerState }: EventsPanelProps) {
  const {
    filteredEvents,
    paginatedEvents,
    isLoading,
    error,
    filters,
    toggleSource,
    toggleRegion,
    toggleDate,
    toggleTime,
    setCost,
    setKeyword,
    clearFilters,
    currentPage,
    totalPages,
    setCurrentPage,
    syncFiltersFromPreferences,
  } = eventsState;

  const {
    itinerary,
    swappingSlot,
    handleSelectEvent,
    handleManualAdd,
    recommendedEvents,
    selectedDates,
    region: preferenceRegions,
    activeAddEventSelector,
    setActiveAddEventSelector
  } = plannerState;

  // Auto-sync initial filters when preference changes
  useEffect(() => {
    const datesStr = selectedDates.map((d: SelectedDate) => d.date);
    syncFiltersFromPreferences(datesStr, preferenceRegions);
  }, [selectedDates, preferenceRegions, syncFiltersFromPreferences]);

  // Dropdown open states
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(prev => (prev === name ? null : name));
  };

  // Close dropdowns on click outside
  const filtersRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sourcesList = [
    { value: "eventfinda", label: "Eventfinda" },
    { value: "ourauckland-surface", label: "OurAuckland" },
    { value: "aucklandforkids", label: "Auckland for Kids" },
  ];

  const timesList = ["Morning", "Afternoon", "Evening"];
  const costList: ("All" | "Free" | "Paid")[] = ["All", "Free", "Paid"];

  // Helper to format source display names
  const getSourceLabel = (src: string) => {
    switch (src) {
      case "eventfinda": return "Eventfinda";
      case "ourauckland-surface": return "OurAuckland";
      case "aucklandforkids": return "Auckland for Kids";
      default: return src;
    }
  };

  const isEventInItinerary = (eventId: string) => {
    if (!itinerary) return false;
    return (itinerary as DayPlan[]).some((day: DayPlan) => 
      day.timeSlots.some(slot => 
        slot.activities.some(act => String(act.eventId) === String(eventId))
      )
    );
  };

  return (
    <div className="flex flex-col h-full bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-white/5 bg-white/20 dark:bg-slate-900/20">
        <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <Tag className="text-blue-500" size={18} />
          Explore Events in Auckland
        </h2>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
          Browse and add curated weekend events directly to your timeline.
        </p>
      </div>

      {/* Filter Row */}
      <div ref={filtersRef} className="p-3 bg-white/10 dark:bg-slate-900/10 border-b border-gray-100 dark:border-white/5 space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          {/* Keyword Search */}
          <div className="relative col-span-1 md:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={14} />
            <input
              type="text"
              placeholder="Search events..."
              value={filters.keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 text-xs text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Region Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("region")}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 text-xs text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-slate-900/80 transition-colors"
            >
              <span className="truncate">
                {filters.regions.length === 0 ? "All Regions" : `${filters.regions.length} Regions`}
              </span>
              <ChevronDown size={12} className="text-gray-400" />
            </button>
            {openDropdown === "region" && (
              <div className="absolute left-0 mt-1 w-52 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-100 dark:border-white/10 rounded-xl shadow-xl p-2 space-y-1">
                {regionOptions.map((r: Region) => (
                  <label key={r} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.regions.includes(r)}
                      onChange={() => toggleRegion(r)}
                      className="rounded text-blue-500 focus:ring-blue-400 w-3.5 h-3.5"
                    />
                    {r}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Date Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("date")}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 text-xs text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-slate-900/80 transition-colors"
            >
              <span className="truncate">
                {filters.dates.length === 0 ? "All Dates" : `${filters.dates.length} Dates`}
              </span>
              <ChevronDown size={12} className="text-gray-400" />
            </button>
            {openDropdown === "date" && (
              <div className="absolute left-0 mt-1 w-52 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-100 dark:border-white/10 rounded-xl shadow-xl p-2 space-y-1">
                {selectedDates.map((d: SelectedDate) => (
                  <label key={d.date} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.dates.includes(d.date)}
                      onChange={() => toggleDate(d.date)}
                      className="rounded text-blue-500 focus:ring-blue-400 w-3.5 h-3.5"
                    />
                    {d.dayName} ({d.label})
                  </label>
                ))}
                {selectedDates.length === 0 && (
                  <div className="text-[10px] text-gray-400 p-2 text-center">No dates selected in preferences</div>
                )}
              </div>
            )}
          </div>

          {/* Source Dropdown */}
          <div className="relative">
            <button
              onClick={() => toggleDropdown("source")}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 text-xs text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-slate-900/80 transition-colors"
            >
              <span className="truncate">
                {filters.sources.length === 0 ? "All Sources" : `${filters.sources.length} Sources`}
              </span>
              <ChevronDown size={12} className="text-gray-400" />
            </button>
            {openDropdown === "source" && (
              <div className="absolute left-0 mt-1 w-52 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-100 dark:border-white/10 rounded-xl shadow-xl p-2 space-y-1">
                {sourcesList.map((src) => (
                  <label key={src.value} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.sources.includes(src.value)}
                      onChange={() => toggleSource(src.value)}
                      className="rounded text-blue-500 focus:ring-blue-400 w-3.5 h-3.5"
                    />
                    {src.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Time & Cost Inline Options */}
          <div className="grid grid-cols-2 gap-2">
            {/* Cost Select */}
            <div className="relative">
              <select
                value={filters.cost}
                onChange={(e) => setCost(e.target.value as any)}
                className="w-full px-2 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 text-xs text-gray-600 dark:text-gray-300 focus:outline-none appearance-none"
              >
                {costList.map((c) => (
                  <option key={c} value={c}>{c === "All" ? "Any Price" : c}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" />
            </div>

            {/* Time Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown("time")}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-slate-900/50 text-xs text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-slate-900/80 transition-colors"
              >
                <span className="truncate">
                  {filters.times.length === 0 ? "Any Time" : `${filters.times.length} Times`}
                </span>
                <ChevronDown size={12} className="text-gray-400" />
              </button>
              {openDropdown === "time" && (
                <div className="absolute right-0 mt-1 w-40 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-100 dark:border-white/10 rounded-xl shadow-xl p-2 space-y-1">
                  {timesList.map((t) => (
                    <label key={t} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.times.includes(t)}
                        onChange={() => toggleTime(t)}
                        className="rounded text-blue-500 focus:ring-blue-400 w-3.5 h-3.5"
                      />
                      {t}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clear Filters Button */}
        {eventsState.activeFilterCount > 0 && (
          <div className="flex justify-end pt-1">
            <button
              onClick={clearFilters}
              className="text-[10px] font-semibold text-blue-500 hover:text-blue-600 hover:underline transition-all cursor-pointer"
            >
              Clear all filters ({eventsState.activeFilterCount})
            </button>
          </div>
        )}
      </div>

      {/* Main Events Grid Area */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0 no-scrollbar">
        {isLoading ? (
          // Skeleton loader
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-60 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 p-3 flex flex-col justify-between animate-pulse">
                <div className="w-full h-24 rounded-lg bg-gray-200 dark:bg-slate-800"></div>
                <div className="space-y-2 py-2 flex-1">
                  <div className="h-3 w-1/3 bg-gray-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-4 w-5/6 bg-gray-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-3 w-2/3 bg-gray-200 dark:bg-slate-800 rounded"></div>
                </div>
                <div className="h-7 w-full bg-gray-200 dark:bg-slate-800 rounded"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        ) : paginatedEvents.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">No events match your search criteria.</p>
            <button
              onClick={clearFilters}
              className="mt-3 px-4 py-1.5 rounded-full bg-blue-500 text-white text-[11px] font-bold shadow-md shadow-blue-500/10 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {paginatedEvents.map((event: EventData) => {
              const inTimeline = isEventInItinerary(event.id);
              return (
                <div
                  key={event.id}
                  className={`group flex flex-col justify-between rounded-xl bg-white/70 dark:bg-slate-900/60 border dark:border-white/5 shadow-sm transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${
                    inTimeline ? "border-emerald-500/30 bg-emerald-50/10 dark:bg-emerald-950/5" : "border-gray-100"
                  }`}
                >
                  {/* Event Media */}
                  <div className="h-24 w-full relative overflow-hidden rounded-t-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
                    {event.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={event.image_url}
                        alt={event.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <Tag className="text-blue-500/30" size={24} />
                    )}

                    {/* Source pill */}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/40 backdrop-blur-md text-[9px] font-bold text-white uppercase tracking-wider">
                      {getSourceLabel(event.source || "")}
                    </div>

                    {/* Free/Paid Badge */}
                    <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${
                      event.is_free ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
                    }`}>
                      {event.is_free ? "Free" : "Paid"}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Name */}
                      <h3 className="text-xs font-bold text-gray-800 dark:text-white line-clamp-2 leading-snug hover:text-blue-500 transition-colors">
                        <a href={event.url} target="_blank" rel="noopener noreferrer">
                          {event.name}
                        </a>
                      </h3>

                      {/* Info lines */}
                      <div className="mt-2 space-y-1">
                        {event.datetime_start && (
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                            <Clock size={11} className="text-blue-500 flex-shrink-0" />
                            <span className="truncate">
                              {new Date(event.datetime_start).toLocaleString("en-NZ", {
                                weekday: "short",
                                hour: "numeric",
                                minute: "2-digit"
                              })}
                            </span>
                          </div>
                        )}
                        {event.location_summary && (
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                            <MapPin size={11} className="text-red-500 flex-shrink-0" />
                            <span className="truncate">{event.location_summary}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer / Add Action */}
                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/5 flex gap-1">
                      {swappingSlot ? (
                        <button
                          onClick={() => handleSelectEvent(event)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-bold transition-all cursor-pointer shadow-sm shadow-blue-500/10"
                        >
                          <ArrowRightLeft size={10} />
                          Use This Event
                        </button>
                      ) : (
                        <button
                          onClick={() => handleManualAdd(event)}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            inTimeline
                              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-gray-100 hover:bg-blue-500 hover:text-white dark:bg-white/5 dark:hover:bg-blue-600 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {inTimeline ? (
                            <>
                              <Check size={10} />
                              Added to Timeline
                            </>
                          ) : (
                            <>
                              <Plus size={10} />
                              Add to Timeline
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination row */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-gray-100 dark:border-white/5 bg-white/20 dark:bg-slate-900/20 flex justify-between items-center text-xs">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/10 text-[10px] font-bold text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            Prev
          </button>
          <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/10 text-[10px] font-bold text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-800 disabled:hover:bg-transparent cursor-pointer transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
