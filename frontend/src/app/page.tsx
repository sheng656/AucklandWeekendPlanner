"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Compass } from "lucide-react";
import WeatherWidget from "./components/WeatherWidget";
import PreferencePanel from "./components/PreferencePanel";
import ResultsSection from "./components/ResultsSection";
import ScrollToTop from "./components/ScrollToTop";
import ChatAssistant from "./components/ChatAssistant";
import { SOURCE_SITES } from "../lib/sourceUtils";
import { usePlanner } from "../lib/usePlanner";
import { executeAgentCommand } from "../lib/commandExecutor";
import type { AgentCommand } from "../types";

export default function Home() {
  const planner = usePlanner();
  const {
    audience, setAudience,
    budget, setBudget,
    selectedDates, toggleDate, availableDates,
    region, toggleRegion,
    showPreferences,
    isLoading,
    itinerary,
    rawItinerary,
    recommendedEvents,
    otherEvents,
    moreEventsOpen, setMoreEventsOpen,
    swappingSlot,
    weatherForecast,
    weatherData,
    handlePlanWeekend,
    handleReset,
    handleRemoveActivity,
    handleSelectEvent
  } = planner;

  const moreEventsRef = useRef<HTMLDivElement>(null);

  const handleSwapClick = (dayIdx: number, slotIdx: number, actIdx: number) => {
    planner.handleSwapClick(dayIdx, slotIdx, actIdx);
    // Smooth scroll to event selection
    setTimeout(() => {
      moreEventsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

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
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-md shrink-0">
              <Compass className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-2">
              <h1 className="text-base sm:text-xl md:text-3xl font-extrabold bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent leading-tight tracking-tighter sm:tracking-normal">
                Auckland Weekend Planner
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-bold bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-2 py-0.5 rounded-md self-center">
                BETA V2
              </span>
            </div>
          </div>
          <WeatherWidget weather={weatherData} />
        </motion.header>
 
        {/* ===== CONTENT ===== */}
        <AnimatePresence mode="wait">
          {showPreferences ? (
            <PreferencePanel
              audience={audience} setAudience={setAudience}
              budget={budget} setBudget={setBudget}
              selectedDates={selectedDates} toggleDate={toggleDate}
              availableDates={availableDates}
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

      {/* ===== AI CHAT ASSISTANT ===== */}
      {!showPreferences && itinerary && (
        <ChatAssistant
          itinerary={itinerary}
          selectedDates={selectedDates.map(d => d.date)}
          region={region}
          audience={audience}
          budget={budget}
          onExecuteCommand={handleExecuteCommand}
        />
      )}

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
