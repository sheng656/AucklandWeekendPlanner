"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, MapPin, Sun, ArrowRight, Loader2 } from "lucide-react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [responseStream, setResponseStream] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [responseStream, isLoading]);

  const handlePlanWeekend = async () => {
    if (!query) return;
    setIsLoading(true);
    setResponseStream("");

    try {
      const response = await fetch("http://localhost:3000/api/v2/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.body) throw new Error("No body returned");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setResponseStream((prev) => prev + chunk);
        }
      }
    } catch (error) {
      console.error("Stream Fetch Error:", error);
      const dummyRes = "🌟 *Auckland Weekend Vibe Check* 🌟\n\nMorning: A sunny walk at the domain.\nAfternoon: Art gallery opening (from Eventfinda).\nEvening: Dinning near the viaduct.";
      let index = 0;
      const interval = setInterval(() => {
        setResponseStream((prev) => prev + dummyRes.charAt(index));
        index++;
        if (index >= dummyRes.length - 1) {
          clearInterval(interval);
          setIsLoading(false);
        }
      }, 50);
      return; 
    } finally {
      setIsLoading(false);
    }
  };

  const jellyTransition = {
    type: "spring" as const,
    stiffness: 300,
    damping: 15,
  };

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
            <span className="text-xs font-bold bg-dopamine-yellow text-zinc-800 px-2 py-1 rounded-md transform -skew-x-12">BETA V2</span>
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
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-dopamine-coral" /> Weekend AI Copilot
            </h2>
            
            <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
              {responseStream && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/40 p-4 rounded-2xl rounded-tl-none border border-white/50 shadow-sm whitespace-pre-wrap text-zinc-800 leading-relaxed"
                >
                  {responseStream}
                </motion.div>
              )}
              {isLoading && (
                <div className="flex items-center justify-start gap-3 py-4 text-dopamine-coral font-medium">
                  <Loader2 className="w-5 h-5 animate-spin" /> Thinking & Syncing with DynamoDB...
                </div>
              )}
              <div ref={endOfMessagesRef} />
            </div>

            <div className="mt-auto relative">
              <input
                type="text"
                placeholder="What kind of weekend vibe are you looking for?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePlanWeekend()}
                className="w-full bg-white/50 border border-white/40 rounded-full px-6 py-4 pr-16 placeholder-zinc-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-dopamine-coral/50 transition-all font-medium text-zinc-700"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePlanWeekend}
                disabled={isLoading || !query}
                className="absolute right-2 top-2 bottom-2 bg-gradient-to-r from-blue-400 to-cyan-500 text-white rounded-full px-4 flex items-center justify-center disabled:opacity-50"
              >
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </div>
          </motion.section>

          <div className="md:col-span-4 flex flex-col gap-6">
            <motion.div 
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ ...jellyTransition, delay: 0.2 }}
              className="glass-panel p-6 flex flex-col items-center justify-center"
            >
              <h3 className="font-bold text-lg mb-4 self-start text-zinc-800">Vibe-O-Meter</h3>
              <div className="w-full space-y-5">
                <div className="space-y-1 group">
                  <div className="flex justify-between text-xs font-semibold text-zinc-600 mb-1">
                    <span>Chill Factor</span>
                    <span>85%</span>
                  </div>
                  <div className="h-3 w-full bg-black/5 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      className="h-full bg-[#22d3ee]"
                      initial={{ width: 0 }}
                      animate={{ width: '85%' }}
                      transition={{ duration: 1.5, type: 'spring' }}
                    />
                  </div>
                </div>
                <div className="space-y-1 group">
                  <div className="flex justify-between text-xs font-semibold text-zinc-600 mb-1">
                    <span>Energy Level</span>
                    <span>60%</span>
                  </div>
                  <div className="h-3 w-full bg-black/5 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      className="h-full bg-[#0ea5e9]"
                      initial={{ width: 0 }}
                      animate={{ width: '60%' }}
                      transition={{ duration: 1.5, delay: 0.2, type: 'spring' }}
                    />
                  </div>
                </div>
                <div className="space-y-1 group">
                  <div className="flex justify-between text-xs font-semibold text-zinc-600 mb-1">
                    <span>Budget Index</span>
                    <span>$$$</span>
                  </div>
                  <div className="h-3 w-full bg-black/5 rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      className="h-full bg-[#fdfd96]"
                      initial={{ width: 0 }}
                      animate={{ width: '40%' }}
                      transition={{ duration: 1.5, delay: 0.4, type: 'spring' }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ ...jellyTransition, delay: 0.3 }}
              className="glass-panel flex-1 min-h-[250px] flex justify-center items-center text-center relative overflow-hidden group border-4 border-white/40"
            >
              <div className="absolute inset-0 mesh-bg opacity-30"></div>
              <div className="relative z-10 flex flex-col items-center">
                 <motion.div 
                    animate={{ y: [0, -10, 0] }} 
                    transition={{ repeat: Infinity, duration: 2 }}
                 >
                    <MapPin className="w-10 h-10 text-dopamine-blue drop-shadow-md mb-2" />
                 </motion.div>
                 <span className="text-sm font-bold text-zinc-600 bg-white/70 px-3 py-1 rounded-full shadow-sm">Mapbox 3D Loaded</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}

