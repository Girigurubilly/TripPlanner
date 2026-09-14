import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  eachDayOfInterval,
  format,
  parseISO,
} from "date-fns";
import type { OpeningHours, TravelPace, Weekday } from "@/types/trip";
import { WEEKDAYS } from "@/types/trip";

export function tripDates(startDate: string, endDate: string): string[] {
  return eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  }).map((d) => format(d, "yyyy-MM-dd"));
}

export function formatDayHeading(isoDate: string): string {
  return format(parseISO(isoDate), "EEE d MMM");
}

export function formatDayLong(isoDate: string): string {
  return format(parseISO(isoDate), "EEEE d MMMM");
}

export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function addMinutesToTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function weekdayOf(isoDate: string): Weekday {
  return WEEKDAYS[parseISO(isoDate).getDay()];
}

export function isOpenOn(
  hours: OpeningHours | undefined,
  isoDate: string,
  timeHHMM?: string,
): "open" | "closed" | "unknown" {
  if (!hours) return "unknown";
  const day = weekdayOf(isoDate);
  if (!(day in hours.days)) return "unknown";
  const slot = hours.days[day];
  if (slot === null) return "closed";
  if (!slot) return "unknown";
  if (!timeHHMM) return "open";
  const t = minutesBetween("00:00", timeHHMM);
  const a = minutesBetween("00:00", slot.open);
  const b = minutesBetween("00:00", slot.close);
  if (b <= a) return t >= a || t <= b ? "open" : "closed";
  return t >= a && t < b ? "open" : "closed";
}

export function countdownParts(startDate: string, timezone: string, now = new Date()) {
  const start = zonedMidnight(startDate, timezone);
  const totalMin = differenceInMinutes(start, now);
  const days = differenceInCalendarDays(start, now);
  if (totalMin <= 0) {
    return { days: 0, hours: 0, minutes: 0, started: true, past: start < now };
  }
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  const minutes = totalMin % 60;
  return { days: Math.max(0, days), hours, minutes, started: false, past: false };
}

function zonedMidnight(isoDate: string, timeZone: string): Date {
  try {
    const asLocal = `${isoDate}T00:00:00`;
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const nowGuess = new Date(`${isoDate}T00:00:00+09:00`);
    void fmt.format(nowGuess);
    return new Date(asLocal);
  } catch {
    return parseISO(`${isoDate}T00:00:00`);
  }
}

export function loadThresholds(pace: TravelPace): { busy: number; overloaded: number } {
  if (pace === "relaxed") return { busy: 300, overloaded: 420 };
  if (pace === "packed") return { busy: 480, overloaded: 600 };
  return { busy: 390, overloaded: 510 };
}

export function nextDate(isoDate: string): string {
  return format(addDays(parseISO(isoDate), 1), "yyyy-MM-dd");
}

export function todayInZone(timeZone: string, now = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    return `${y}-${m}-${d}`;
  } catch {
    return format(now, "yyyy-MM-dd");
  }
}
