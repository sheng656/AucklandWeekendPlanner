"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, ChevronDown, Plus, Calendar, MapPin, ExternalLink, Map, ChevronLeft, ChevronRight } from "lucide-react";

interface EventData {
  id: string;
  name: string;
  description: string;
  image_url: string;
  datetime_start: string;
  datetime_end: string;
  location_summary: string;
  is_free: boolean;
  url: string;
  mapped_region?: string;
}

interface MoreEventsProps {
  events: EventData[];
  isOpen: boolean;
  onToggle: () => void;
  swappingActive: boolean;
  onSelectEvent: (event: EventData) => void;
  selectedRegions: string[];
}

export default function MoreEvents({
  events,
  isOpen,
  onToggle,
  swappingActive,
  onSelectEvent,
  selectedRegions,
}: MoreEventsProps) {
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Reset pagination/filters when toggling or new events load
  useEffect(() => {
    setCurrentPage(1);
    setShowAllRegions(false);
  }, [events, isOpen]);

  const hasSpecificRegions = selectedRegions.length > 0 && selectedRegions.length < 6;

  // Separate events matching user's region preference vs others
  const matchingEvents = events.filter(e => {
    if (!e.mapped_region || e.mapped_region === "Unknown") return true; // keep unknowns in the main pool
    return selectedRegions.includes(e.mapped_region);
  });
  
  const otherRegionEvents = events.filter(e => {
    if (!e.mapped_region || e.mapped_region === "Unknown") return false;
    return !selectedRegions.includes(e.mapped_region);
  });

  const displayList = hasSpecificRegions && !showAllRegions 
    ? matchingEvents 
    : [...matchingEvents, ...otherRegionEvents];

  const totalPages = Math.ceil(displayList.length / itemsPerPage);
  const paginatedEvents = displayList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (events.length === 0) return null;

  return (
    <div className="more-events-section">
      <button onClick={onToggle} className="more-events-toggle">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-bold text-zinc-700">
            Explore More Events
          </span>
          <span className="text-xs text-zinc-400 font-normal">
            ({displayList.length} available)
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            {swappingActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mx-4 mt-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700 font-medium"
              >
                👆 Select an event below to swap into your plan
              </motion.div>
            )}

            {/* Pagination & Filter Controls */}
            <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-3">
              {hasSpecificRegions && otherRegionEvents.length > 0 && (
                <button 
                  onClick={() => { setShowAllRegions(!showAllRegions); setCurrentPage(1); }}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 ${showAllRegions ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'}`}
                >
                  <Map className="w-3.5 h-3.5" />
                  {showAllRegions ? "Showing All Regions" : `Show Other Regions (+${otherRegionEvents.length})`}
                </button>
              )}
              
              {totalPages > 1 && (
                <div className="flex items-center gap-2 ml-auto">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-zinc-500 font-medium min-w-[32px] text-center">
                    {currentPage} / {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-md text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="more-events-grid">
              {paginatedEvents.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="more-event-card"
                >
                  <div className="more-event-image overflow-hidden relative group">
                    <img 
                      src={event.image_url || `https://picsum.photos/seed/${event.id || event.name.replace(/\s+/g, '')}/800/450`} 
                      alt={event.name} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                      referrerPolicy="no-referrer"
                    />
                    {event.is_free && (
                      <span className="absolute top-1.5 left-1.5 bg-emerald-400 text-zinc-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10 shadow-sm">
                        FREE
                      </span>
                    )}
                  </div>

                  <div className="p-3 flex flex-col gap-1.5 flex-1">
                    <h5 className="text-xs font-bold text-zinc-700 line-clamp-2 leading-snug">
                      {event.name}
                    </h5>

                    <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                      <Calendar className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">
                        {new Date(event.datetime_start).toLocaleString("en-NZ", {
                          weekday: "short", hour: "numeric", minute: "2-digit", hour12: true,
                        })}
                      </span>
                    </div>

                    {event.location_summary && (
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                        <MapPin className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{event.location_summary}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-auto pt-1">
                      {swappingActive && (
                        <button
                          onClick={() => onSelectEvent(event)}
                          className="use-this-button"
                        >
                          <Plus className="w-3 h-3" /> Use This
                        </button>
                      )}
                      {event.url && (
                        <a
                          href={event.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
                        >
                          Eventfinda <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
