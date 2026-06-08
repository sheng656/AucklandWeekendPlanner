"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { EventData, Region } from "../types";

const ITEMS_PER_PAGE_MOBILE = 6;
const ITEMS_PER_PAGE_DESKTOP = 12;

export type CostFilter = "All" | "Free" | "Paid";

export interface EventFilters {
  sources: string[];
  regions: Region[];
  dates: string[];
  times: string[];
  cost: CostFilter;
  keyword: string;
}

export interface UseEventsReturn {
  allEvents: EventData[];
  filteredEvents: EventData[];
  paginatedEvents: EventData[];
  isLoading: boolean;
  error: string | null;
  filters: EventFilters;
  toggleSource: (source: string) => void;
  toggleRegion: (region: Region) => void;
  toggleDate: (date: string) => void;
  toggleTime: (time: string) => void;
  setCost: (cost: CostFilter) => void;
  setKeyword: (keyword: string) => void;
  clearFilters: () => void;
  syncFiltersFromPreferences: (dates: string[], regions: Region[]) => void;
  activeFilterCount: number;
  currentPage: number;
  totalPages: number;
  setCurrentPage: (p: number) => void;
  itemsPerPage: number;
  refetch: () => void;
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

const DEFAULT_FILTERS: EventFilters = {
  sources: [],
  regions: [],
  dates: [],
  times: [],
  cost: "All",
  keyword: "",
};

export function useEvents(): UseEventsReturn {
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const [filters, setFilters] = useState<EventFilters>(DEFAULT_FILTERS);
  const [currentPage, setCurrentPage] = useState(1);

  const isMobile = useIsMobile();
  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE_DESKTOP;

  // Fetch events on mount and fetchTick changes
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const url = process.env.NEXT_PUBLIC_API_URL
      ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "")}/api/v2/events`
      : "/api/v2/events";

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.events)) {
          setAllEvents(data.events);
        } else {
          setError("Unexpected response format");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load events");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fetchTick]);

  // Reset to page 1 on filter or itemsPerPage change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, itemsPerPage]);

  // Apply filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => {
      // Source filter (empty means match all)
      if (filters.sources.length > 0 && e.source && !filters.sources.includes(e.source)) {
        return false;
      }

      // Region filter (empty means match all)
      if (filters.regions.length > 0 && e.mapped_region && !filters.regions.includes(e.mapped_region as Region)) {
        return false;
      }

      // Date filter (empty means match all)
      if (filters.dates.length > 0 && e.datetime_start) {
        const eventDateStr = e.datetime_start.split("T")[0];
        if (!filters.dates.includes(eventDateStr)) {
          return false;
        }
      }

      // Cost filter
      if (filters.cost === "Free" && !e.is_free) return false;
      if (filters.cost === "Paid" && e.is_free) return false;

      // Time of day filter (based on datetime_start hour)
      if (filters.times.length > 0 && e.datetime_start) {
        const hour = new Date(e.datetime_start).getHours();
        let matchesTime = false;
        for (const t of filters.times) {
          if (t === "Morning" && hour >= 5 && hour < 12) matchesTime = true;
          if (t === "Afternoon" && hour >= 12 && hour < 17) matchesTime = true;
          if (t === "Evening" && (hour >= 17 || hour < 5)) matchesTime = true;
        }
        if (!matchesTime) return false;
      }

      // Keyword search
      if (filters.keyword.trim()) {
        const kw = filters.keyword.toLowerCase();
        const haystack = `${e.name} ${e.description} ${e.location_summary}`.toLowerCase();
        if (!haystack.includes(kw)) return false;
      }

      return true;
    });
  }, [allEvents, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));

  const paginatedEvents = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEvents.slice(start, start + itemsPerPage);
  }, [filteredEvents, currentPage, itemsPerPage]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.sources.length > 0) count++;
    if (filters.regions.length > 0) count++;
    if (filters.dates.length > 0) count++;
    if (filters.times.length > 0) count++;
    if (filters.cost !== "All") count++;
    if (filters.keyword.trim()) count++;
    return count;
  }, [filters]);

  const toggleSource = useCallback((source: string) => {
    setFilters((f) => ({
      ...f,
      sources: f.sources.includes(source)
        ? f.sources.filter((s) => s !== source)
        : [...f.sources, source],
    }));
  }, []);

  const toggleRegion = useCallback((region: Region) => {
    setFilters((f) => ({
      ...f,
      regions: f.regions.includes(region)
        ? f.regions.filter((r) => r !== region)
        : [...f.regions, region],
    }));
  }, []);

  const toggleDate = useCallback((date: string) => {
    setFilters((f) => ({
      ...f,
      dates: f.dates.includes(date)
        ? f.dates.filter((d) => d !== date)
        : [...f.dates, date],
    }));
  }, []);

  const toggleTime = useCallback((time: string) => {
    setFilters((f) => ({
      ...f,
      times: f.times.includes(time)
        ? f.times.filter((t) => t !== time)
        : [...f.times, time],
    }));
  }, []);

  const setCost = useCallback((cost: CostFilter) => {
    setFilters((f) => ({ ...f, cost }));
  }, []);

  const setKeyword = useCallback((keyword: string) => {
    setFilters((f) => ({ ...f, keyword }));
  }, []);

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);
  const refetch = useCallback(() => setFetchTick((t) => t + 1), []);

  const syncFiltersFromPreferences = useCallback((dates: string[], regions: Region[]) => {
    setFilters((f) => ({
      ...f,
      dates,
      regions,
    }));
  }, []);

  return {
    allEvents,
    filteredEvents,
    paginatedEvents,
    isLoading,
    error,
    filters,
    toggleSource,
    toggleRegion,
    toggleDate,
    toggleTime,
    setCost,
    setKeyword,
    clearFilters,
    syncFiltersFromPreferences,
    activeFilterCount,
    currentPage,
    totalPages,
    setCurrentPage,
    itemsPerPage,
    refetch,
  };
}
