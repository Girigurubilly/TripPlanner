export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function formatTime(h: number, m: number) {
  return `${pad2(h)}:${pad2(m)}`;
}

export function timeSlots(stepMin = 15): string[] {
  const out: string[] = [];
  for (let min = 0; min < 24 * 60; min += stepMin) {
    out.push(formatTime(Math.floor(min / 60), min % 60));
  }
  return out;
}

export const TIME_SLOTS = timeSlots(15);

export function parseTimeInput(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;
  const meridiem = s.match(/([ap])\.?m?\.?$/);
  const core = meridiem ? s.slice(0, meridiem.index) : s;
  let hours: number;
  let minutes: number;
  if (/^\d{1,2}:\d{1,2}$/.test(core)) {
    const [h, m] = core.split(":");
    hours = Number(h);
    minutes = Number(m);
  } else if (/^\d{3,4}$/.test(core)) {
    const padded = core.padStart(4, "0");
    hours = Number(padded.slice(0, 2));
    minutes = Number(padded.slice(2));
  } else if (/^\d{1,2}$/.test(core)) {
    hours = Number(core);
    minutes = 0;
  } else {
    return null;
  }
  if (meridiem) {
    const pm = meridiem[1] === "p";
    if (pm && hours < 12) hours += 12;
    if (!pm && hours === 12) hours = 0;
  }
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return formatTime(hours, minutes);
}

export function splitDateTime(value: string): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  return { date: match?.[1] ?? "", time: match?.[2] ?? "" };
}

export function joinDateTime(date: string, time: string) {
  if (!date && !time) return "";
  if (!date) return time;
  return time ? `${date}T${time}` : date;
}
