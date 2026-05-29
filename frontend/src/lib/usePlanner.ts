import { useState, useEffect, useCallback, useMemo } from "react";
import { trackGenerateItinerary } from "./gtag";
import { computeTwoWeekendOptions } from "./dateUtils";
import type { Audience, Budget, SelectedDate, Region, DayPlan, EventData, WeatherForecast, WeatherData } from "../types";

export function usePlanner() {
  const [audience, setAudience] = useState<Audience>("Friends");
  const [budget, setBudget] = useState<Budget>("Medium");
  
  // Compute available dates dynamically based on current date
  const availableDates = useMemo(() => computeTwoWeekendOptions(), []);
  
  // Default selection: first available weekend date (usually Saturday)
  const defaultDate = availableDates.thisWeekend[0] || availableDates.nextWeekend[0];
  const [selectedDates, setSelectedDates] = useState<SelectedDate[]>(defaultDate ? [defaultDate] : []);
  
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
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch("/api/weather")
      .then((r) => r.json())
      .then((data: WeatherData | { error: any }) => {
        if (data && 'forecast' in data && data.forecast) setWeatherForecast(data.forecast);
        if (data && !('error' in data)) setWeatherData(data as WeatherData);
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

  const toggleDate = (date: SelectedDate) => {
    setSelectedDates((prev) => {
      const exists = prev.some((d) => d.date === date.date);
      if (exists) {
        if (prev.length === 1) return prev; // Keep at least one date selected
        return prev.filter((d) => d.date !== date.date);
      }
      return [...prev, date];
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
          selectedDates: selectedDates.map((d) => d.date),
          tripDays: selectedDates.map((d) => d.dayName).join(" & "), // legacy compat
          region,
          query: `Plan a weekend itinerary for ${selectedDates.map(d => `${d.dayName} (${d.label})`).join(", ")} in ${region.join(", ")} for ${audience} with ${budget} budget.`,
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

      slot.activities[actIdx] = {
        title: event.name,
        time: slot.activities[actIdx].time,
        cost: event.is_free ? "Free" : slot.activities[actIdx].cost,
        description: event.description || "",
        location: event.location_summary || "",
        eventId: event.id,
      };

      setOtherEvents((prev) => prev.filter((e) => e.id !== event.id));
      setRecommendedEvents((prev) => [...prev, event]);
      setItinerary(newPlan);
      setSwappingSlot(null);
    },
    [swappingSlot, itinerary]
  );

  return {
    audience, setAudience,
    budget, setBudget,
    selectedDates, toggleDate, availableDates,
    region, toggleRegion,
    showPreferences, setShowPreferences,
    isLoading,
    itinerary, setItinerary,
    rawItinerary,
    recommendedEvents, setRecommendedEvents,
    otherEvents, setOtherEvents,
    moreEventsOpen, setMoreEventsOpen,
    swappingSlot, setSwappingSlot,
    weatherForecast,
    weatherData,
    handlePlanWeekend,
    handleReset,
    handleRemoveActivity,
    handleSwapClick,
    handleSelectEvent
  };
}
