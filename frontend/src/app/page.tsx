"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink } from "lucide-react";
import WeatherWidget from "./components/WeatherWidget";
import PreferencePanel from "./components/PreferencePanel";
import ResultsSection from "./components/ResultsSection";
import ScrollToTop from "./components/ScrollToTop";
import { trackGenerateItinerary } from "../lib/gtag";
import { SOURCE_SITES } from "../lib/sourceUtils";

import type { Audience, Budget, TripDays, Region, Activity, TimeSlot, DayPlan, EventData, WeatherForecast } from "../types";

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

  const moreEventsRef = useRef<HTMLDivElement>(null);

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

  // Load saved itinerary on mount
  useEffect(() => {
    const saved = localStorage.getItem("saved_itinerary");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.itinerary) {
          setItinerary(parsed.itinerary);
          setRecommendedEvents(parsed.recommendedEvents || []);
          setOtherEvents(parsed.otherEvents || []);
          if (parsed.rawItinerary) setRawItinerary(parsed.rawItinerary);
          setShowPreferences(false);
        }
      } catch (e) {
        console.error("Failed to parse saved itinerary", e);
      }
    }
  }, []);

  // Save itinerary when it changes
  useEffect(() => {
    if (itinerary || rawItinerary) {
      localStorage.setItem("saved_itinerary", JSON.stringify({
        itinerary,
        rawItinerary,
        recommendedEvents,
        otherEvents
      }));
    } else {
      localStorage.removeItem("saved_itinerary");
    }
  }, [itinerary, rawItinerary, recommendedEvents, otherEvents]);

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
    trackGenerateItinerary(region.join(", "));
    setIsLoading(true);
    setShowPreferences(false);
    setItinerary(null);
    setRawItinerary(null);
    setRecommendedEvents([]);
    setOtherEvents([]);
    setSwappingSlot(null);
    setMoreEventsOpen(false);

    try {
      let apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (apiUrl) {
        apiUrl = apiUrl.replace(/\/+$/, '');
      } else {
        apiUrl = "/api/v2/plan";
      }
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
    if (itinerary || rawItinerary) {
      if (!window.confirm("Are you sure you want to start over? Your current itinerary will be lost.")) {
        return;
      }
    }
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

    // Smooth scroll to event selection
    setTimeout(() => {
      moreEventsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
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



  const spring = { type: "spring" as const, stiffness: 300, damping: 20 };

  return (
    <main className="min-h-screen mesh-bg p-3 md:p-8 font-sans flex flex-col">
      <div className="max-w-3xl mx-auto w-full flex flex-col gap-3 md:gap-5 flex-1">
        {/* ===== HEADER ===== */}
        <motion.header
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={spring}
          className="flex justify-between items-center glass-panel p-3 md:p-5 shrink-0"
        >
          <div className="flex items-center gap-1.5">
            <h1 className="text-base sm:text-xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent leading-tight tracking-tighter sm:tracking-normal">
              Auckland Weekend Planner
            </h1>
            <span className="hidden sm:inline-block text-[10px] font-bold bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-2 py-0.5 rounded-md">
              BETA V2
            </span>
          </div>
          <WeatherWidget />
        </motion.header>

        {/* ===== CONTENT ===== */}
        <AnimatePresence mode="wait">
          {showPreferences ? (
            <PreferencePanel
              audience={audience} setAudience={setAudience}
              budget={budget} setBudget={setBudget}
              tripDays={tripDays} setTripDays={setTripDays}
              region={region} toggleRegion={toggleRegion}
              weatherForecast={weatherForecast}
              onGenerate={handlePlanWeekend}
            />
          ) : (
            <ResultsSection
              isLoading={isLoading}
              itinerary={itinerary}
              rawItinerary={rawItinerary}
              recommendedEvents={recommendedEvents}
              otherEvents={otherEvents}
              region={region}
              swappingSlot={swappingSlot}
              moreEventsOpen={moreEventsOpen}
              moreEventsRef={moreEventsRef}
              weatherForecast={weatherForecast}
              onSwapClick={handleSwapClick}
              onRemoveClick={handleRemoveActivity}
              onToggleMoreEvents={() => setMoreEventsOpen(!moreEventsOpen)}
              onSelectEvent={handleSelectEvent}
              onReset={handleReset}
              onRetry={handlePlanWeekend}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ===== ATTRIBUTION FOOTER ===== */}
      <footer className="source-attribution-footer py-4 md:py-8">
        <div className="max-w-3xl mx-auto w-full">
          <p className="source-attribution-label">Events sourced from</p>
          <div className="source-attribution-links">
            {SOURCE_SITES.map((site) => (
              <a
                key={site.name}
                href={site.url}
                target="_blank"
                rel="noopener noreferrer"
                className="source-attribution-pill"
              >
                <span className="source-pill-name">{site.name}</span>
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            ))}
          </div>
          <p className="source-attribution-disclaimer">
            Event data is aggregated from the above platforms for informational purposes.
          </p>
        </div>
      </footer>
      <ScrollToTop />
    </main>
  );
}
