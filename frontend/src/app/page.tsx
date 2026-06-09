"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Compass, Calendar, CheckSquare, MessageCircle, ExternalLink } from "lucide-react";
import WeatherWidget from "./components/WeatherWidget";
import TimelinePanel from "./components/TimelinePanel";
import EventsPanel from "./components/EventsPanel";
import ChatAssistant from "./components/ChatAssistant";
import AddToTimelineDropdown from "./components/AddToTimelineDropdown";
import ConflictConfirmModal from "./components/ConflictConfirmModal";
import ConfirmModal from "./components/ConfirmModal";
import ScrollToTop from "./components/ScrollToTop";
import { SOURCE_SITES } from "../lib/sourceUtils";
import { usePlanner } from "../lib/usePlanner";
import { useEvents } from "../lib/useEvents";
import { executeAgentCommand } from "../lib/commandExecutor";
import type { AgentCommand } from "../types";

export default function Home() {
  const planner = usePlanner();
  const {
    audience,
    budget,
    selectedDates,
    region,
    itinerary,
    recommendedEvents,
    otherEvents,
    activeAddEventSelector,
    setActiveAddEventSelector,
    pendingConflict,
    pendingRemoveDay,
  } = planner;

  const events = useEvents();
  const [activeTab, setActiveTab] = useState<"events" | "planner" | "chat">("events");

  // Switch to events tab on mobile if user clicks placeholder to swap/add
  useEffect(() => {
    if (planner.swappingSlot && activeTab !== "events") {
      setActiveTab("events");
    }
  }, [planner.swappingSlot]);

  // Handle agent commands
  const handleExecuteCommand = (command: AgentCommand) => {
    executeAgentCommand(
      command,
      itinerary,
      otherEvents,
      recommendedEvents,
      planner.setItinerary,
      planner.setOtherEvents,
      planner.setRecommendedEvents
    );
  };

  return (
    <main className="min-h-screen mesh-bg font-sans flex flex-col pb-24 lg:pb-0">
      {/* ===== HEADER ===== */}
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex justify-between items-center glass-panel m-3 md:mx-6 p-3 md:p-4 shrink-0 sticky top-3 z-30"
      >
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-md shrink-0">
            <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <h1 className="text-base sm:text-xl md:text-2xl font-extrabold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent leading-tight tracking-tighter">
            Auckland Weekend Planner
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <WeatherWidget weather={planner.weatherData} />
        </div>
      </motion.header>

      {/* ===== DESKTOP LAYOUT (3 columns) ===== */}
      <div className="hidden lg:grid grid-cols-[400px_1fr_350px] gap-6 px-6 pb-6 flex-1 min-h-0">
        {/* Left Column: Itinerary / Config */}
        <div className="h-[calc(100vh-100px)] sticky top-[92px]">
          <TimelinePanel plannerState={planner} />
        </div>

        {/* Center Column: unified event cards grid */}
        <div className="h-[calc(100vh-100px)]">
          <EventsPanel eventsState={events} plannerState={planner} />
        </div>

        {/* Right Column: AI assistant chat */}
        <div className="h-[calc(100vh-100px)] sticky top-[92px]">
          <ChatAssistant
            itinerary={itinerary}
            selectedDates={selectedDates.map((d) => d.date)}
            region={region}
            audience={audience}
            budget={budget}
            onExecuteCommand={handleExecuteCommand}
            embedded
          />
        </div>
      </div>

      {/* ===== MOBILE LAYOUT (Tab panels) ===== */}
      <div className="lg:hidden flex-1 flex flex-col min-h-0 px-3 pb-3">
        <div className="flex-1 min-h-0">
          {/* Panel 1: Events */}
          <div className={activeTab === "events" ? "block h-[calc(100vh-160px)]" : "hidden"}>
            <EventsPanel eventsState={events} plannerState={planner} />
          </div>

          {/* Panel 2: Planner */}
          <div className={activeTab === "planner" ? "block h-[calc(100vh-160px)]" : "hidden"}>
            <TimelinePanel plannerState={planner} />
          </div>

          {/* Panel 3: Chat */}
          <div className={activeTab === "chat" ? "block h-[calc(100vh-160px)]" : "hidden"}>
            <ChatAssistant
              itinerary={itinerary}
              selectedDates={selectedDates.map((d) => d.date)}
              region={region}
              audience={audience}
              budget={budget}
              onExecuteCommand={handleExecuteCommand}
              embedded
            />
          </div>
        </div>

        {/* Floating Mobile Tab Bar */}
        <nav className="fixed bottom-4 left-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-gray-100 dark:border-white/10 p-1.5 flex justify-between items-center z-40 shadow-2xl rounded-2xl">
          <button
            onClick={() => setActiveTab("events")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl text-[10px] font-bold cursor-pointer transition-all duration-300 ${
              activeTab === "events"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            <Calendar size={18} className={`transition-all duration-300 ${activeTab === "events" ? "scale-110" : ""}`} />
            <span>Events</span>
          </button>

          <button
            onClick={() => setActiveTab("planner")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl text-[10px] font-bold cursor-pointer transition-all duration-300 ${
              activeTab === "planner"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            <CheckSquare size={18} className={`transition-all duration-300 ${activeTab === "planner" ? "scale-110" : ""}`} />
            <span>Planner</span>
          </button>

          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-xl text-[10px] font-bold cursor-pointer transition-all duration-300 ${
              activeTab === "chat"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            <MessageCircle size={18} className={`transition-all duration-300 ${activeTab === "chat" ? "scale-110" : ""}`} />
            <span>Chat</span>
          </button>
        </nav>
      </div>

      {/* ===== OVERLAYS (Confirm Modals / Popups) ===== */}
      {/* 1. Add to Timeline Dropdown (manual slot picker) */}
      {activeAddEventSelector && (
        <AddToTimelineDropdown
          event={activeAddEventSelector}
          itinerary={itinerary || []}
          onSelect={(dayIdx, slotIdx) => {
            planner.handleManualAdd(activeAddEventSelector, dayIdx, slotIdx);
          }}
          onAddNewDay={() => {
            planner.handleAddNewDay(activeAddEventSelector);
          }}
          onClose={() => setActiveAddEventSelector(null)}
        />
      )}

      {/* 2. Conflict Override Confirmation Dialog */}
      {pendingConflict && (
        <ConflictConfirmModal
          isOpen={true}
          slotLabel={`${itinerary?.[pendingConflict.dayIdx]?.dayName || ""} ${itinerary?.[pendingConflict.dayIdx]?.timeSlots?.[pendingConflict.slotIdx]?.period || ""}`}
          existingTitle={pendingConflict.existingTitle}
          newEventTitle={pendingConflict.event.name}
          onReplace={planner.confirmReplace}
          onKeepBoth={planner.confirmKeepBoth}
          onCancel={planner.cancelConflict}
        />
      )}

      {/* 3. Day Deletion Confirmation Dialog */}
      {pendingRemoveDay !== null && itinerary && (
        <ConfirmModal
          isOpen={true}
          variant="danger"
          title={`Remove ${itinerary[pendingRemoveDay]?.dayName}?`}
          message={`This will remove ${itinerary[pendingRemoveDay]?.dayName} (${itinerary[pendingRemoveDay]?.date}) and all its activities from your plan. This action cannot be undone.`}
          confirmText="Remove Day"
          cancelText="Keep It"
          onConfirm={planner.confirmRemoveDay}
          onCancel={planner.cancelRemoveDay}
        />
      )}

      {/* ===== GLOBAL SOURCING ATTRIBUTION FOOTER (Visible on Desktop) ===== */}
      <footer className="hidden lg:block source-attribution-footer py-6 px-6 border-t border-white/10 mt-6">
        <div className="max-w-7xl mx-auto w-full">
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
