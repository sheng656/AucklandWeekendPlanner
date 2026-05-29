/**
 * Command Executor - Maps agent commands to UI actions with bulletproof fallback resolving
 */

import type { AgentCommand, DayPlan, EventData } from "../types";

export function executeAgentCommand(
  command: AgentCommand,
  itinerary: DayPlan[] | null,
  otherEvents: EventData[],
  recommendedEvents: EventData[],
  setItinerary: (itinerary: DayPlan[]) => void,
  setOtherEvents: (fn: (prev: EventData[]) => EventData[]) => void,
  setRecommendedEvents: (fn: (prev: EventData[]) => EventData[]) => void
): void {
  if (!itinerary) return;

  const newItinerary = JSON.parse(JSON.stringify(itinerary)) as DayPlan[];

  switch (command.type) {
    case "REMOVE":
      handleRemoveCommand(command, newItinerary, setOtherEvents, setRecommendedEvents);
      break;
    case "ADD":
      handleAddCommand(command, newItinerary, otherEvents, recommendedEvents, setOtherEvents, setRecommendedEvents);
      break;
    case "SWAP":
      handleSwapCommand(command, newItinerary, otherEvents, recommendedEvents, setOtherEvents, setRecommendedEvents);
      break;
  }

  setItinerary(newItinerary);
}

function handleRemoveCommand(
  command: AgentCommand, 
  itinerary: DayPlan[],
  setOtherEvents?: (fn: (prev: EventData[]) => EventData[]) => void,
  setRecommendedEvents?: (fn: (prev: EventData[]) => EventData[]) => void
): void {
  const { dayIdx, slotIdx, actIdx } = command;
  if (dayIdx === undefined || slotIdx === undefined || actIdx === undefined) return;

  const day = itinerary[dayIdx];
  if (!day) return;

  const slot = day.timeSlots[slotIdx];
  if (!slot) return;

  const activity = slot.activities[actIdx];
  if (!activity) return;

  const removedEventId = activity.eventId;

  // Replace with empty placeholder
  slot.activities[actIdx] = {
    title: "Available Slot",
    time: activity.time,
    cost: "",
    description: "Click here to add an event from the Explore More section.",
    location: "",
    eventId: null,
    isEmptyPlaceholder: true,
  };

  // Move event back from recommendedEvents to otherEvents if helper triggers are defined
  if (removedEventId && setOtherEvents && setRecommendedEvents) {
    setRecommendedEvents((prev) => {
      const eventToMove = prev.find((e) => String(e.id) === String(removedEventId));
      if (eventToMove) {
        setOtherEvents((prevOther) => {
          // Prevent duplicates in explore pool
          if (prevOther.some((e) => String(e.id) === String(removedEventId))) {
            return prevOther;
          }
          return [...prevOther, eventToMove];
        });
      }
      return prev.filter((e) => String(e.id) !== String(removedEventId));
    });
  }
}

function handleAddCommand(
  command: AgentCommand,
  itinerary: DayPlan[],
  otherEvents: EventData[],
  recommendedEvents: EventData[],
  setOtherEvents: (fn: (prev: EventData[]) => EventData[]) => void,
  setRecommendedEvents: (fn: (prev: EventData[]) => EventData[]) => void
): void {
  const { dayIdx, slotIdx, actIdx, eventId } = command;
  if (dayIdx === undefined || slotIdx === undefined || actIdx === undefined || !eventId) return;

  const day = itinerary[dayIdx];
  if (!day) return;

  const slot = day.timeSlots[slotIdx];
  if (!slot) return;

  // 1. Search in otherEvents pool
  let event: any = otherEvents.find((e) => String(e.id) === String(eventId));
  let inOther = true;

  if (!event) {
    // 2. Search in recommendedEvents pool
    event = recommendedEvents.find((e) => String(e.id) === String(eventId));
    inOther = false;
  }

  // 3. Search in the original itinerary activities in case it was there but skipped pools
  if (!event) {
    for (const d of itinerary) {
      for (const s of d.timeSlots) {
        for (const a of s.activities) {
          if (a.eventId && String(a.eventId) === String(eventId)) {
            event = {
              id: a.eventId,
              name: a.title,
              description: a.description || "",
              location_summary: a.location || "",
              is_free: a.cost?.toLowerCase().includes("free") || false,
            };
            inOther = false;
            break;
          }
        }
        if (event) break;
      }
      if (event) break;
    }
  }

  // Fallback: If still not found (custom LLM activity ID or missing data), construct a solid default card
  if (!event) {
    console.warn(`[CommandExecutor] Event with ID ${eventId} not found. Creating fallback card.`);
    slot.activities[actIdx] = {
      title: "Planned Activity",
      time: slot.activities[actIdx]?.time || "",
      cost: "",
      description: "Added by your conversational planning assistant.",
      location: "Auckland",
      eventId: eventId,
    };
    return;
  }

  // Add event details to slot
  slot.activities[actIdx] = {
    title: event.name,
    time: slot.activities[actIdx]?.time || "",
    cost: event.is_free ? "Free" : slot.activities[actIdx]?.cost || "",
    description: event.description || "",
    location: event.location_summary || "",
    eventId: event.id,
  };

  // If the event was from otherEvents, move it to recommendedEvents
  if (inOther && event) {
    setOtherEvents((prev) => prev.filter((e) => String(e.id) !== String(eventId)));
    setRecommendedEvents((prev) => {
      if (prev.some((e) => String(e.id) === String(eventId))) {
        return prev;
      }
      return [...prev, event];
    });
  }
}

function handleSwapCommand(
  command: AgentCommand,
  itinerary: DayPlan[],
  otherEvents: EventData[],
  recommendedEvents: EventData[],
  setOtherEvents: (fn: (prev: EventData[]) => EventData[]) => void,
  setRecommendedEvents: (fn: (prev: EventData[]) => EventData[]) => void
): void {
  // Swap is remove + add sequenced together
  handleRemoveCommand(command, itinerary, setOtherEvents, setRecommendedEvents);
  handleAddCommand(command, itinerary, otherEvents, recommendedEvents, setOtherEvents, setRecommendedEvents);
}
