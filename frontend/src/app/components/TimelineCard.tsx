"use client";

import { motion } from "framer-motion";
import { MapPin, Clock, DollarSign, ExternalLink, ArrowLeftRight, Trash2, Plus } from "lucide-react";

export interface Activity {
  title: string;
  time: string;
  cost: string;
  description: string;
  location: string;
  eventId: string | null;
  isEmptyPlaceholder?: boolean;
}

interface TimelineCardProps {
  activity: Activity;
  eventData?: {
    image_url?: string;
    url?: string;
    is_free?: boolean;
  };
  isSwapping: boolean;
  onSwapClick: () => void;
  onRemoveClick: () => void;
}

export default function TimelineCard({ activity, eventData, isSwapping, onSwapClick, onRemoveClick }: TimelineCardProps) {
  // 1. Empty Placeholder State
  if (activity.isEmptyPlaceholder) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={onSwapClick}
        className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer group transition-all duration-300 ${isSwapping ? "border-blue-400 bg-blue-50" : "border-zinc-300 bg-zinc-50/50 hover:bg-blue-50/50 hover:border-blue-300"}`}
      >
        <div className={`p-2 rounded-full transition-colors ${isSwapping ? "bg-blue-100 text-blue-600" : "bg-zinc-100 text-zinc-400 group-hover:bg-blue-100 group-hover:text-blue-500"}`}>
          <Plus className="w-6 h-6" />
        </div>
        <span className={`text-sm font-bold ${isSwapping ? "text-blue-600" : "text-zinc-500 group-hover:text-blue-600"}`}>
          Add an event here
        </span>
      </motion.div>
    );
  }

  // 2. Normal Card State (with faded background image)
  const fallbackSeed = activity.eventId || activity.title.replace(/\s+/g, '');
  const imageUrl = eventData?.image_url || `https://picsum.photos/seed/${fallbackSeed}/800/450`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`relative timeline-card p-4 flex flex-col gap-2 overflow-hidden group ${isSwapping ? "timeline-card-swapping" : ""}`}
    >
      {/* Background Image Layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img 
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover opacity-15 transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        {/* Light gradient overlay to ensure text is readable */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/95 via-white/80 to-white/90" />
      </div>

      {/* Content Layer */}
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <h4 className="font-bold text-zinc-800 text-sm leading-snug">
              {activity.title}
            </h4>
            {eventData?.is_free && (
              <span className="bg-emerald-400 text-zinc-900 text-[9px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm whitespace-nowrap">
                FREE
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onSwapClick}
              className="swap-button bg-blue-50 border-blue-100 text-blue-500 hover:bg-blue-100 hover:text-blue-600"
              title="Swap this activity"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRemoveClick}
              className="swap-button bg-red-50 border-red-100 text-red-400 hover:bg-red-100 hover:text-red-600"
              title="Remove activity"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed mt-1">
          {activity.description}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mt-2">
          {activity.time && (
            <span className="flex items-center gap-1 font-medium">
              <Clock className="w-3 h-3 text-blue-400" />
              {activity.time}
            </span>
          )}
          {activity.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3 text-blue-400" />
              {activity.location}
            </span>
          )}
          {activity.cost && activity.cost !== "Free" && activity.cost !== "$0" && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-blue-400" />
              {activity.cost}
            </span>
          )}
        </div>

        {eventData?.url && (
          <a
            href={eventData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:text-blue-700 transition-colors mt-2 w-fit"
          >
            View on Eventfinda <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </motion.div>
  );
}
