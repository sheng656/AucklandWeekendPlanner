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
export const choicePill = "relative overflow-hidden rounded-full border border-white/60 bg-white/50 px-3 py-1.5 md:px-4 md:py-2 text-[11px] md:text-sm font-semibold text-zinc-700 shadow-sm transition-all hover:bg-white/75 hover:scale-[1.02] active:scale-[0.98] cursor-pointer dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700 flex flex-col justify-center items-center h-full";
export const choicePillActive = "relative overflow-hidden rounded-full border border-transparent bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 px-3 py-1.5 md:px-4 md:py-2 text-[11px] md:text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition-all scale-[1.02] cursor-pointer flex flex-col justify-center items-center h-full";
