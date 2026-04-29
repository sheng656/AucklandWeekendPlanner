"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  MapPin,
  Sun,
  Loader2,
  Users,
  Wallet,
  CalendarDays,
  Map,
  RotateCcw
} from "lucide-react";
import ChatMessage from "./components/ChatMessage";
import EventCard from "./components/EventCard";

type Audience = "Couples" | "Friends" | "Family" | "Solo";
type Budget = "Free" | "Low" | "Medium" | "High";
type TripDays = "Saturday" | "Sunday" | "Both Days";
type Region = "Central Auckland" | "East Auckland" | "West Auckland" | "South Auckland" | "North Shore" | "Waiheke Island";

const audienceOptions: Audience[] = ["Couples", "Friends", "Family", "Solo"];
const budgetOptions: Budget[] = ["Free", "Low", "Medium", "High"];
const tripDayOptions: TripDays[] = ["Saturday", "Sunday", "Both Days"];
const regionOptions: Region[] = ["Central Auckland", "East Auckland", "West Auckland", "South Auckland", "North Shore", "Waiheke Island"];

export default function Home() {
  const [audience, setAudience] = useState<Audience>("Friends");
  const [budget, setBudget] = useState<Budget>("Medium");
  const [tripDays, setTripDays] = useState<TripDays>("Both Days");
  const [region, setRegion] = useState<Region>("Central Auckland");
  
  const [showPreferences, setShowPreferences] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const [messages, setMessages] = useState<{role: "user" | "assistant", content: string}[]>([]);
  const [eventsData, setEventsData] = useState<any[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, eventsData]);

  const handlePlanWeekend = async () => {
    setIsLoading(true);
    setShowPreferences(false);
    
    const userMessage = `Please plan a ${tripDays} weekend in ${region} for ${audience} with a ${budget} budget.`;
    setMessages([{ role: "user", content: userMessage }]);
    setEventsData([]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v2/plan";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, budget, tripDays, region, query: userMessage }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.itinerary) {
        setMessages(prev => [...prev, { role: "assistant", content: data.itinerary }]);
        if (data.events) {
          setEventsData(data.events);
        }
      } else {
        throw new Error(data.error || "Failed to generate itinerary");
      }
    } catch (error) {
      console.error("API Error:", error);
      const dummyRes = `I encountered an issue connecting to the planning service. However, here is a general suggestion:\n\nStart your weekend in ${region} keeping your ${budget} budget in mind. Have a great time!`;
      setMessages(prev => [...prev, { role: "assistant", content: dummyRes }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setShowPreferences(true);
    setMessages([]);
    setEventsData([]);
  };

  const jellyTransition = {
    type: "spring" as const,
    stiffness: 300,
    damping: 15,
  };

  const choicePill =
    "rounded-full border border-white/60 bg-white/50 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:bg-white/70";
  const choicePillActive =
    "rounded-full border border-blue-300 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-200 transition-all";

  return (
    <main className="min-h-screen mesh-bg p-4 md:p-8 font-sans flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex flex-col gap-6 flex-1">
        <motion.header
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={jellyTransition}
          className="flex justify-between items-center glass-panel p-6 shrink-0"
        >
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-dopamine-mint to-blue-500 bg-clip-text text-transparent">
              Auckland Weekend Planner
            </h1>
            <span className="hidden md:inline-block text-xs font-bold bg-dopamine-yellow text-zinc-800 px-2 py-1 rounded-md transform -skew-x-12">
              BETA V2
            </span>
          </div>
          <div className="flex gap-4">
            <span className="flex items-center text-sm font-medium bg-white/50 px-3 py-1 rounded-full text-zinc-800 border border-white/50">
              <Sun className="w-4 h-4 mr-2 text-yellow-500" /> Sunny, 22°C
            </span>
          </div>
        </motion.header>

        <div className="flex-1 flex flex-col relative">
          <AnimatePresence mode="wait">
            {showPreferences ? (
              <motion.section
                key="preferences"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={jellyTransition}
                className="glass-panel p-6 flex flex-col relative overflow-hidden h-full"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-300 via-blue-400 to-blue-600"></div>
                <div className="flex items-start justify-between gap-4 mb-6 mt-2">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-zinc-800">
                      <Sparkles className="w-6 h-6 text-dopamine-blue" />
                      Design Your Perfect Weekend
                    </h2>
                    <p className="text-sm text-zinc-600 mt-1">
                      Set your preferences below and let AI craft a personalized itinerary with real events.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 mb-8 md:grid-cols-2 flex-1">
                  <div className="rounded-2xl border border-white/60 bg-white/40 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mb-3">
                      <Users className="w-4 h-4 text-dopamine-blue" /> Who's going?
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {audienceOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setAudience(option)}
                          className={audience === option ? choicePillActive : choicePill}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/60 bg-white/40 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mb-3">
                      <Wallet className="w-4 h-4 text-dopamine-blue" /> Budget Level
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {budgetOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setBudget(option)}
                          className={budget === option ? choicePillActive : choicePill}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/60 bg-white/40 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mb-3">
                      <CalendarDays className="w-4 h-4 text-dopamine-blue" /> When?
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tripDayOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setTripDays(option)}
                          className={tripDays === option ? choicePillActive : choicePill}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/60 bg-white/40 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mb-3">
                      <Map className="w-4 h-4 text-dopamine-blue" /> Where?
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {regionOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setRegion(option)}
                          className={region === option ? choicePillActive : choicePill}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-auto">
                  <button
                    type="button"
                    onClick={handlePlanWeekend}
                    className="w-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 text-white font-bold text-lg shadow-lg shadow-blue-200/50 hover:brightness-105 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Generate Magic Itinerary
                  </button>
                </div>
              </motion.section>
            ) : (
              <motion.section
                key="chat"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col flex-1 pb-20"
              >
                <div className="flex flex-col md:flex-row flex-1 gap-6 min-h-0 overflow-hidden">
                  {/* Left: Chat History (60% width on desktop) */}
                  <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-2 no-scrollbar">
                    {messages.map((msg, idx) => (
                      <ChatMessage key={idx} role={msg.role} content={msg.content} />
                    ))}
                    
                    {isLoading && (
                      <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="flex w-full justify-start mb-6"
                      >
                        <div className="flex gap-3 max-w-[85%]">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br from-dopamine-mint to-cyan-400">
                            <Sparkles className="w-4 h-4 text-zinc-900" />
                          </div>
                          <div className="relative px-5 py-4 rounded-2xl glass-panel bg-white/60 text-zinc-800 rounded-tl-sm border border-white/60 shadow-sm min-w-[200px]">
                            <div className="flex items-center gap-2 text-blue-600 font-medium text-sm">
                              <Loader2 className="w-4 h-4 animate-spin" /> Gathering local events...
                            </div>
                            <div className="mt-4 space-y-3">
                              <div className="h-4 w-32 bg-zinc-200/50 animate-pulse rounded"></div>
                              <div className="h-4 w-48 bg-zinc-200/50 animate-pulse rounded"></div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  
                  {/* Right: Event Cards Sidebar (40% width on desktop) */}
                  <AnimatePresence>
                    {eventsData.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="md:w-80 shrink-0 flex flex-col gap-4"
                      >
                        <div className="flex items-center gap-2 px-1 text-sm font-bold text-zinc-700">
                          <MapPin className="w-4 h-4 text-dopamine-blue" /> 
                          <span className="hidden md:inline">Recommended Events</span>
                          <span className="md:hidden">Swipe Events</span>
                        </div>
                        
                        {/* Mobile: Horizontal, Desktop: Vertical */}
                        <div className="flex md:flex-col gap-4 overflow-x-auto md:overflow-y-auto pb-4 md:pb-0 px-1 no-scrollbar md:max-h-[calc(100vh-300px)]">
                          {eventsData.map((event) => (
                            <EventCard key={event.id} event={event} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* Fixed bottom actions */}
                <motion.div 
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="fixed bottom-6 left-0 right-0 mx-auto max-w-4xl px-4 flex justify-center"
                >
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-2 glass-panel bg-white/80 border border-white/80 px-6 py-3 rounded-full text-zinc-800 font-bold shadow-lg hover:bg-white transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-blue-600" /> Start Over
                  </button>
                </motion.div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
