"use client";

import { CalendarPlus, Share2, Check, Copy } from "lucide-react";
import { useState } from "react";

interface DayPlan {
  dayName: string;
  date: string;
  timeSlots: {
    period: string;
    activities: {
      title: string;
      time: string;
      cost: string;
      description: string;
      location: string;
      eventId: string | null;
    }[];
  }[];
  estimatedTotal: string;
}

interface ExportActionsProps {
  plan: DayPlan[];
}

function formatICSDate(dateStr: string, timeStr: string): string {
  // Parse date like "May 3" + time like "9:00 AM"
  const now = new Date();
  const year = now.getFullYear();
  
  // Try to parse the date
  const fullDateStr = `${dateStr} ${year}`;
  const baseDate = new Date(fullDateStr);
  
  if (isNaN(baseDate.getTime())) {
    // Fallback: use next weekend
    const today = new Date();
    const daysToSat = (6 - today.getDay() + 7) % 7;
    baseDate.setTime(today.getTime() + daysToSat * 86400000);
  }
  
  // Parse time like "9:00 AM" or "2:30 PM"
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toUpperCase();
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    baseDate.setHours(hours, minutes, 0, 0);
  }
  
  // Format as ICS date: YYYYMMDDTHHMMSS (local time)
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${baseDate.getFullYear()}${pad(baseDate.getMonth() + 1)}${pad(baseDate.getDate())}T${pad(baseDate.getHours())}${pad(baseDate.getMinutes())}00`;
}

function escapeICS(str: string): string {
  return str.replace(/[\\;,\n]/g, (match) => {
    if (match === "\n") return "\\n";
    return "\\" + match;
  });
}

function generateICS(plan: DayPlan[]): string {
  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AucklandWeekendPlanner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ].join("\r\n") + "\r\n";

  for (const day of plan) {
    for (const slot of day.timeSlots) {
      for (const activity of slot.activities) {
        // Parse time range "9:00 AM – 11:00 AM"
        const timeParts = activity.time.split(/\s*[–—-]\s*/);
        const startTime = timeParts[0]?.trim() || "9:00 AM";
        const endTime = timeParts[1]?.trim() || "10:00 AM";

        const dtStart = formatICSDate(day.date, startTime);
        const dtEnd = formatICSDate(day.date, endTime);

        ics += [
          "BEGIN:VEVENT",
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${escapeICS(activity.title)}`,
          `LOCATION:${escapeICS(activity.location)}`,
          `DESCRIPTION:${escapeICS(activity.description)}${activity.cost ? " (Cost: " + activity.cost + ")" : ""}`,
          `UID:${dtStart}-${Math.random().toString(36).slice(2, 8)}@aucklandplanner`,
          "END:VEVENT",
        ].join("\r\n") + "\r\n";
      }
    }
  }

  ics += "END:VCALENDAR\r\n";
  return ics;
}

function generateShareText(plan: DayPlan[]): string {
  let text = "🗓️ My Auckland Weekend Plan\n\n";
  for (const day of plan) {
    text += `📅 ${day.dayName}, ${day.date}\n`;
    for (const slot of day.timeSlots) {
      for (const act of slot.activities) {
        text += `  • ${act.title} (${act.time}) — ${act.location}\n`;
      }
    }
    if (day.estimatedTotal) {
      text += `  💰 ${day.estimatedTotal}\n`;
    }
    text += "\n";
  }
  text += "Made with Auckland Weekend Planner ✨";
  return text;
}

export default function ExportActions({ plan }: ExportActionsProps) {
  const [copied, setCopied] = useState(false);
  const [calendarDone, setCalendarDone] = useState(false);

  const handleExportCalendar = () => {
    const ics = generateICS(plan);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "auckland-weekend-plan.ics");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setCalendarDone(true);
    setTimeout(() => setCalendarDone(false), 2000);
  };

  const handleShare = async () => {
    const shareText = generateShareText(plan);

    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Auckland Weekend Plan",
          text: shareText,
        });
        return;
      } catch {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API failed
      console.error("Failed to copy to clipboard");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={handleExportCalendar} className="export-button">
        {calendarDone ? (
          <Check className="w-4 h-4 text-emerald-500" />
        ) : (
          <CalendarPlus className="w-4 h-4 text-blue-500" />
        )}
        <span>{calendarDone ? "Downloaded!" : "Add to Calendar"}</span>
      </button>

      <button onClick={handleShare} className="export-button">
        {copied ? (
          <Check className="w-4 h-4 text-emerald-500" />
        ) : (
          <Share2 className="w-4 h-4 text-blue-500" />
        )}
        <span>{copied ? "Copied!" : "Share"}</span>
      </button>
    </div>
  );
}
