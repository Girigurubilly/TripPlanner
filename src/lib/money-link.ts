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

export type SpendCategory = "sight" | "meal" | "ride" | "hotel" | "other";

export type SpendItem = {
  date: string;
  label: string;
  amount: number;
  currency: string;
  /** Hint for MoneyTracker proposal sheet — not a Money category id. */
  category?: SpendCategory;
  /** Optional HH:mm for the meal/event — Money should not use wall-clock now. */
  time?: string;
  /** Stable item key (bookId:dayId:entryId, or bookId:dayId:kind:label). Money stores it to skip duplicates. */
  key?: string;
  /** No clear currency marker — Money flags the row so the user checks the currency. */
  currencyGuess?: true;
};

/**
 * Contract with MoneyTracker (same origin, girigurubilly.github.io → shared localStorage):
 * - Each proposal item carries `key` (see spendItemKey).
 * - MoneyTracker saves the key on the ledger rows it creates and rewrites
 *   localStorage["money-trip-logged"] = { v: 1, keys: string[], at } from its ledger.
 *   TripPlanner only reads it (✓ 已記) and listens for `storage` events.
 * - TripPlanner keeps its own "sent but not confirmed yet" set in SENT_KEY (best-effort hint only).
 * - Windows: TripPlanner names itself "trip-planner"; MoneyTracker names itself "money-tracker".
 *   Links between the two use those names as targets so each app reuses its own tab.
 * Note: an iPhone Home Screen app has storage separate from Safari, so ✓ only shows where both share storage.
 */
export const LOGGED_KEY = "money-trip-logged";
const SENT_KEY = "tripbook-money-sent";
export const MONEY_WINDOW = "money-tracker";

/** True when this page runs as an iPhone/Android Home Screen app (no tabs to switch to). */
function standaloneApp(): boolean {
  try {
    return (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
  } catch {
    return false;
  }
}

/**
 * Open MoneyTracker at `url` (a #proposal= / #estimate= link) and bring it to the front.
 * - Normal browser: reuse/open the "money-tracker" tab via window.open and focus it.
 *   Plain `<a target>` alone can update a background tab without switching to it (looks like nothing happened).
 * - Pop-up blocked, window.open unavailable, or a Home Screen app: go there in this tab instead,
 *   so Money always opens with the hash.
 * Returns how it went so callers can report it.
 */
export function openMoney(url: string): "tab" | "here" {
  if (typeof window === "undefined") return "here";
  if (!standaloneApp()) {
    let win: Window | null = null;
    try {
      win = window.open(url, MONEY_WINDOW);
    } catch {
      win = null;
    }
    if (win) {
      try {
        win.focus();
      } catch {
        /* ignore */
      }
      return "tab";
    }
  }
  window.location.assign(url);
  return "here";
}

/** Let ⌘/Ctrl/Shift/middle clicks keep the browser's own link handling. */
export function plainClick(event: { button?: number; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }): boolean {
  return (event.button ?? 0) === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function slugPart(value: string): string {
  return value.trim().replace(/\s+/g, "-").replace(/:/g, "-").slice(0, 60);
}

export function spendItemKey(bookId: string, dayId: string, kind: string, ref: string, label: string): string {
  const tail = ref ? slugPart(ref) : `${kind || "other"}:${slugPart(label)}`;
  return `${slugPart(bookId)}:${slugPart(dayId)}:${tail}`.slice(0, 160);
}

export function loadLoggedKeys(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOGGED_KEY) || "{}") as { keys?: unknown };
    return new Set(Array.isArray(parsed.keys) ? parsed.keys.filter((key): key is string => typeof key === "string") : []);
  } catch {
    return new Set();
  }
}

export function loadSentKeys(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(SENT_KEY) || "[]") as unknown;
    return new Set(Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : []);
  } catch {
    return new Set();
  }
}

export function markSent(key: string): void {
  if (!key) return;
  try {
    const keys = [...loadSentKeys(), key].slice(-300);
    localStorage.setItem(SENT_KEY, JSON.stringify([...new Set(keys)]));
  } catch {
    /* ignore */
  }
}

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
  return Object.entries(links).find(([, book]) => book === bookId)?.[0] || bookId;
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

/** Currencies MoneyTracker understands (keep in step with its CURRENCIES list). */
export const MONEY_CURRENCIES = ["HKD", "USD", "JPY", "CNY", "TWD", "THB", "GBP", "EUR", "AUD", "SGD", "CHF", "MOP", "KRW", "CAD", "NZD", "INR"] as const;

const DOLLARS = new Set(["HKD", "USD", "TWD", "SGD", "AUD", "CAD", "NZD", "MOP"]);

/** Explicit markers, most specific first (HK$ before $, 澳門幣 before 澳幣 …). */
const CURRENCY_MARKS: [string, RegExp][] = [
  ["HKD", /HK\$|(?<![a-z])hkd(?![a-z])|港幣|港币|港元/i],
  ["MOP", /(?<![a-z])mop(?![a-z])|澳門幣|澳门币|澳門元|澳门元|葡幣|pataca/i],
  ["TWD", /NT\$|(?<![a-z])twd(?![a-z])|台幣|臺幣|新台|新臺/i],
  ["SGD", /(?<![a-z])S\$|(?<![a-z])sgd(?![a-z])|新加坡元|新加坡幣|新幣|坡幣/i],
  ["AUD", /(?<![a-z])A\$|(?<![a-z])aud(?![a-z])|澳元|澳幣|澳币/i],
  ["NZD", /NZ\$|(?<![a-z])nzd(?![a-z])|紐元|紐幣|纽币/i],
  ["CAD", /(?<![a-z])C\$|(?<![a-z])cad(?![a-z])|加元|加幣|加币/i],
  ["USD", /US\$|(?<![a-z])usd(?![a-z])|美元|美金/i],
  ["KRW", /₩|(?<![a-z])krw(?![a-z])|韓圓|韓元|韩元|韓幣|(?<![a-z])won(?![a-z])|원/i],
  ["THB", /฿|(?<![a-z])thb(?![a-z])|泰銖|泰铢|泰幣|(?<![a-z])baht(?![a-z])/i],
  ["CHF", /(?<![a-z])chf(?![a-z])|瑞士法郎|瑞郎|(?<![a-z])s?fr\./i],
  ["EUR", /€|(?<![a-z])eur(?:o|os)?(?![a-z])|歐元|欧元/i],
  ["GBP", /£|(?<![a-z])gbp(?![a-z])|英鎊|英镑/i],
  ["INR", /₹|(?<![a-z])inr(?![a-z])|盧比|卢比|(?<![a-z])rs\.?(?=\s*\d)/i],
  ["JPY", /(?<![a-z])jpy(?![a-z])|日圓|日元|日幣|日币|円|(?<![a-z])yen(?![a-z])/i],
  ["CNY", /(?<![a-z])(?:cny|rmb)(?![a-z])|人民幣|人民币/i],
];

/** City → local currency, used when a price has no currency symbol. Generic, not tied to one trip. */
const CITY_CURRENCY: [string, RegExp][] = [
  ["JPY", /japan|tokyo|osaka|kyoto|nara|kobe|sapporo|hokkaido|fukuoka|okinawa|naha|nagoya|hiroshima|yokohama|kanazawa|hakone|nikko|日本|東京|大阪|京都|奈良|神戶|札幌|北海道|福岡|沖繩|名古屋|廣島|橫濱|金澤|箱根|日光/i],
  ["KRW", /korea|seoul|busan|jeju|incheon|韓國|首爾|釜山|濟州|仁川/i],
  ["TWD", /taiwan|taipei|taichung|tainan|kaohsiung|hualien|台灣|臺灣|台北|臺北|台中|台南|高雄|花蓮/i],
  ["THB", /thailand|bangkok|chiang ?mai|phuket|pattaya|krabi|泰國|曼谷|清邁|布吉|芭堤雅|喀比/i],
  ["SGD", /singapore|新加坡/i],
  ["MOP", /macau|macao|澳門/i],
  ["HKD", /hong ?kong|香港/i],
  ["CNY", /china|shanghai|beijing|shenzhen|guangzhou|chengdu|hangzhou|xi'?an|中國|上海|北京|深圳|廣州|成都|杭州|西安/i],
  ["CHF", /switzerland|zurich|z[üu]rich|geneva|lucerne|luzern|zermatt|interlaken|bern|瑞士|蘇黎世|日內瓦|琉森|策馬特|因特拉肯|伯爾尼/i],
  ["GBP", /\buk\b|england|scotland|london|edinburgh|manchester|英國|倫敦|愛丁堡|曼徹斯特/i],
  ["AUD", /australia|sydney|melbourne|brisbane|perth|澳洲|悉尼|墨爾本|布里斯班|珀斯/i],
  ["NZD", /new zealand|auckland|queenstown|christchurch|紐西蘭|奧克蘭|皇后鎮/i],
  ["CAD", /canada|toronto|vancouver|montreal|加拿大|多倫多|溫哥華|蒙特利爾/i],
  ["USD", /\busa\b|new york|los angeles|san francisco|hawaii|honolulu|las vegas|美國|紐約|洛杉磯|三藩市|夏威夷|拉斯維加斯/i],
  ["INR", /india|delhi|mumbai|印度|德里|孟買/i],
  ["EUR", /italy|milan|milano|florence|firenze|rome|roma|venice|venezia|naples|spain|madrid|barcelona|seville|sevilla|granada|portugal|lisbon|lisboa|porto|france|paris|nice|lyon|germany|berlin|munich|vienna|austria|amsterdam|netherlands|brussels|belgium|athens|greece|dublin|helsinki|意大利|米蘭|佛羅倫斯|羅馬|威尼斯|拿坡里|西班牙|馬德里|巴塞隆拿|塞維亞|格拉納達|葡萄牙|里斯本|波爾圖|法國|巴黎|尼斯|里昂|德國|柏林|慕尼黑|維也納|奧地利|阿姆斯特丹|荷蘭|布魯塞爾|比利時|雅典|希臘|都柏林|赫爾辛基/i],
];

export function currencyForPlace(text: string): string {
  const blob = text.trim();
  if (!blob) return "";
  for (const [code, re] of CITY_CURRENCY) if (re.test(blob)) return code;
  return "";
}

function explicitCurrency(text: string): string {
  for (const [code, re] of CURRENCY_MARKS) if (re.test(text)) return code;
  return "";
}

const tripCurrencyCache = new WeakMap<TripBook, string>();

/** The trip's local currency: majority of its cities, else majority of explicitly marked prices. "" when unknown. */
export function tripCurrency(trip: TripBook): string {
  const hit = tripCurrencyCache.get(trip);
  if (hit !== undefined) return hit;
  const vote = (values: string[]) => {
    const counts = new Map<string, number>();
    for (const value of values) if (value) counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  };
  let code = vote(trip.days.map((day) => currencyForPlace(day.city)));
  if (!code) {
    const prices = trip.days.flatMap((day) => [...day.spots, ...day.meals, ...day.hotels, ...day.rides].map((row) => row.price || ""));
    code = vote(prices.map(explicitCurrency).filter((value) => value !== "HKD"));
  }
  if (!code) code = currencyForPlace(`${trip.title} ${trip.subtitle}`);
  tripCurrencyCache.set(trip, code);
  return code;
}

/**
 * Parse a free-text price. `fallback` is the trip's local currency (see tripCurrency).
 * `guess: true` means no unambiguous currency marker was found, so Money should ask the user to check it.
 */
export function parsePrice(raw: string, fallback = ""): { amount: number; currency: string; guess?: true } | null {
  const text = raw.trim();
  if (!text || /免費|免费|(?<![a-z])free(?![a-z])/i.test(text)) return null;
  const num = text.replace(/(\d),(?=\d{3})/g, "$1").match(/(\d+(?:\.\d+)?)/);
  if (!num) return null;
  const amount = Number(num[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const local = (MONEY_CURRENCIES as readonly string[]).includes(fallback) ? fallback : "";
  const marked = explicitCurrency(text);
  if (marked) return { amount, currency: marked };
  if (/[¥￥]/.test(text)) {
    // ¥ is both yen and yuan: trust the trip's own currency when it is one of the two.
    if (local === "CNY" || local === "JPY") return { amount, currency: local };
    return { amount, currency: "JPY", guess: true };
  }
  if (/\$/.test(text)) {
    if (local && DOLLARS.has(local)) return { amount, currency: local };
    return { amount, currency: "USD", guess: true };
  }
  if (/元|圓/.test(text) && (local === "CNY" || local === "TWD" || local === "HKD" || local === "MOP")) return { amount, currency: local };
  return { amount, currency: local || "HKD", guess: true };
}

export function dayIdForDate(trip: TripBook, iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const dates = dayDates(trip);
  const index = dates.findIndex((date) => date instanceof Date && isoDate(date) === iso);
  return index >= 0 ? trip.days[index]?.id || "" : "";
}


/** Prefer hours start (e.g. 11:00-18:00); else map common meal slots to a clock time. */
export function spendTimeHint(slot = "", hours = ""): string {
  const fromHours = hours.match(/(\d{1,2})[:：](\d{2})/);
  if (fromHours) return `${fromHours[1].padStart(2, "0")}:${fromHours[2]}`;
  const blob = slot.trim();
  const map: [string, string][] = [
    ["早午餐", "10:30"],
    ["早餐", "08:30"],
    ["午餐", "12:30"],
    ["下午茶", "15:00"],
    ["輕晚餐", "18:30"],
    ["晚餐", "19:00"],
    ["宵夜", "22:00"],
  ];
  for (const [key, time] of map) if (blob.includes(key)) return time;
  return "";
}

export function spendItem(
  trip: TripBook,
  day: TripDay,
  label: string,
  price: string,
  blank = false,
  category?: SpendCategory,
  time = "",
  ref = "",
): SpendItem | null {
  const index = trip.days.findIndex((item) => item.id === day.id);
  const date = dayDates(trip)[index];
  if (!(date instanceof Date)) return null;
  const name = label.trim().slice(0, 80);
  if (!name) return null;
  const local = tripCurrency(trip);
  const parsed = parsePrice(price, local);
  const clock = /^\d{2}:\d{2}$/.test(time) ? time : "";
  const base = {
    ...(category ? { category } : {}),
    ...(clock ? { time: clock } : {}),
    key: spendItemKey(trip.id, day.id, category || "other", ref, name),
  };
  if (!parsed) {
    if (!blank) return null;
    return { date: isoDate(date), label: name, amount: 0, currency: local || "HKD", ...(local ? {} : { currencyGuess: true as const }), ...base };
  }
  return {
    date: isoDate(date),
    label: name,
    amount: parsed.amount,
    currency: parsed.currency,
    ...(parsed.guess ? { currencyGuess: true as const } : {}),
    ...base,
  };
}

/** Route-first ride label, e.g. "關西 → 難波 · 電車"; a bare duration like 「約 50 分鐘」 is never the whole label. */
export function rideSpendLabel(ride: { from: string; to: string; mode: string; detail: string }): string {
  const route = [ride.from, ride.to].map((part) => part.trim()).filter(Boolean).join(" → ");
  const detail = ride.detail.trim();
  const durationOnly = /^(約|约|大約|~)?\s*\d+(\.\d+)?\s*(分鐘|分钟|分|小時|小时|min|mins|minutes|h|hr|hrs|hours)\s*$/i.test(detail);
  const parts = [route, ride.mode.trim()].filter(Boolean);
  if (!route && detail && !durationOnly) parts.unshift(detail);
  return parts.join(" · ").slice(0, 80) || (durationOnly ? "" : detail.slice(0, 80)) || "交通";
}

export function rideRef(ride: { from: string; to: string }): string {
  return `ride-${ride.from}-${ride.to}`;
}

function isCheckoutHotel(trip: TripBook, dayIndex: number, name: string): boolean {
  if (dayIndex !== trip.days.length - 1 || dayIndex === 0) return false;
  return trip.days[dayIndex - 1].hotels.some((hotel) => hotel.name.trim() === name.trim());
}

/** Every priced row on a day, timeline order when the day has one, rides last. Same keys as the per-item buttons. */
export function dayCostItems(trip: TripBook, day: TripDay): SpendItem[] {
  const dayIndex = trip.days.findIndex((item) => item.id === day.id);
  if (dayIndex < 0) return [];
  const items: SpendItem[] = [];
  const seen = new Set<string>();
  const add = (item: SpendItem | null) => {
    if (!item || !(item.amount > 0) || seen.has(item.key || "")) return;
    seen.add(item.key || "");
    items.push(item);
  };
  type Entry = { kind: SpendCategory; id: string; name: string; price: string; time: string };
  const entries: Entry[] = [
    ...day.spots.map((spot) => ({ kind: "sight" as const, id: spot.id, name: spot.name, price: spot.price, time: spendTimeHint("", spot.hours) })),
    ...day.meals.map((meal) => ({ kind: "meal" as const, id: meal.id, name: meal.name, price: meal.price, time: spendTimeHint(meal.slot, meal.hours) })),
    ...day.hotels
      .filter((hotel) => !isCheckoutHotel(trip, dayIndex, hotel.name))
      .map((hotel) => ({ kind: "hotel" as const, id: hotel.id, name: hotel.name, price: hotel.price, time: "" })),
  ];
  if (day.timeline.length) {
    const order = new Map(day.timeline.map((id, at) => [id, at]));
    entries.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  }
  for (const entry of entries) add(spendItem(trip, day, entry.name, entry.price, false, entry.kind, entry.time, entry.id));
  for (const ride of day.rides) add(spendItem(trip, day, rideSpendLabel(ride), ride.price, false, "ride", "", rideRef(ride)));
  return items;
}

/** One day's batch for MoneyTracker's multi-row sheet (Money accepts up to 20 rows). */
export function spendOnDay(trip: TripBook, day: TripDay): SpendItem[] {
  return dayCostItems(trip, day).slice(0, 20);
}

export type CostTotals = Record<string, Partial<Record<SpendCategory, number>> & { all: number }>;

export type TripCosts = {
  currency: string;
  days: { day: TripDay; date: string; items: SpendItem[]; totals: Record<string, number> }[];
  /** currency → per-category sums. */
  totals: CostTotals;
  count: number;
  guessCount: number;
};

export function tripCosts(trip: TripBook): TripCosts {
  const totals: CostTotals = {};
  let count = 0;
  let guessCount = 0;
  const days = trip.days.map((day) => {
    const items = dayCostItems(trip, day);
    const dayTotals: Record<string, number> = {};
    for (const item of items) {
      const kind = item.category || "other";
      const bucket = (totals[item.currency] ||= { all: 0 });
      bucket[kind] = (bucket[kind] || 0) + item.amount;
      bucket.all += item.amount;
      dayTotals[item.currency] = (dayTotals[item.currency] || 0) + item.amount;
      count += 1;
      if (item.currencyGuess) guessCount += 1;
    }
    return { day, date: items[0]?.date || "", items, totals: dayTotals };
  });
  return { currency: tripCurrency(trip), days, totals, count, guessCount };
}

/**
 * `#estimate=` contract with MoneyTracker: the planner's expected spend, summed per type and currency.
 * Money converts to HKD with its own FX rates and lets the user set or compare the trip's cash budget.
 */
export type TripEstimate = {
  v: 1;
  trip: string;
  tripId: string;
  bookId: string;
  start: string;
  end: string;
  count: number;
  guess: number;
  lines: { category: SpendCategory; currency: string; amount: number }[];
};

export function tripEstimate(trip: TripBook, costs = tripCosts(trip)): TripEstimate {
  const dates = dayDates(trip).filter((date): date is Date => date instanceof Date);
  const lines: TripEstimate["lines"] = [];
  for (const [currency, bucket] of Object.entries(costs.totals)) {
    for (const kind of ["hotel", "ride", "meal", "sight", "other"] as SpendCategory[]) {
      const amount = bucket[kind] || 0;
      if (amount > 0) lines.push({ category: kind, currency, amount: Math.round(amount * 100) / 100 });
    }
  }
  return {
    v: 1,
    trip: trip.title.slice(0, 80),
    tripId: moneyTripIdForBook(trip.id).slice(0, 80),
    bookId: trip.id.slice(0, 80),
    start: dates[0] ? isoDate(dates[0]) : "",
    end: dates.length ? isoDate(dates[dates.length - 1]) : "",
    count: costs.count,
    guess: costs.guessCount,
    lines: lines.slice(0, 40),
  };
}

const SYMBOL: Record<string, string> = { HKD: "HK$", USD: "US$", JPY: "¥", CNY: "¥", TWD: "NT$", THB: "฿", GBP: "£", EUR: "€", AUD: "A$", SGD: "S$", KRW: "₩", CAD: "C$", NZD: "NZ$", INR: "₹", MOP: "MOP$", CHF: "CHF " };

export function formatSpend(amount: number, currency: string): string {
  const rounded = Math.round(amount * 100) / 100;
  const text = rounded.toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(rounded) ? 0 : 2 });
  return `${SYMBOL[currency] || `${currency} `}${text}`;
}

export function moneyEstimateUrl(estimate: TripEstimate): string {
  return `${MONEY_URL}#estimate=${encodeToken(JSON.stringify(estimate))}`;
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
