"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Users,
  Wallet,
  CalendarDays,
  Map,
  RotateCcw,
  Loader2,
} from "lucide-react";
import WeatherWidget, { getWeatherHint, weatherEmoji } from "./components/WeatherWidget";
import DayTimeline from "./components/DayTimeline";
import MoreEvents from "./components/MoreEvents";
import ExportActions from "./components/ExportActions";

type Audience = "Couples" | "Friends" | "Family" | "Solo";
type Budget = "Free" | "Low" | "Medium" | "High";
type TripDays = "Saturday" | "Sunday" | "Both Days";
type Region =
  | "Central Auckland"
  | "East Auckland"
  | "West Auckland"
  | "South Auckland"
  | "North Shore"
  | "Waiheke Island";

const audienceOptions: Audience[] = ["Couples", "Friends", "Family", "Solo"];
const budgetOptions: Budget[] = ["Free", "Low", "Medium", "High"];
const tripDayOptions: TripDays[] = ["Saturday", "Sunday", "Both Days"];
const regionOptions: Region[] = [
  "Central Auckland",
  "East Auckland",
  "West Auckland",
  "South Auckland",
  "North Shore",
  "Waiheke Island",
];

const choicePill = "rounded-full border border-white/60 bg-white/50 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:bg-white/75 cursor-pointer";
const choicePillActive = "rounded-full border border-blue-400 bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all cursor-pointer";

interface Activity {
  title: string;
  time: string;
  cost: string;
  description: string;
  location: string;
  eventId: string | null;
  isEmptyPlaceholder?: boolean;
}

interface TimeSlot {
  period: string;
  activities: Activity[];
}

interface DayPlan {
  dayName: string;
  date: string;
  timeSlots: TimeSlot[];
  estimatedTotal: string;
}

interface EventData {
  id: string;
  name: string;
  description: string;
  image_url: string;
  datetime_start: string;
  datetime_end: string;
  location_summary: string;
  is_free: boolean;
  url: string;
}

interface WeatherForecast {
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

export default function Home() {
  const [audience, setAudience] = useState<Audience>("Friends");
  const [budget, setBudget] = useState<Budget>("Medium");
  const [tripDays, setTripDays] = useState<TripDays>("Saturday");
  const [region, setRegion] = useState<Region[]>(["Central Auckland"]);

  const [showPreferences, setShowPreferences] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [itinerary, setItinerary] = useState<DayPlan[] | null>(null);
  const [rawItinerary, setRawItinerary] = useState<string | null>(null);
  const [recommendedEvents, setRecommendedEvents] = useState<EventData[]>([]);
  const [otherEvents, setOtherEvents] = useState<EventData[]>([]);

  const [moreEventsOpen, setMoreEventsOpen] = useState(false);
  const [swappingSlot, setSwappingSlot] = useState<{
    dayIdx: number;
    slotIdx: number;
    actIdx: number;
  } | null>(null);

  // Weather data for preference hints
  const [weatherForecast, setWeatherForecast] = useState<WeatherForecast[]>([]);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((data) => {
        if (data.forecast) setWeatherForecast(data.forecast);
      })
      .catch(() => {});
  }, []);

  const toggleRegion = (r: Region) => {
    setRegion((prev) => {
      if (prev.includes(r)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((item) => item !== r);
      }
      return [...prev, r];
    });
  };

  const handlePlanWeekend = async () => {
    setIsLoading(true);
    setShowPreferences(false);
    setItinerary(null);
    setRawItinerary(null);
    setRecommendedEvents([]);
    setOtherEvents([]);
    setSwappingSlot(null);
    setMoreEventsOpen(false);

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:3000/api/v2/plan";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          budget,
          tripDays,
          region,
          query: `Plan a ${tripDays} weekend in ${region.join(", ")} for ${audience} with ${budget} budget.`,
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = await response.json();

      if (data.success) {
        if (data.itinerary?.days) {
          setItinerary(data.itinerary.days);
        } else if (data.rawItinerary) {
          setRawItinerary(data.rawItinerary);
        }
        if (data.recommendedEvents) setRecommendedEvents(data.recommendedEvents);
        if (data.otherEvents) setOtherEvents(data.otherEvents);
      } else {
        throw new Error(data.error || "Failed to generate itinerary");
      }
    } catch (error) {
      console.error("API Error:", error);
      // Show a friendly error state
      setRawItinerary(
        `We encountered an issue connecting to the planning service. Please try again in a moment.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setShowPreferences(true);
    setItinerary(null);
    setRawItinerary(null);
    setRecommendedEvents([]);
    setOtherEvents([]);
    setSwappingSlot(null);
    setMoreEventsOpen(false);
  };

  const handleRemoveActivity = (dayIdx: number, slotIdx: number, actIdx: number) => {
    if (!itinerary) return;
    const newPlan = [...itinerary];
    const slot = newPlan[dayIdx]?.timeSlots[slotIdx];
    if (!slot) return;
    
    const removedEventId = slot.activities[actIdx].eventId;
    
    // Convert to a placeholder
    slot.activities[actIdx] = {
      title: "Available Slot",
      time: slot.activities[actIdx].time,
      cost: "",
      description: "Click here to add an event from the Explore More section.",
      location: "",
      eventId: null,
      isEmptyPlaceholder: true,
    };

    if (removedEventId) {
      // Move from recommended to other
      const eventToMove = recommendedEvents.find((e) => String(e.id) === String(removedEventId));
      if (eventToMove) {
        setRecommendedEvents((prev) => prev.filter((e) => String(e.id) !== String(removedEventId)));
        setOtherEvents((prev) => [...prev, eventToMove]);
      }
    }
    
    setItinerary(newPlan);
  };

  const handleSwapClick = (dayIdx: number, slotIdx: number, actIdx: number) => {
    if (
      swappingSlot?.dayIdx === dayIdx &&
      swappingSlot?.slotIdx === slotIdx &&
      swappingSlot?.actIdx === actIdx
    ) {
      // Toggle off
      setSwappingSlot(null);
      return;
    }
    setSwappingSlot({ dayIdx, slotIdx, actIdx });
    setMoreEventsOpen(true);
  };

  const handleSelectEvent = useCallback(
    (event: EventData) => {
      if (!swappingSlot || !itinerary) return;

      const { dayIdx, slotIdx, actIdx } = swappingSlot;
      const newPlan = [...itinerary];
      const slot = newPlan[dayIdx]?.timeSlots[slotIdx];
      if (!slot) return;

      // Replace the activity
      slot.activities[actIdx] = {
        title: event.name,
        time: slot.activities[actIdx].time,
        cost: event.is_free ? "Free" : slot.activities[actIdx].cost,
        description: event.description || "",
        location: event.location_summary || "",
        eventId: event.id,
      };

      // Move event from "other" to "recommended"
      setOtherEvents((prev) => prev.filter((e) => e.id !== event.id));
      setRecommendedEvents((prev) => [...prev, event]);
      setItinerary(newPlan);
      setSwappingSlot(null);
    },
    [swappingSlot, itinerary]
  );

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

  const spring = { type: "spring" as const, stiffness: 300, damping: 20 };

  return (
    <main className="min-h-screen mesh-bg p-4 md:p-8 font-sans flex flex-col">
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-5 flex-1">
        {/* ===== HEADER ===== */}
        <motion.header
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={spring}
          className="flex justify-between items-center glass-panel p-5 shrink-0"
        >
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Auckland Weekend Planner
            </h1>
            <span className="hidden md:inline-block text-[10px] font-bold bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-2 py-0.5 rounded-md">
              BETA V2
            </span>
          </div>
          <WeatherWidget />
        </motion.header>

        {/* ===== CONTENT ===== */}
        <AnimatePresence mode="wait">
          {showPreferences ? (
            /* ===== PREFERENCE PANEL ===== */
            <motion.section
              key="preferences"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97, y: -15 }}
              transition={spring}
              className="glass-panel p-6 flex flex-col relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-600" />

              <div className="mb-5 mt-1">
                <h2 className="text-xl font-bold flex items-center gap-2 text-zinc-800">
                  <Sparkles className="w-5 h-5 text-blue-500" />
                  Design Your Perfect Weekend
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Set your preferences and let AI craft a personalized itinerary
                  with real events.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Who */}
                <div className="preference-card">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 mb-2.5">
                    <Users className="w-4 h-4 text-blue-500" /> Who&apos;s going?
                  </div>
                  <div className="flex flex-wrap gap-1.5">
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
                <div className="preference-card">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 mb-2.5">
                    <Wallet className="w-4 h-4 text-blue-500" /> Budget Level
                  </div>
                  <div className="flex flex-wrap gap-1.5">
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
                <div className="preference-card">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 mb-2.5">
                    <CalendarDays className="w-4 h-4 text-blue-500" /> When?
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tripDayOptions.map((o) => {
                      const hint = getWeatherHint(weatherForecast, o);
                      return (
                        <button
                          key={o}
                          onClick={() => setTripDays(o)}
                          className={tripDays === o ? choicePillActive : choicePill}
                        >
                          {o}
                          {hint && (
                            <span className="weather-hint">
                              <span className="text-sm">{weatherEmoji(hint.icon)}</span>
                              {hint.temp}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Where */}
                <div className="preference-card">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-600 mb-2.5">
                    <Map className="w-4 h-4 text-blue-500" /> Where?
                  </div>
                  <div className="flex flex-wrap gap-1.5">
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

              <button
                onClick={handlePlanWeekend}
                className="w-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3.5 text-white font-bold text-base shadow-lg shadow-blue-200/40 hover:brightness-105 transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <span className="flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5" /> Generate Itinerary
                </span>
              </button>
            </motion.section>
          ) : (
            /* ===== RESULTS ===== */
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
                      <span className="text-sm font-semibold text-blue-600">
                        Crafting your perfect weekend...
                      </span>
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
                        onSwapClick={handleSwapClick}
                        onRemoveClick={handleRemoveActivity}
                      />
                    );
                  })}

                  {/* More Events */}
                  <MoreEvents
                    events={displayEvents}
                    isOpen={moreEventsOpen}
                    onToggle={() => setMoreEventsOpen(!moreEventsOpen)}
                    swappingActive={swappingSlot !== null}
                    onSelectEvent={handleSelectEvent}
                  />

                  {/* Actions */}
                  <div className="flex items-center justify-between flex-wrap gap-3 mt-2">
                    <button
                      onClick={handleReset}
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
                  <div className="mt-4">
                    <button
                      onClick={handleReset}
                      className="export-button"
                    >
                      <RotateCcw className="w-4 h-4 text-blue-500" />
                      <span>Start Over</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
