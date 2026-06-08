import { useState, useEffect, useCallback, useMemo } from "react";
import { trackGenerateItinerary } from "./gtag";
import { computeTwoWeekendOptions } from "./dateUtils";
import type { Audience, Budget, SelectedDate, Region, DayPlan, EventData, WeatherForecast, WeatherData } from "../types";

const normalizeItineraryDates = (days: DayPlan[]): DayPlan[] => {
  return days.map((day) => {
    if (!day.date) return day;
    const parts = day.date.split("-");
    if (parts.length === 3) {
      const formattedDate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
      if (day.date !== formattedDate) {
        return { ...day, date: formattedDate };
      }
    }
    return day;
  });
};

export function usePlanner() {
  const [audience, setAudience] = useState<Audience>("Friends");
  const [budget, setBudget] = useState<Budget>("Medium");
  
  // Compute available dates dynamically based on current date
  const availableDates = useMemo(() => computeTwoWeekendOptions(), []);
  
  // Default selection: first available weekend date (usually Saturday)
  const defaultDate = availableDates.thisWeekend[0] || availableDates.nextWeekend[0];
  const [selectedDates, setSelectedDates] = useState<SelectedDate[]>(defaultDate ? [defaultDate] : []);
  
  const [region, setRegion] = useState<Region[]>(["Central Auckland"]);

  const [isLoading, setIsLoading] = useState(false);

  const [itinerary, setItineraryState] = useState<DayPlan[] | null>(null);
  const setItinerary = useCallback((val: DayPlan[] | null | ((prev: DayPlan[] | null) => DayPlan[] | null)) => {
    setItineraryState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      return next ? normalizeItineraryDates(next) : null;
    });
  }, []);
  const [rawItinerary, setRawItinerary] = useState<string | null>(null);
  const [recommendedEvents, setRecommendedEvents] = useState<EventData[]>([]);
  const [otherEvents, setOtherEvents] = useState<EventData[]>([]);

  const [moreEventsOpen, setMoreEventsOpen] = useState(false);
  const [swappingSlot, setSwappingSlot] = useState<{
    dayIdx: number;
    slotIdx: number;
    actIdx: number;
  } | null>(null);

  // Selector state for manually adding events
  const [activeAddEventSelector, setActiveAddEventSelector] = useState<EventData | null>(null);

  // Conflict state for overriding slots
  const [pendingConflict, setPendingConflict] = useState<{
    event: EventData;
    dayIdx: number;
    slotIdx: number;
    actIdx: number;
    existingTitle: string;
    isSwap?: boolean;
  } | null>(null);

  // State for removing a day timeline
  const [pendingRemoveDay, setPendingRemoveDay] = useState<number | null>(null);

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
    setItinerary(null);
    setRawItinerary(null);
    setRecommendedEvents([]);
    setOtherEvents([]);
    setSwappingSlot(null);
    setMoreEventsOpen(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL
        ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")}/api/v2/plan`
        : "/api/v2/plan";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          budget,
          selectedDates: selectedDates.map((d) => d.date),
          tripDays: selectedDates.map((d) => d.dayName).join(" & "),
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
    setItinerary(null);
    setRawItinerary(null);
    setRecommendedEvents([]);
    setOtherEvents([]);
    setSwappingSlot(null);
    setMoreEventsOpen(false);
    setActiveAddEventSelector(null);
    setPendingConflict(null);
  };

  const handleRemoveActivity = (dayIdx: number, slotIdx: number, actIdx: number) => {
    if (!itinerary) return;
    const newPlan = [...itinerary];
    const slot = newPlan[dayIdx]?.timeSlots[slotIdx];
    if (!slot) return;
    
    const removedEventId = slot.activities[actIdx]?.eventId;
    
    if (slot.activities.length > 1) {
      // Remove specific activity if there are multiple
      slot.activities.splice(actIdx, 1);
    } else {
      // Replace with placeholder if it's the last one
      slot.activities[actIdx] = {
        title: "Available Slot",
        time: slot.activities[actIdx]?.time || slot.period,
        cost: "",
        description: "Click here to add an event.",
        location: "",
        eventId: null,
        isEmptyPlaceholder: true,
      };
    }

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

  // Timezone-safe: build YYYY-MM-DD from local date fields (avoids slice(0,10) UTC bug)
  const getLocalDateStr = (datetime: string): string => {
    const d = new Date(datetime);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Returns a human-readable time string for the activity's time field.
  // Uses the event's actual start time when available; falls back to the slot period
  // (e.g. "Morning") for events that only have a date with no meaningful hour (00:00).
  const getActivityTime = (event: EventData, slotPeriod: string): string => {
    if (!event.datetime_start) return slotPeriod;
    const d = new Date(event.datetime_start);
    if (d.getHours() === 0 && d.getMinutes() === 0) return slotPeriod;
    return d.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  // Helper to parse event starting time and match day + slot
  const parseEventSlot = (event: EventData, currentItinerary: DayPlan[]) => {
    if (!event.datetime_start) return null;
    // Use getLocalDateStr to avoid UTC vs local timezone mismatch from slice(0,10)
    const dateStr = getLocalDateStr(event.datetime_start);
    const dayIdx = currentItinerary.findIndex((d) => d.date === dateStr);
    if (dayIdx === -1) return null;

    // getHours() returns local time, so this is correct for slot bucketing
    const hour = new Date(event.datetime_start).getHours();
    // Events at exactly midnight (00:00) have no meaningful time — don't auto-place
    if (hour === 0 && new Date(event.datetime_start).getMinutes() === 0) return null;

    let slotIdx = -1;
    if (hour >= 5 && hour < 12) slotIdx = 0; // Morning
    else if (hour >= 12 && hour < 14) slotIdx = 1; // Lunch
    else if (hour >= 14 && hour < 18) slotIdx = 2; // Afternoon
    else slotIdx = 3; // Evening

    return { dayIdx, slotIdx };
  };

  // Ensure itinerary exists, create manual empty one if not
  const ensureItinerary = (): DayPlan[] => {
    if (itinerary) return itinerary;
    const empty = createEmptyTimeline(selectedDates);
    return empty;
  };

  const createEmptyTimeline = (dates: SelectedDate[]): DayPlan[] => {
    const emptyItinerary: DayPlan[] = dates.map((d) => ({
      dayName: d.dayName,
      date: d.date,
      estimatedTotal: "$0",
      timeSlots: [
        {
          period: "Morning",
          activities: [{
            title: "Available Slot",
            time: "Morning",
            cost: "",
            description: "Click here to add an event.",
            location: "",
            eventId: null,
            isEmptyPlaceholder: true,
          }]
        },
        {
          period: "Lunch",
          activities: [{
            title: "Available Slot",
            time: "Lunch",
            cost: "",
            description: "Click here to add an event.",
            location: "",
            eventId: null,
            isEmptyPlaceholder: true,
          }]
        },
        {
          period: "Afternoon",
          activities: [{
            title: "Available Slot",
            time: "Afternoon",
            cost: "",
            description: "Click here to add an event.",
            location: "",
            eventId: null,
            isEmptyPlaceholder: true,
          }]
        },
        {
          period: "Evening",
          activities: [{
            title: "Available Slot",
            time: "Evening",
            cost: "",
            description: "Click here to add an event.",
            location: "",
            eventId: null,
            isEmptyPlaceholder: true,
          }]
        }
      ]
    }));
    setItinerary(emptyItinerary);
    setRawItinerary("Custom Manual Itinerary");
    setRecommendedEvents([]);
    setOtherEvents([]);
    return emptyItinerary;
  };

  const executeReplace = (
    event: EventData,
    dayIdx: number,
    slotIdx: number,
    actIdx: number,
    currentItinerary: DayPlan[]
  ) => {
    const newItinerary = [...currentItinerary];
    const slot = newItinerary[dayIdx].timeSlots[slotIdx];
    const oldEventId = slot.activities[actIdx]?.eventId;

    slot.activities[actIdx] = {
      title: event.name,
      // Use the event's actual start time rather than the old activity's time or slot period
      time: getActivityTime(event, slot.period),
      cost: event.is_free ? "Free" : "Paid",
      description: event.description || "",
      location: event.location_summary || "",
      eventId: event.id,
    };

    setOtherEvents((prev) => prev.filter((e) => e.id !== event.id));
    setRecommendedEvents((prev) => {
      const filtered = prev.filter((e) => e.id !== event.id);
      return [...filtered, event];
    });

    if (oldEventId) {
      const returnedEvent = recommendedEvents.find((e) => e.id === oldEventId);
      if (returnedEvent) {
        setRecommendedEvents((prev) => prev.filter((e) => e.id !== oldEventId));
        setOtherEvents((prev) => [...prev, returnedEvent]);
      }
    }

    setItinerary(newItinerary);
    setActiveAddEventSelector(null);
  };

  const executeKeepBoth = (
    event: EventData,
    dayIdx: number,
    slotIdx: number,
    currentItinerary: DayPlan[]
  ) => {
    const newItinerary = [...currentItinerary];
    const slot = newItinerary[dayIdx].timeSlots[slotIdx];

    const hasPlaceholder = slot.activities.length === 1 && slot.activities[0].isEmptyPlaceholder;
    if (hasPlaceholder) {
      slot.activities = [];
    }

    slot.activities.push({
      title: event.name,
      // Use the event's actual start time rather than the generic slot period
      time: getActivityTime(event, slot.period),
      cost: event.is_free ? "Free" : "Paid",
      description: event.description || "",
      location: event.location_summary || "",
      eventId: event.id,
    });

    setOtherEvents((prev) => prev.filter((e) => e.id !== event.id));
    setRecommendedEvents((prev) => {
      const filtered = prev.filter((e) => e.id !== event.id);
      return [...filtered, event];
    });

    setItinerary(newItinerary);
    setActiveAddEventSelector(null);
  };

  const handleManualAdd = (event: EventData, dayIdx?: number, slotIdx?: number, actIdx?: number) => {
    const currentItinerary = ensureItinerary();
    
    let targetDayIdx = dayIdx;
    let targetSlotIdx = slotIdx;
    let targetActIdx = actIdx ?? 0;

    if (targetDayIdx === undefined || targetSlotIdx === undefined) {
      const autoSlot = parseEventSlot(event, currentItinerary);
      if (autoSlot) {
        targetDayIdx = autoSlot.dayIdx;
        targetSlotIdx = autoSlot.slotIdx;
      } else {
        // Popover select dropdown
        setActiveAddEventSelector(event);
        return;
      }
    }

    const slot = currentItinerary[targetDayIdx]?.timeSlots[targetSlotIdx];
    if (!slot) return;

    const existingActivities = slot.activities;
    const isTargetEmpty = existingActivities.length === 1 && existingActivities[0].isEmptyPlaceholder;

    if (!isTargetEmpty) {
      setPendingConflict({
        event,
        dayIdx: targetDayIdx,
        slotIdx: targetSlotIdx,
        actIdx: targetActIdx,
        existingTitle: existingActivities[targetActIdx]?.title || existingActivities[0]?.title || "Existing Activity",
        isSwap: false
      });
    } else {
      executeReplace(event, targetDayIdx, targetSlotIdx, targetActIdx, currentItinerary);
    }
  };

  // Creates a brand-new day in the itinerary for the event's date, then auto-places
  // the event in the matching time slot. Called when the user clicks "Add [date] to plan"
  // in the AddToTimelineDropdown for an event whose date isn't in the current itinerary.
  const handleAddNewDay = (event: EventData) => {
    if (!event.datetime_start) return;

    const dateStr = getLocalDateStr(event.datetime_start);
    const d = new Date(event.datetime_start);
    const dayName = d.toLocaleDateString("en-NZ", { weekday: "long" });

    const baseItinerary = ensureItinerary();

    // Build empty slot helper
    const makeEmptyActivity = (period: string) => ({
      title: "Available Slot",
      time: period,
      cost: "",
      description: "Click here to add an event.",
      location: "",
      eventId: null as string | null,
      isEmptyPlaceholder: true,
    });

    const newDay: DayPlan = {
      dayName,
      date: dateStr,
      estimatedTotal: "$0",
      timeSlots: [
        { period: "Morning",   activities: [makeEmptyActivity("Morning")] },
        { period: "Lunch",     activities: [makeEmptyActivity("Lunch")] },
        { period: "Afternoon", activities: [makeEmptyActivity("Afternoon")] },
        { period: "Evening",   activities: [makeEmptyActivity("Evening")] },
      ],
    };

    // Merge (replace if somehow the day already exists) and sort chronologically
    const withNewDay = [...baseItinerary.filter((day) => day.date !== dateStr), newDay]
      .sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return da - db;
      });

    // Determine which slot to place the event in (default Morning for 00:00 events)
    const hour = d.getHours();
    const hasSpecificTime = !(hour === 0 && d.getMinutes() === 0);
    let slotIdx = 0; // Morning default
    if (hasSpecificTime) {
      if (hour >= 5 && hour < 12) slotIdx = 0;
      else if (hour >= 12 && hour < 14) slotIdx = 1;
      else if (hour >= 14 && hour < 18) slotIdx = 2;
      else slotIdx = 3;
    }

    const targetDayIdx = withNewDay.findIndex((day) => day.date === dateStr);

    // Close the selector then place the event into the freshly created day
    setActiveAddEventSelector(null);
    executeReplace(event, targetDayIdx, slotIdx, 0, withNewDay);
  };

  const confirmReplace = () => {
    if (!pendingConflict || !itinerary) return;
    const { event, dayIdx, slotIdx, actIdx } = pendingConflict;
    executeReplace(event, dayIdx, slotIdx, actIdx, itinerary);
    setPendingConflict(null);
    if (pendingConflict.isSwap) {
      setSwappingSlot(null);
    }
  };

  const confirmKeepBoth = () => {
    if (!pendingConflict || !itinerary) return;
    const { event, dayIdx, slotIdx } = pendingConflict;
    executeKeepBoth(event, dayIdx, slotIdx, itinerary);
    setPendingConflict(null);
    if (pendingConflict.isSwap) {
      setSwappingSlot(null);
    }
  };

  const cancelConflict = () => {
    setPendingConflict(null);
    if (pendingConflict?.isSwap) {
      setSwappingSlot(null);
    }
  };

  const handleRemoveDayClick = (dayIdx: number) => {
    setPendingRemoveDay(dayIdx);
  };

  const confirmRemoveDay = () => {
    if (pendingRemoveDay === null || !itinerary) return;
    const newItinerary = itinerary.filter((_, i) => i !== pendingRemoveDay);
    setItinerary(newItinerary.length > 0 ? newItinerary : null);
    if (newItinerary.length === 0) {
      setRawItinerary(null);
      setRecommendedEvents([]);
      setOtherEvents([]);
    }
    setPendingRemoveDay(null);
  };

  const cancelRemoveDay = () => {
    setPendingRemoveDay(null);
  };

  const handleSelectEvent = useCallback(
    (event: EventData) => {
      if (!swappingSlot || !itinerary) return;

      const { dayIdx, slotIdx, actIdx } = swappingSlot;
      const slot = itinerary[dayIdx]?.timeSlots[slotIdx];
      if (!slot) return;

      const existingActivity = slot.activities[actIdx];
      const isTargetEmpty = existingActivity?.isEmptyPlaceholder;

      if (!isTargetEmpty) {
        setPendingConflict({
          event,
          dayIdx,
          slotIdx,
          actIdx,
          existingTitle: existingActivity?.title || "Existing Activity",
          isSwap: true
        });
      } else {
        executeReplace(event, dayIdx, slotIdx, actIdx, itinerary);
        setSwappingSlot(null);
      }
    },
    [swappingSlot, itinerary]
  );

  return {
    audience, setAudience,
    budget, setBudget,
    selectedDates, toggleDate, availableDates,
    region, toggleRegion,
    isLoading,
    itinerary, setItinerary,
    rawItinerary,
    recommendedEvents, setRecommendedEvents,
    otherEvents, setOtherEvents,
    moreEventsOpen, setMoreEventsOpen,
    swappingSlot, setSwappingSlot,
    activeAddEventSelector, setActiveAddEventSelector,
    pendingConflict, setPendingConflict,
    pendingRemoveDay, setPendingRemoveDay,
    weatherForecast,
    weatherData,
    handlePlanWeekend,
    handleReset,
    handleRemoveActivity,
    handleSwapClick,
    handleSelectEvent,
    handleManualAdd,
    handleAddNewDay,
    confirmReplace,
    confirmKeepBoth,
    cancelConflict,
    handleRemoveDayClick,
    confirmRemoveDay,
    cancelRemoveDay,
    createEmptyTimeline
  };
}
