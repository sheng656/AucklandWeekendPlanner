"use client";

import { useState } from "react";
import { Trees, Coins, Users, MapPin, Loader2 } from "lucide-react";

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
};

export default function Home() {
  const [audience, setAudience] = useState("Couple");
  const [location, setLocation] = useState("Central Auckland");
  const [budget, setBudget] = useState("Moderate");
  const [avoidCrowds, setAvoidCrowds] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setItinerary(null);

    // Hardcode to process.env or just a relative path if deploying normally.
    // In our CDK we output the full URL. Let's just use the URL if set, or fallback.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/plan"; // Placeholder

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
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Auckland Weekend Planner
          </h1>
          <p className="mt-4 text-lg text-gray-500">
            AI-powered, personalized weekend itineraries for Auckland.
          </p>
        </div>

        <form onSubmit={handleGenerate} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-gray-700">
                <Users className="w-4 h-4 mr-2 text-blue-500" />
                Who's going?
              </label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 border"
              >
                <option>Solo</option>
                <option>Couple</option>
                <option>Family with Kids</option>
                <option>Group of Friends</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-gray-700">
                <MapPin className="w-4 h-4 mr-2 text-red-500" />
                Area Preference
              </label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm p-3 border"
              >
                <option>Central Auckland</option>
                <option>North Shore</option>
                <option>South Auckland</option>
                <option>East Auckland</option>
                <option>West Auckland</option>
                <option>Waiheke Island</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-gray-700">
                <Coins className="w-4 h-4 mr-2 text-yellow-500" />
                Budget per day
              </label>
              <select
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 sm:text-sm p-3 border"
              >
                <option>Free / Very Cheap</option>
                <option>Moderate</option>
                <option>Luxury</option>
              </select>
            </div>

            <div className="space-y-2 flex flex-col justify-center">
              <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                <Trees className="w-4 h-4 mr-2 text-green-500" />
                Vibe Mode
              </label>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={avoidCrowds}
                    onChange={(e) => setAvoidCrowds(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={"block w-14 h-8 rounded-full transition-colors " + (avoidCrowds ? "bg-green-500" : "bg-gray-300")}></div>
                  <div className={"dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform " + (avoidCrowds ? "transform translate-x-6" : "")}></div>
                </div>
                <span className="ml-3 text-sm text-gray-700">Avoid Crowds (Off-the-beaten-path)</span>
              </label>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                  Generating your perfect weekend...
                </>
              ) : (
                "Plan My Weekend"
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {itinerary && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center pb-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">{itinerary.title}</h2>
              <p className="mt-2 text-gray-600">{itinerary.description}</p>
            </div>

            <div className="space-y-8">
              {itinerary.days.map((dayLine, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-100 px-6 py-4">
                    <h3 className="text-lg font-semibold text-gray-900">{dayLine.day}</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {dayLine.activities.map((act, j) => (
                      <div key={j} className="px-6 py-6 sm:flex sm:items-start p-4">
                        <div className="sm:w-32 flex-shrink-0 mb-4 sm:mb-0">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            {act.time}
                          </span>
                        </div>
                        <div className="sm:ml-4 flex-1">
                          <h4 className="text-lg font-medium text-gray-900">{act.title}</h4>
                          <p className="mt-1 text-sm text-gray-500 flex items-center">
                            <MapPin className="w-3 h-3 mr-1" />
                            {act.location}
                          </p>
                          <p className="mt-3 text-sm text-gray-700">{act.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
