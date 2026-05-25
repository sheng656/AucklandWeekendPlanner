import { SelectedDate } from "../types";

export interface WeekendOptions {
  thisWeekend: SelectedDate[];
  nextWeekend: SelectedDate[];
}

/**
 * Computes the concrete dates and labels for this weekend and next weekend.
 * On Monday-Friday, shows both Saturday and Sunday for this and next weekend.
 * On Saturday, shows "Today (Sat)" and "Tomorrow (Sun)" for this weekend, and Sat/Sun for next weekend.
 * On Sunday, shows "Today (Sun)" for this weekend, and Sat/Sun for next weekend.
 */
export function computeTwoWeekendOptions(reference = new Date()): WeekendOptions {
  // Use Auckland timezone if possible, or fall back to system local
  let localDate: Date;
  try {
    const tzString = reference.toLocaleString("en-US", { timeZone: "Pacific/Auckland" });
    localDate = new Date(tzString);
  } catch (e) {
    localDate = new Date(reference);
  }

  const day = localDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  const getLocalDateOffset = (offset: number): Date => {
    const d = new Date(localDate);
    d.setDate(localDate.getDate() + offset);
    return d;
  };

  const formatIso = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  const formatLabel = (d: Date): string => {
    const weekday = d.toLocaleDateString("en-US", { weekday: "short" }); // "Sat", "Sun"
    const month = d.toLocaleDateString("en-US", { month: "short" }); // "May"
    const dateNum = d.getDate();
    return `${weekday} ${month} ${dateNum}`;
  };

  const thisWeekend: SelectedDate[] = [];
  const nextWeekend: SelectedDate[] = [];

  if (day === 0) {
    // Sunday: Only Sunday today is available for this weekend.
    const sun = getLocalDateOffset(0);
    thisWeekend.push({
      date: formatIso(sun),
      dayName: "Sunday",
      label: `Today (${formatLabel(sun)})`,
    });
  } else if (day === 6) {
    // Saturday: Today (Sat) and Tomorrow (Sun)
    const sat = getLocalDateOffset(0);
    const sun = getLocalDateOffset(1);
    thisWeekend.push({
      date: formatIso(sat),
      dayName: "Saturday",
      label: `Today (${formatLabel(sat)})`,
    });
    thisWeekend.push({
      date: formatIso(sun),
      dayName: "Sunday",
      label: `Tomorrow (${formatLabel(sun)})`,
    });
  } else {
    // Monday to Friday: Coming Sat and Coming Sun
    const daysUntilSat = 6 - day;
    const sat = getLocalDateOffset(daysUntilSat);
    const sun = getLocalDateOffset(daysUntilSat + 1);
    thisWeekend.push({
      date: formatIso(sat),
      dayName: "Saturday",
      label: formatLabel(sat),
    });
    thisWeekend.push({
      date: formatIso(sun),
      dayName: "Sunday",
      label: formatLabel(sun),
    });
  }

  // Next weekend is always Saturday and Sunday after "this Saturday"
  // If today is Sunday, "this Saturday" was yesterday. So next Saturday is in 6 days.
  // If today is Monday-Saturday, next Saturday is 7 days after this Saturday.
  const baseSatOffset = day === 0 ? 6 : (6 - day) + 7;
  const nextSat = getLocalDateOffset(baseSatOffset);
  const nextSun = getLocalDateOffset(baseSatOffset + 1);

  nextWeekend.push({
    date: formatIso(nextSat),
    dayName: "Saturday",
    label: formatLabel(nextSat),
  });
  nextWeekend.push({
    date: formatIso(nextSun),
    dayName: "Sunday",
    label: formatLabel(nextSun),
  });

  return { thisWeekend, nextWeekend };
}
