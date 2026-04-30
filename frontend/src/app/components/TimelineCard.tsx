"use client";

import { motion } from "framer-motion";
import { MapPin, Clock, DollarSign, ExternalLink, ArrowLeftRight } from "lucide-react";

export interface Activity {
  title: string;
  time: string;
  cost: string;
  description: string;
  location: string;
  eventId: string | null;
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
}

export default function TimelineCard({ activity, eventData, isSwapping, onSwapClick }: TimelineCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`timeline-card ${isSwapping ? "timeline-card-swapping" : ""}`}
    >
      {/* Image for events with images */}
      {eventData?.image_url && (
        <div className="timeline-card-image">
          <img
            src={eventData.image_url}
            alt={activity.title}
            className="w-full h-full object-cover"
          />
          {eventData.is_free && (
            <span className="absolute top-2 left-2 bg-emerald-400 text-zinc-900 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              FREE
            </span>
          )}
        </div>
      )}

      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-zinc-800 text-sm leading-snug flex-1">
            {activity.title}
          </h4>
          <button
            onClick={onSwapClick}
            className="swap-button"
            title="Swap this activity"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed">
          {activity.description}
        </p>

        <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 mt-1">
          {activity.time && (
            <span className="flex items-center gap-1">
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
