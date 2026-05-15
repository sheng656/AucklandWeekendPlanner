"use client";

import { CalendarPlus, Share2, Check, Copy } from "lucide-react";
import { useState } from "react";

import type { DayPlan } from "../../types";

interface ExportActionsProps {
  plan: DayPlan[];
}

export function buildDateFromParts(dateStr: string, timeStr: string): Date {
  // More robust parsing for inputs like "May 3", "3 May", "Mar 14", or keywords like "tomorrow"
  const now = new Date();
  const year = now.getFullYear();

  // Normalize whitespace
  const s = (dateStr || "").trim();

  // Month name map
  const months: Record<string, number> = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11
  };

  let baseDate: Date | null = null;

  // 1) Keywords
  if (/^tomorrow$/i.test(s)) {
    baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  } else if (/^today$/i.test(s)) {
    baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else {
    // 2) Try patterns like "May 3" or "3 May"
    const m1 = s.match(/([A-Za-z]+)\s+(\d{1,2})/);
    const m2 = s.match(/(\d{1,2})\s+([A-Za-z]+)/);
    if (m1) {
      const mon = m1[1].toLowerCase();
      const dayNum = parseInt(m1[2], 10);
      if (months.hasOwnProperty(mon) && dayNum >= 1 && dayNum <= 31) {
        baseDate = new Date(year, months[mon], dayNum);
      }
    } else if (m2) {
      const dayNum = parseInt(m2[1], 10);
      const mon = m2[2].toLowerCase();
      if (months.hasOwnProperty(mon) && dayNum >= 1 && dayNum <= 31) {
        baseDate = new Date(year, months[mon], dayNum);
      }
    }
  }

  // 3) Fallback to loose Date parsing if still null
  if (!baseDate) {
    const parsed = new Date(`${s} ${year}`);
    if (!isNaN(parsed.getTime())) baseDate = parsed;
  }

  // 4) Final fallback: next Saturday
  if (!baseDate || isNaN(baseDate.getTime())) {
    const today = new Date();
    const daysToSat = (6 - today.getDay() + 7) % 7;
    baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToSat);
  }

  // Parse time like "9:00 AM" or "2:30 PM" and set hours
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3].toUpperCase();
    if (ampm === "PM" && hours !== 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    baseDate.setHours(hours, minutes, 0, 0);
  }

  return baseDate;
}

function formatDateToICS(date: Date): string {
  // Format as ICS date in UTC: YYYYMMDDTHHMMSSZ
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeICS(str: string): string {
  if (!str) return "";

  let plainText = str;

  // 1) In browser, parse as HTML to strip tags and decode entities
  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(str, "text/html");
      plainText = doc.body.textContent || "";
    } catch (e) {
      // fallback to regex stripping
      plainText = str.replace(/<\/?[^>]+(>|$)/g, "");
    }
  } else {
    // SSR or no DOMParser available: simple regex strip
    plainText = str.replace(/<\/?[^>]+(>|$)/g, "");
  }

  // 2) Normalize CRLF and lone CR to LF
  plainText = plainText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 3) Escape ICS reserved characters (\, ;, ,, and newlines)
  return plainText.replace(/[\\;,\n]/g, (match) => {
    if (match === "\n") return "\\n";
    return "\\" + match;
  });
}

function foldICSLine(line: string): string {
  // Fold long lines to <=75 bytes using UTF-8 byte length, inserting CRLF + space
  const encoder = new TextEncoder();
  let res = "";
  let i = 0;
  while (i < line.length) {
    let j = i;
    let bytes = 0;
    while (j < line.length) {
      const ch = line[j];
      const b = encoder.encode(ch).length;
      if (bytes + b > 75) break;
      bytes += b;
      j++;
    }
    // Append slice
    res += line.slice(i, j);
    i = j;
    if (i < line.length) res += "\r\n ";
  }
  return res;
}

export function generateICS(plan: DayPlan[]): string {
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
        // Skip placeholder/empty slots (user-removed items)
        if ((activity as any).isEmptyPlaceholder) continue;
        // Parse time range "9:00 AM – 11:00 AM"
        const timeParts = activity.time.split(/\s*[–—-]\s*/);
        const startTime = timeParts[0]?.trim() || "9:00 AM";
        const endTime = timeParts[1]?.trim() || "10:00 AM";

        const startDate = buildDateFromParts(day.date, startTime);
        let endDate = buildDateFromParts(day.date, endTime);
        // If end is not after start, set end to start + 2 hours
        if (endDate.getTime() <= startDate.getTime()) {
          endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
        }
        const dtStart = formatDateToICS(startDate);
        const dtEnd = formatDateToICS(endDate);
        const dtStamp = (() => {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, "0");
          return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
        })();

        const uid = activity.eventId
          ? `${activity.eventId}@aucklandplanner`
          : `${dtStart}-${Math.random().toString(36).slice(2, 8)}@aucklandplanner`;

        const veventLines = [
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${dtStamp}`,
          `DTSTART:${dtStart}`,
          `DTEND:${dtEnd}`,
          `SUMMARY:${escapeICS(activity.title || "")}`,
          `LOCATION:${escapeICS(activity.location || "")}`,
          `DESCRIPTION:${escapeICS((activity.description || "") + (activity.cost ? " (Cost: " + activity.cost + ")" : ""))}`,
          "END:VEVENT",
        ];

        for (const line of veventLines) {
          ics += foldICSLine(line) + "\r\n";
        }
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
        if ((act as any).isEmptyPlaceholder) continue;
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
