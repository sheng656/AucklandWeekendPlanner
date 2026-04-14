"use client";

import { useState, useRef, useEffect } from "react";
import { Trees, Coins, Users, MapPin, Loader2, Sparkles, Send, RefreshCw, Calendar, MessageSquare } from "lucide-react";
import ReactMarkdown from 'react-markdown';

type ItineraryDay = {
  day: string;
  activities: {
    time: string;
    title: string;
    description: string;
    location: string;
  }[];
};

type Itinerary = {
  title: string;
  description: string;
  days: ItineraryDay[];
  _context?: any;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [audience, setAudience] = useState("Couple");
  const [location, setLocation] = useState("Central Auckland");
  const [budget, setBudget] = useState("Moderate");
  const [avoidCrowds, setAvoidCrowds] = useState(false);

  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState("");
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setItinerary(null);
    setMessages([]);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/plan";

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, location, budget, avoidCrowds }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate itinerary. Please try again.");
      }

      const data = await res.json();
      setItinerary(data);
      // Initialize chat with a welcoming message
      setMessages([{ role: "assistant", content: `Hi there! I've created your weekend itinerary. What do you think? Note you can ask me to swap activities or change constraints any time.` }]);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = { role: "user" as const, content: chatInput };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/plan";

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          audience, location, budget, avoidCrowds,
          messages: newMessages,
          context: itinerary?._context
        }),
      });

      if (!res.ok) throw new Error("Failed to send message.");

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      console.error(err);
      setMessages([...newMessages, { role: "assistant", content: "**Error**: Unable to reach the AI. Please try again later." }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-none bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm z-10 w-full relative">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 leading-tight">
              Auckland AI Weekend <span className="text-blue-600">Planner</span>
            </h1>
          </div>
        </div>
        {itinerary && (
          <button
            onClick={() => setItinerary(null)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
          >
            <RefreshCw className="w-4 h-4" /> Start Over
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden w-full relative">
        {!itinerary ? (
          // FULL PAGE WIZARD FORM
          <div className="w-full flex-1 overflow-y-auto px-4 py-8">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center py-6">
                <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
                  Let&apos;s design your perfect weekend
                </h2>
                <p className="mt-4 text-lg text-gray-500">
                  Tell us a bit about what you&apos;re looking for, and our AI will fetch local weather, events, and craft a personalized itinerary.
                </p>
              </div>

              <form onSubmit={handleGenerate} className="bg-white p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="flex items-center text-sm font-bold text-gray-700">
                      <div className="p-1.5 bg-blue-100 rounded-md mr-3">
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      Who&apos;s going?
                    </label>
                    <select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      className="block w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-blue-500 sm:text-lg p-4 border transition outline-none"
                    >
                      <option>Solo</option>
                      <option>Couple</option>
                      <option>Family with Kids</option>
                      <option>Group of Friends</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center text-sm font-bold text-gray-700">
                      <div className="p-1.5 bg-red-100 rounded-md mr-3">
                        <MapPin className="w-4 h-4 text-red-600" />
                      </div>
                      Area Preference
                    </label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="block w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-red-500 focus:ring-red-500 sm:text-lg p-4 border transition outline-none"
                    >
                      <option>Central Auckland</option>
                      <option>North Shore</option>
                      <option>South Auckland</option>
                      <option>East Auckland</option>
                      <option>West Auckland</option>
                      <option>Waiheke Island</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center text-sm font-bold text-gray-700">
                      <div className="p-1.5 bg-yellow-100 rounded-md mr-3">
                        <Coins className="w-4 h-4 text-yellow-600" />
                      </div>
                      Budget
                    </label>
                    <select
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="block w-full rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-yellow-500 focus:ring-yellow-500 sm:text-lg p-4 border transition outline-none"
                    >
                      <option>Free / Very Cheap</option>
                      <option>Moderate</option>
                      <option>Luxury</option>
                    </select>
                  </div>

                  <div className="space-y-3 flex flex-col justify-center">
                    <label className="flex items-center text-sm font-bold text-gray-700">
                      <div className="p-1.5 bg-green-100 rounded-md mr-3">
                        <Trees className="w-4 h-4 text-green-600" />
                      </div>
                      Vibe Options
                    </label>
                    <label className="flex items-center cursor-pointer mt-2 bg-gray-50 p-4 rounded-xl border border-gray-200 hover:bg-gray-100 transition">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={avoidCrowds}
                          onChange={(e) => setAvoidCrowds(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`block w-12 h-7 rounded-full transition-colors ${avoidCrowds ? "bg-green-500" : "bg-gray-300"}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${avoidCrowds ? "transform translate-x-5" : ""}`}></div>
                      </div>
                      <span className="ml-4 text-base font-medium text-gray-700">Avoid Crowds <span className="text-gray-400 font-normal">(Off-the-beaten-path)</span></span>
                    </label>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-4 px-6 rounded-2xl shadow-lg text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition transform hover:scale-[1.01]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                        Generating your perfect weekend...
                      </>
                    ) : (
                      "Generate Initial Itinerary"
                    )}
                  </button>
                </div>
              </form>

              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md animate-in fade-in">
                  <p className="text-sm font-medium text-red-700">{error}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          // SPLIT VIEW: Itinerary & AI Chat
          <div className="w-full flex flex-col md:flex-row h-full">
            {/* Left Panel: The Itinerary Document */}
            <div className="flex-1 md:w-1/2 overflow-y-auto p-4 md:p-8 bg-white border-r border-gray-200">
              <div className="max-w-3xl mx-auto animate-in slide-in-from-left-4 duration-500">
                <div className="mb-8 border-b border-gray-100 pb-6">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 mb-4 uppercase tracking-wider">
                    Your Weekend Plan
                  </span>
                  <h2 className="text-3xl font-extrabold text-gray-900 leading-tight">{itinerary.title}</h2>
                  <p className="mt-3 text-lg text-gray-600 leading-relaxed">{itinerary.description}</p>
                </div>

                <div className="space-y-10">
                  {itinerary.days.map((dayLine, i) => (
                    <div key={i} className="relative">
                      <div className="flex items-center gap-3 mb-6 sticky top-0 bg-white py-2 z-10">
                        <Calendar className="w-6 h-6 text-blue-600" />
                        <h3 className="text-2xl font-bold text-gray-900">{dayLine.day}</h3>
                      </div>
                      
                      <div className="space-y-6">
                        {dayLine.activities.map((act, j) => (
                          <div key={j} className="flex gap-4 group">
                            <div className="flex flex-col items-center">
                              <div className="w-3 h-3 rounded-full bg-blue-500 mt-2 z-10 group-hover:scale-125 transition-transform"></div>
                              {j !== dayLine.activities.length - 1 && (
                                <div className="w-0.5 h-full bg-blue-100 mt-2"></div>
                              )}
                            </div>
                            <div className="bg-gray-50/50 rounded-2xl p-5 border border-gray-100 flex-1 hover:shadow-md transition-shadow group-hover:border-blue-100 group-hover:bg-blue-50/30">
                              <div className="sm:flex sm:items-start justify-between">
                                <h4 className="text-lg font-bold text-gray-900 flex-1 pr-4">{act.title}</h4>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-200/60 text-gray-800 whitespace-nowrap mt-2 sm:mt-0 shadow-sm border border-gray-200">
                                  {act.time}
                                </span>
                              </div>
                              <p className="mt-3 text-sm text-gray-700 leading-relaxed">{act.description}</p>
                              <div className="mt-4 pt-3 border-t border-gray-200/60 flex items-center text-sm font-medium text-gray-500">
                                <MapPin className="w-4 h-4 mr-1.5 text-red-400" />
                                {act.location}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Panel: AI Companion Chat */}
            <div className="flex-1 md:w-1/2 flex flex-col bg-gray-50/50">
              <div className="px-6 py-4 bg-white/80 backdrop-blur border-b border-gray-200 shadow-sm z-10 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">AI Concierge</h3>
                  <p className="text-xs text-gray-500">Suggestions, swaps, or weather info</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2`}>
                    <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm border ${
                      msg.role === "user" 
                        ? "bg-blue-600 text-white border-blue-700 rounded-tr-sm" 
                        : "bg-white text-gray-800 border-gray-200 rounded-tl-sm prose prose-sm prose-blue max-w-none"
                    }`}>
                      {msg.role === "assistant" ? (
                         <ReactMarkdown>{msg.content}</ReactMarkdown>
                      ) : (
                         <div className="text-[15px] leading-relaxed">{msg.content}</div>
                      )}
                    </div>
                  </div>
                ))}
                
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white text-gray-500 border border-gray-200 rounded-2xl rounded-tl-sm p-4 shadow-sm flex items-center gap-2">
                       <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                       <span className="text-sm font-medium">Thinking...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} className="pb-4" />
              </div>

              <div className="bg-white p-4 border-t border-gray-200 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
                <form onSubmit={handleChatSubmit} className="relative flex items-center">
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask to change an activity, e.g. 'Can we do a museum instead of the hike?'"
                    className="w-full bg-gray-50 border border-gray-200 rounded-full pl-5 pr-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition text-gray-700 placeholder-gray-400"
                  />
                  <button 
                    type="submit" 
                    disabled={!chatInput.trim() || chatLoading}
                    className="absolute right-2 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 transition-colors text-white rounded-full focus:outline-none shadow-sm"
                  >
                    <Send className="w-4 h-4 ml-0.5" />
                  </button>
                </form>
                <div className="text-center mt-2">
                  <p className="text-[11px] text-gray-400">Powered by Amazon Bedrock</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

