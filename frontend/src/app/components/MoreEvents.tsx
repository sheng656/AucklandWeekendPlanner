"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, ChevronDown, Plus, Calendar, MapPin, ExternalLink } from "lucide-react";

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
}

interface MoreEventsProps {
  events: EventData[];
  isOpen: boolean;
  onToggle: () => void;
  swappingActive: boolean;
  onSelectEvent: (event: EventData) => void;
}

export default function MoreEvents({
  events,
  isOpen,
  onToggle,
  swappingActive,
  onSelectEvent,
}: MoreEventsProps) {
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
            ({events.length} available)
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

            <div className="more-events-grid">
              {events.map((event, idx) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="more-event-card"
                >
                  {event.image_url ? (
                    <div className="more-event-image">
                      <img src={event.image_url} alt={event.name} className="w-full h-full object-cover" />
                      {event.is_free && (
                        <span className="absolute top-1.5 left-1.5 bg-emerald-400 text-zinc-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          FREE
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="more-event-image bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-blue-300" />
                      {event.is_free && (
                        <span className="absolute top-1.5 left-1.5 bg-emerald-400 text-zinc-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          FREE
                        </span>
                      )}
                    </div>
                  )}

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
