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
      className={`relative timeline-card flex flex-col overflow-hidden group ${isSwapping ? "timeline-card-swapping" : ""}`}
    >
      {/* Top Cover Image Layer */}
      <div className="h-32 w-full relative overflow-hidden shrink-0 bg-zinc-100">
        <img 
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        {/* Dark gradient from bottom to make text/tags pop if needed */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        
        {eventData?.is_free && (
          <span className="absolute top-2 left-2 bg-emerald-400 text-zinc-900 text-[10px] font-bold px-2 py-0.5 rounded-sm shadow-sm z-10">
            FREE
          </span>
        )}
      </div>

      {/* Content Layer */}
      <div className="p-4 flex flex-col gap-2 relative z-10 bg-white/90">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-zinc-800 text-sm leading-snug flex-1">
            {activity.title}
          </h4>
          
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

        <p className="text-xs text-zinc-600 leading-relaxed mt-1 line-clamp-2">
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
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-500 hover:text-blue-700 transition-colors mt-1 w-fit"
          >
            View on Eventfinda <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </motion.div>
  );
}
