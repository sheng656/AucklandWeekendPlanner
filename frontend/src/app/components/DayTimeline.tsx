"use client";

import { motion } from "framer-motion";
import TimelineCard, { Activity } from "./TimelineCard";
import { Sun, Coffee, Sunset, Moon, CloudSun } from "lucide-react";
import { weatherEmoji } from "./WeatherWidget";

interface TimeSlot {
  period: string;
  activities: Activity[];
}

interface DayPlan {
  dayName: string;
  date: string;
  timeSlots: TimeSlot[];
  estimatedTotal: string;
}

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

interface DayTimelineProps {
  day: DayPlan;
  dayIndex: number;
  weatherIcon?: string;
  weatherTemp?: string;
  recommendedEvents: EventData[];
  swappingSlot: { dayIdx: number; slotIdx: number; actIdx: number } | null;
  onSwapClick: (dayIdx: number, slotIdx: number, actIdx: number) => void;
  onRemoveClick: (dayIdx: number, slotIdx: number, actIdx: number) => void;
}

const periodIcons: Record<string, React.ReactNode> = {
  "Morning": <Sun className="w-4 h-4 text-amber-400" />,
  "Lunch": <Coffee className="w-4 h-4 text-orange-400" />,
  "Afternoon": <CloudSun className="w-4 h-4 text-sky-400" />,
  "Evening": <Moon className="w-4 h-4 text-indigo-400" />,
};

const periodColors: Record<string, string> = {
  "Morning": "from-amber-400/20 to-orange-400/10",
  "Lunch": "from-orange-400/20 to-red-400/10",
  "Afternoon": "from-sky-400/20 to-blue-400/10",
  "Evening": "from-indigo-400/20 to-purple-400/10",
};

export default function DayTimeline({
  day,
  dayIndex,
  weatherIcon,
  weatherTemp,
  recommendedEvents,
  swappingSlot,
  onSwapClick,
  onRemoveClick,
}: DayTimelineProps) {
  function findEventData(eventId: string | null): EventData | undefined {
    if (!eventId || eventId === "null") return undefined;
    return recommendedEvents.find(e => String(e.id) === String(eventId));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: dayIndex * 0.15 }}
      className="day-timeline"
    >
      {/* Day header */}
      <div className="day-timeline-header">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-zinc-800">
            {day.dayName}
            <span className="text-zinc-400 font-normal ml-2 text-sm">{day.date}</span>
          </h3>
        </div>
        {weatherIcon && (
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">
              {weatherEmoji(weatherIcon)}
            </span>
            <span className="text-sm font-semibold text-zinc-600">{weatherTemp}</span>
          </div>
        )}
      </div>

      {/* Time slots */}
      <div className="day-timeline-body">
        {day.timeSlots.map((slot, slotIdx) => (
          <div key={slotIdx} className="timeline-slot">
            {/* Period label with vertical line */}
            <div className="timeline-period">
              <div className={`timeline-period-badge bg-gradient-to-r ${periodColors[slot.period] || "from-zinc-200/50 to-zinc-100/50"}`}>
                {periodIcons[slot.period] || <Sun className="w-4 h-4 text-zinc-400" />}
                <span className="text-xs font-semibold text-zinc-600">{slot.period}</span>
              </div>
              {slotIdx < day.timeSlots.length - 1 && (
                <div className="timeline-connector" />
              )}
            </div>

            {/* Activity cards */}
            <div className="timeline-activities">
              {slot.activities.map((activity, actIdx) => {
                const eventData = findEventData(activity.eventId);
                const isSwapping = swappingSlot?.dayIdx === dayIndex
                  && swappingSlot?.slotIdx === slotIdx
                  && swappingSlot?.actIdx === actIdx;

                return (
                  <TimelineCard
                    key={actIdx}
                    activity={activity}
                    eventData={eventData}
                    isSwapping={isSwapping}
                    onSwapClick={() => onSwapClick(dayIndex, slotIdx, actIdx)}
                    onRemoveClick={() => onRemoveClick(dayIndex, slotIdx, actIdx)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Daily total */}
      {day.estimatedTotal && (
        <div className="day-timeline-footer">
          <span className="text-sm font-semibold text-zinc-500">Estimated Total</span>
          <span className="text-sm font-bold text-blue-600">{day.estimatedTotal}</span>
        </div>
      )}
    </motion.div>
  );
}
