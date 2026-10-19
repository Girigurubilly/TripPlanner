import { dayDates, type TripBook, type TripDay } from "./trip.ts";

export const MONEY_URL = "https://girigurubilly.github.io/MoneyTracker/";
const LINK_KEY = "tripbook-money-links";
const REF_KEY = "tripbook-money-ref";

export type MoneyTripRef = {
  id: string;
  name: string;
  dest: string;
  start: string;
  end: string;
  book: string;
  pick: boolean;
  day: string;
};

export type SpendItem = {
  date: string;
  label: string;
  amount: number;
  currency: string;
};

export function readMoneyRef(search: string): MoneyTripRef | null {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const id = (q.get("money") || "").trim();
  if (!id) return null;
  return {
    id: id.slice(0, 80),
    name: (q.get("name") || "").slice(0, 80),
    dest: (q.get("dest") || "").slice(0, 80),
    start: (q.get("start") || "").slice(0, 10),
    end: (q.get("end") || "").slice(0, 10),
    book: (q.get("book") || "").slice(0, 80),
    pick: q.get("pick") === "1",
    day: /^\d{4}-\d{2}-\d{2}$/.test(q.get("day") || "") ? q.get("day") || "" : "",
  };
}

export function loadMoneyLinks(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LINK_KEY) || "{}") as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function saveMoneyLink(moneyId: string, bookId: string): void {
  const links = loadMoneyLinks();
  links[moneyId] = bookId;
  localStorage.setItem(LINK_KEY, JSON.stringify(links));
}

export function rememberMoneyRef(ref: MoneyTripRef): void {
  localStorage.setItem(REF_KEY, JSON.stringify(ref));
}

export function moneyLinkBackUrl(ref: MoneyTripRef, bookId: string, title: string): string {
  const json = JSON.stringify({ v: 1, tripId: ref.id.slice(0, 80), bookId: bookId.slice(0, 80), title: title.slice(0, 80) });
  return `${MONEY_URL}#link=${encodeToken(json)}`;
}

function encodeToken(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function moneyTripIdForBook(bookId: string): string {
  const links = loadMoneyLinks();
  return Object.entries(links).find(([, book]) => book === bookId)?.[0] || "";
}

function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function rankTripBooks(
  trips: TripBook[],
  ref: MoneyTripRef,
  links: Record<string, string>,
): { best: TripBook | null; options: TripBook[] } {
  const linkedId = ref.book || links[ref.id] || "";
  if (linkedId) {
    const hit = trips.find((trip) => trip.id === linkedId);
    if (hit) return { best: hit, options: [hit] };
  }
  const words = `${ref.name} ${ref.dest}`
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2);
  const scored = trips
    .map((trip) => {
      const dates = dayDates(trip).filter((date): date is Date => date instanceof Date);
      let score = 0;
      if (dates.length && ref.start && ref.end) {
        const first = isoDate(dates[0]);
        const last = isoDate(dates[dates.length - 1]);
        if (first <= ref.end && last >= ref.start) score += 5;
        if (first === ref.start || last === ref.end) score += 3;
      }
      const text = `${trip.title} ${trip.subtitle} ${trip.days.map((day) => `${day.city} ${day.label} ${day.title}`).join(" ")}`.toLowerCase();
      for (const word of words) if (text.includes(word)) score += 2;
      return { trip, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.trip.title.localeCompare(b.trip.title));
  if (!scored.length) return { best: null, options: trips };
  if (scored.length === 1 || scored[0].score >= scored[1].score + 2) return { best: scored[0].trip, options: scored.map((row) => row.trip) };
  return { best: null, options: scored.map((row) => row.trip) };
}

export function parsePrice(raw: string): { amount: number; currency: string } | null {
  const text = raw.trim();
  if (!text || /免費|免费|free/i.test(text)) return null;
  const currency = /HK\$|hkd|港幣|港币/i.test(text)
    ? "HKD"
    : /€|eur|歐元|欧元/i.test(text)
      ? "EUR"
      : /£|gbp|英鎊|英镑/i.test(text)
        ? "GBP"
        : /nt\$|twd|台幣|新台/i.test(text)
          ? "TWD"
          : /usd|us\$|美元/i.test(text)
            ? "USD"
            : /jpy|日圓|日元|¥|￥/i.test(text)
              ? "JPY"
              : /cny|rmb|人民幣|人民币/i.test(text)
                ? "CNY"
                : "HKD";
  const num = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!num) return null;
  const amount = Number(num[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, currency };
}

export function dayIdForDate(trip: TripBook, iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const dates = dayDates(trip);
  const index = dates.findIndex((date) => date instanceof Date && isoDate(date) === iso);
  return index >= 0 ? trip.days[index]?.id || "" : "";
}

export function spendItem(trip: TripBook, day: TripDay, label: string, price: string, blank = false): SpendItem | null {
  const index = trip.days.findIndex((item) => item.id === day.id);
  const date = dayDates(trip)[index];
  if (!(date instanceof Date)) return null;
  const name = label.trim().slice(0, 80);
  if (!name) return null;
  const parsed = parsePrice(price);
  if (!parsed) {
    if (!blank) return null;
    return { date: isoDate(date), label: name, amount: 0, currency: "HKD" };
  }
  return { date: isoDate(date), label: name, amount: parsed.amount, currency: parsed.currency };
}

export function spendOnDay(trip: TripBook, day: TripDay): SpendItem[] {
  const index = trip.days.findIndex((item) => item.id === day.id);
  const date = dayDates(trip)[index];
  if (!(date instanceof Date)) return [];
  const iso = isoDate(date);
  const items: SpendItem[] = [];
  const seen = new Set<string>();
  const push = (label: string, price: string) => {
    const parsed = parsePrice(price);
    if (!parsed) return;
    const name = label.trim().slice(0, 80);
    if (!name) return;
    const key = `${name}|${parsed.amount}|${parsed.currency}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ date: iso, label: name, amount: parsed.amount, currency: parsed.currency });
  };
  for (const spot of day.spots) push(spot.name, spot.price);
  for (const meal of day.meals) push(meal.name, meal.price);
  for (const ride of day.rides) push(ride.detail || `${ride.from} → ${ride.to}`, ride.price);
  return items.slice(0, 20);
}

export function encodeProposal(body: { trip: string; tripId: string; bookId?: string; items: SpendItem[] }): string {
  const json = JSON.stringify({
    v: 1,
    trip: body.trip.slice(0, 80),
    tripId: body.tripId.slice(0, 80),
    bookId: (body.bookId || "").slice(0, 80),
    items: body.items.slice(0, 20),
  });
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function moneySpendUrl(body: { trip: string; tripId: string; bookId?: string; items: SpendItem[] }): string {
  return `${MONEY_URL}#proposal=${encodeProposal(body)}`;
}
