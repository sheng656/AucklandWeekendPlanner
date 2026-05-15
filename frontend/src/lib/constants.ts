import type { Audience, Budget, TripDays, Region } from "../types";

export const audienceOptions: Audience[] = ["Couples", "Friends", "Family", "Solo"];
export const budgetOptions: Budget[] = ["Free", "Low", "Medium", "High"];
export const tripDayOptions: TripDays[] = ["Saturday", "Sunday", "Both Days"];
export const regionOptions: Region[] = [
  "Central Auckland",
  "East Auckland",
  "West Auckland",
  "South Auckland",
  "North Shore",
  "Waiheke Island",
];

// Phase 4: Budget/Audience visual gradients can be added here later
export const choicePill = "rounded-full border border-white/60 bg-white/50 px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:bg-white/75 cursor-pointer dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700";
export const choicePillActive = "rounded-full border border-blue-400 bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all cursor-pointer";
