"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  MapPin,
  Sun,
  ArrowRight,
  Loader2,
  Users,
  Wallet,
  CalendarDays,
  Map,
} from "lucide-react";

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
  const [responseStream, setResponseStream] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasPlanStarted, setHasPlanStarted] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [responseStream, isLoading]);

  const handlePlanWeekend = async () => {
    setIsLoading(true);
    setHasPlanStarted(true);
    setResponseStream("");

    const prompt = `Generate an Auckland weekend itinerary using these inputs: audience=${audience}, budget=${budget}, tripDays=${tripDays}, region=${region}.`;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v2/plan";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, budget, tripDays, region, query: prompt }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.itinerary) {
        // Simulate streaming text for better UX
        let index = 0;
        const text = data.itinerary;
        const interval = setInterval(() => {
          if (index < text.length) {
            setResponseStream((prev) => prev + text.charAt(index));
            index++;
          } else {
            clearInterval(interval);
            setIsLoading(false);
          }
        }, 15);
      } else {
        throw new Error(data.error || "Failed to generate itinerary");
      }
    } catch (error) {
      console.error("API Error:", error);
      const dummyRes = `A weekend plan has been prepared for ${audience}.\n\nStart in ${region} with a ${budget} budget.\n\nMorning: keep it relaxed with coffee or a walk.\nAfternoon: add one main activity.\nEvening: finish with a scenic view or dinner.`;
      let index = 0;
      const interval = setInterval(() => {
        setResponseStream((prev) => prev + dummyRes.charAt(index));
        index++;
        if (index >= dummyRes.length) {
          clearInterval(interval);
          setIsLoading(false);
        }
      }, 35);
      return;
    }
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
    <main className="min-h-screen mesh-bg p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <motion.header
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={jellyTransition}
          className="flex justify-between items-center glass-panel p-6"
        >
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-dopamine-mint to-blue-500 bg-clip-text text-transparent">
              Auckland Weekend Planner
            </h1>
            <span className="text-xs font-bold bg-dopamine-yellow text-zinc-800 px-2 py-1 rounded-md transform -skew-x-12">
              BETA V2
            </span>
          </div>
          <div className="flex gap-4">
            <span className="flex items-center text-sm font-medium bg-white/50 px-3 py-1 rounded-full text-zinc-800 border border-white/50">
              <Sun className="w-4 h-4 mr-2 text-yellow-500" /> Sunny, 22°C
            </span>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <motion.section
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...jellyTransition, delay: 0.1 }}
            className="md:col-span-8 glass-panel p-6 flex flex-col min-h-[500px] relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-300 via-blue-400 to-blue-600"></div>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-dopamine-blue" />
                  Choose your trip settings before starting the AI chat
                </h2>
                <p className="text-sm text-zinc-600 mt-1">
                  Pick the audience, budget, day, and Auckland region first, then I will generate the plan.
                </p>
              </div>
              <span className="hidden md:inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
                AI Conversation
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-5 md:grid-cols-2">
              <div className="rounded-2xl border border-white/60 bg-white/45 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mb-3">
                  <Users className="w-4 h-4 text-dopamine-blue" /> Audience
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

              <div className="rounded-2xl border border-white/60 bg-white/45 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mb-3">
                  <Wallet className="w-4 h-4 text-dopamine-blue" /> Budget
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

              <div className="rounded-2xl border border-white/60 bg-white/45 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mb-3">
                  <CalendarDays className="w-4 h-4 text-dopamine-blue" /> Trip Day
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

              <div className="rounded-2xl border border-white/60 bg-white/45 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700 mb-3">
                  <Map className="w-4 h-4 text-dopamine-blue" /> Auckland Region
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

            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 mb-4 text-sm text-blue-900">
              Current selection: {audience} · {budget} budget · {tripDays} · {region}
            </div>

            <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
              {responseStream && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/40 p-4 rounded-2xl rounded-tl-none border border-white/50 shadow-sm text-zinc-800 leading-relaxed prose prose-sm max-w-none"
                >
                  <ReactMarkdown 
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-2 text-zinc-900" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-3 mb-2 text-zinc-800" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-3 mb-2 text-zinc-800" {...props} />,
                      p: ({node, ...props}) => <p className="mb-2 text-zinc-700" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 ml-2 text-zinc-700" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 ml-2 text-zinc-700" {...props} />,
                      li: ({node, ...props}) => <li className="mb-1" {...props} />,
                      strong: ({node, ...props}) => <strong className="font-semibold text-zinc-900" {...props} />,
                      em: ({node, ...props}) => <em className="italic" {...props} />,
                      code: ({node, inline, ...props}: any) => 
                        inline ? (
                          <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-sm font-mono text-zinc-800" {...props} />
                        ) : (
                          <code className="block bg-zinc-100 p-2 rounded mb-2 text-sm font-mono text-zinc-800 overflow-x-auto" {...props} />
                        ),
                    }}
                  >
                    {responseStream}
                  </ReactMarkdown>
                </motion.div>
              )}
              {isLoading && (
                <div className="flex items-center justify-start gap-3 py-4 text-dopamine-blue font-medium">
                  <Loader2 className="w-5 h-5 animate-spin" /> Generating your itinerary based on the selected conditions...
                </div>
              )}
              <div ref={endOfMessagesRef} />
            </div>

            <div className="mt-auto relative">
              <button
                type="button"
                onClick={handlePlanWeekend}
                disabled={isLoading}
                className="w-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4 text-white font-semibold shadow-lg shadow-blue-200 hover:brightness-105 disabled:opacity-50"
              >
                {hasPlanStarted ? "Regenerate itinerary" : "Generate itinerary"}
              </button>
            </div>
          </motion.section>

          <div className="md:col-span-4 flex flex-col gap-6">
            <motion.div
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ ...jellyTransition, delay: 0.2 }}
              className="glass-panel p-6 flex flex-col gap-4"
            >
              <h3 className="font-bold text-lg self-start text-zinc-800">Selection Summary</h3>
              <div className="space-y-3 text-sm text-zinc-700">
                <div className="flex items-center justify-between rounded-2xl bg-white/45 px-4 py-3">
                  <span>Audience</span>
                  <span className="font-semibold text-blue-700">{audience}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/45 px-4 py-3">
                  <span>Budget</span>
                  <span className="font-semibold text-blue-700">{budget}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/45 px-4 py-3">
                  <span>Trip Day</span>
                  <span className="font-semibold text-blue-700">{tripDays}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/45 px-4 py-3">
                  <span>Region</span>
                  <span className="font-semibold text-blue-700">{region}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}
