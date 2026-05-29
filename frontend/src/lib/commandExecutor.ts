/**
 * Command Executor - Maps agent commands to UI actions
 */

import type { AgentCommand, DayPlan, EventData } from "../types";

export function executeAgentCommand(
  command: AgentCommand,
  itinerary: DayPlan[] | null,
  otherEvents: EventData[],
  setItinerary: (itinerary: DayPlan[]) => void,
  setOtherEvents: (fn: (prev: EventData[]) => EventData[]) => void,
  setRecommendedEvents: (fn: (prev: EventData[]) => EventData[]) => void
): void {
  if (!itinerary) return;

  const newItinerary = JSON.parse(JSON.stringify(itinerary)) as DayPlan[];

  switch (command.type) {
    case "REMOVE":
      handleRemoveCommand(command, newItinerary);
      break;
    case "ADD":
      handleAddCommand(command, newItinerary, otherEvents, setOtherEvents, setRecommendedEvents);
      break;
    case "SWAP":
      handleSwapCommand(command, newItinerary, otherEvents, setOtherEvents, setRecommendedEvents);
      break;
  }

  setItinerary(newItinerary);
}

function handleRemoveCommand(command: AgentCommand, itinerary: DayPlan[]): void {
  const { dayIdx, slotIdx, actIdx } = command;
  if (dayIdx === undefined || slotIdx === undefined || actIdx === undefined) return;

  const day = itinerary[dayIdx];
  if (!day) return;

  const slot = day.timeSlots[slotIdx];
  if (!slot) return;

  const activity = slot.activities[actIdx];
  if (!activity) return;

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
}

function handleAddCommand(
  command: AgentCommand,
  itinerary: DayPlan[],
  otherEvents: EventData[],
  setOtherEvents: (fn: (prev: EventData[]) => EventData[]) => void,
  setRecommendedEvents: (fn: (prev: EventData[]) => EventData[]) => void
): void {
  const { dayIdx, slotIdx, actIdx, eventId } = command;
  if (dayIdx === undefined || slotIdx === undefined || actIdx === undefined || !eventId) return;

  const day = itinerary[dayIdx];
  if (!day) return;

  const slot = day.timeSlots[slotIdx];
  if (!slot) return;

  // Find the event
  const event = otherEvents.find((e) => String(e.id) === String(eventId));
  if (!event) return;

  // Add event to slot
  slot.activities[actIdx] = {
    title: event.name,
    time: slot.activities[actIdx]?.time || "",
    cost: event.is_free ? "Free" : slot.activities[actIdx]?.cost || "",
    description: event.description || "",
    location: event.location_summary || "",
    eventId: event.id,
  };

  // Move event from otherEvents to recommendedEvents
  setOtherEvents((prev) => prev.filter((e) => String(e.id) !== String(eventId)));
  setRecommendedEvents((prev) => [...prev, event]);
}

function handleSwapCommand(
  command: AgentCommand,
  itinerary: DayPlan[],
  otherEvents: EventData[],
  setOtherEvents: (fn: (prev: EventData[]) => EventData[]) => void,
  setRecommendedEvents: (fn: (prev: EventData[]) => EventData[]) => void
): void {
  // Swap is essentially remove + add
  handleRemoveCommand(command, itinerary);
  handleAddCommand(command, itinerary, otherEvents, setOtherEvents, setRecommendedEvents);
}

// Made with Bob
