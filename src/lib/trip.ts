export type TripImage = {
  src: string;
  href: string;
  alt: string;
  caption: string;
};

export type TripSpot = {
  name: string;
  badge: string;
  tone: string;
  hours: string;
  address: string;
  price: string;
  /** Optional reference-image URL (Wikimedia Commons thumb). Empty = placeholder. */
  image: string;
  /** Optional Traditional-Chinese blogger reference post URL. Empty = no link shown. */
  refLink: string;
  /** Short label for refLink (blog/post name). Empty = fallback "參考遊記". */
  refLabel: string;
  html: string;
};

export type TripSun = {
  sunrise: string;
  sunset: string;
  sunriseCity: string;
  sunsetCity: string;
};

export type TripDay = {
  id: string;
  city: string;
  label: string;
  title: string;
  leadHtml: string;
  walkHtml: string;
  foodHtml: string;
  noteHtml: string;
  sun: TripSun;
  meals: { slot: string; place: string; note: string }[];
  rides: Ride[];
  images: TripImage[];
  spots: TripSpot[];
};

export type RationalePoint = { label: string; text: string };

export type TripRationale = {
  city: string;
  title: string;
  summary: string;
  points: RationalePoint[];
  html: string;
};

export type FoodLink = { label: string; href: string };

export type FoodPlace = {
  name: string;
  city: string;
  address: string;
  lines: string[];
  links: FoodLink[];
};

export type Ride = {
  from: string;
  to: string;
  mode: string;
  detail: string;
  price: string;
  note: string;
  spot: string;
};

export type DayMeal = {
  slot: string;
  title: string;
  note: string;
  places: FoodPlace[];
};

export type TripGuide = {
  id: string;
  label: string;
  html: string;
  places: FoodPlace[];
};

export type TripBook = {
  schemaVersion: 1;
  id: string;
  locale: string;
  title: string;
  subtitle: string;
  tagline: string;
  nav: { id: string; label: string }[];
  overviewHtml: string;
  rationales: TripRationale[];
  days: TripDay[];
  transport: {
    introHtml: string;
    blocks: { heading: string; html: string }[];
  };
  guides: TripGuide[];
  footer: string;
};

const CITY_LABEL: Record<string, string> = {
  milan: "米蘭",
  milano: "米蘭",
  florence: "佛羅倫斯",
  firenze: "佛羅倫斯",
  madrid: "馬德里",
  osaka: "大阪",
  kyoto: "京都",
  tokyo: "東京",
  nara: "奈良",
  kobe: "神戶",
  hongkong: "香港",
  hk: "香港",
};

const TRIPS_KEY = "tripbooks.v1";
const NOTES_KEY = "tripnotes.v1";
const UI_KEY = "tripui.v1";
const EDIT_KEY = "tripbook-local-edited";

export type NoteMap = Record<string, Record<string, string>>;

export function cityLabel(city: string): string {
  const key = city.trim().toLowerCase();
  if (CITY_LABEL[key]) return CITY_LABEL[key];
  return city.trim();
}

export function cleanCredit(value: string): string {
  const decoded = value
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">");
  const plain = decoded.replace(/<[^>]*>/g, " ").replace(/<[^<]*$/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length > 8 && !plain.includes("<")) return plain;
  const license = decoded.match(/（[^（）<>]{2,80}）/);
  return license ? `相片：${license[0]}` : plain.replace(/[<>]/g, "").trim();
}

export function tidyRoot(root: HTMLElement) {
  for (const head of [...root.querySelectorAll("h1, h2, h3, h4")]) {
    const parent = head.parentElement;
    if (!parent) continue;
    const media = [...head.children].filter((el) => el.matches("figure, img")).reverse();
    for (const node of media) parent.insertBefore(node, head.nextSibling);
  }
  for (const credit of [...root.querySelectorAll(".attr")]) {
    credit.textContent = cleanCredit(credit.textContent || "");
  }
}

export function tripStats(trip: TripBook): string {
  const cities = [...new Set(trip.days.map((day) => day.city).filter(Boolean))];
  const spots = trip.days.reduce((sum, day) => sum + day.spots.length, 0);
  const place = cities.map(cityLabel).join(" → ");
  const bits = [`${trip.days.length} 日`, `${spots} 個景點`];
  if (place) bits.unshift(place);
  return bits.join(" · ");
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export type TripTiming =
  | { kind: "soon"; days: number }
  | { kind: "now"; index: number; total: number; dayId: string }
  | { kind: "done" };

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthDay(text: string): { month: number; day: number } | null {
  const english = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})\b/i);
  if (english) return { month: MONTHS.indexOf(english[1].slice(0, 3).toLowerCase()) + 1, day: Number(english[2]) };
  const compact = text.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(\d{1,2})$/i);
  if (compact) return { month: MONTHS.indexOf(compact[1].slice(0, 3).toLowerCase()) + 1, day: Number(compact[2]) };
  const chinese = text.match(/(\d{1,2})\s*月\s*(\d{1,2})/);
  if (chinese) return { month: Number(chinese[1]), day: Number(chinese[2]) };
  const slash = text.match(/(?:^|[^\d])(\d{1,2})\/(\d{1,2})(?:[^\d]|$)/);
  if (slash) return { month: Number(slash[1]), day: Number(slash[2]) };
  return null;
}

function tripYear(trip: TripBook): number {
  const found = `${trip.subtitle} ${trip.title} ${trip.footer}`.match(/20\d{2}/);
  return found ? Number(found[0]) : new Date().getFullYear();
}

export function dayDates(trip: TripBook): Array<Date | null> {
  let year = tripYear(trip);
  let previous: Date | null = null;
  return trip.days.map((day) => {
    const parsed = monthDay(`${day.label} ${day.title}`) || monthDay(day.id);
    if (!parsed || parsed.month < 1 || parsed.day < 1 || parsed.day > 31) return null;
    let date = new Date(year, parsed.month - 1, parsed.day);
    if (date.getMonth() !== parsed.month - 1) return null;
    if (previous && date < previous) {
      year += 1;
      date = new Date(year, parsed.month - 1, parsed.day);
    }
    previous = date;
    return date;
  });
}

export function tripTiming(trip: TripBook, now = new Date()): TripTiming | null {
  const dates = dayDates(trip);
  const known = dates.filter((date): date is Date => date instanceof Date);
  if (!known.length) return null;
  const today = startOfDay(now).getTime();
  const start = startOfDay(known[0]).getTime();
  const end = startOfDay(known[known.length - 1]).getTime();
  if (today < start) return { kind: "soon", days: Math.round((start - today) / 86_400_000) };
  if (today > end) return { kind: "done" };
  const index = dates.findIndex((date) => date && startOfDay(date).getTime() === today);
  const day = trip.days[index] || trip.days[0];
  return { kind: "now", index: Math.max(index, 0), total: trip.days.length, dayId: day.id };
}

export function todayDay(trip: TripBook, now = new Date()): TripDay | null {
  const timing = tripTiming(trip, now);
  if (timing?.kind !== "now") return null;
  return trip.days.find((day) => day.id === timing.dayId) || null;
}

export function timingLabel(timing: TripTiming | null): string {
  if (!timing) return "";
  if (timing.kind === "soon") return `仲有 ${timing.days} 日`;
  if (timing.kind === "now") return `今日 · 第 ${timing.index + 1} 日`;
  return "已結束";
}

export function mapLink(spot: TripSpot): string {
  if (typeof DOMParser !== "undefined" && spot.html) {
    const doc = new DOMParser().parseFromString(spot.html, "text/html");
    const link = [...doc.querySelectorAll("a")].find((anchor) =>
      /google\.com\/maps|maps\.app\.goo\.gl/i.test(anchor.getAttribute("href") || ""),
    );
    const href = link?.getAttribute("href");
    if (href) return href;
  }
  const query = (spot.address || spot.name).trim();
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function sanitizeHtml(html: string): string {
  if (!html) return "";
  const linked = html.replace(
    /\[([^\]\n]{1,120})\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>',
  );
  if (typeof DOMParser === "undefined") return linked;
  const doc = new DOMParser().parseFromString(linked, "text/html");
  doc.querySelectorAll("script,iframe,object,embed,link,meta,style").forEach((node) => {
    node.remove();
  });
  for (const details of [...doc.querySelectorAll("details")]) {
    details.querySelector("summary")?.remove();
    const parent = details.parentNode;
    if (!parent) continue;
    while (details.firstChild) parent.insertBefore(details.firstChild, details);
    details.remove();
  }
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (name.startsWith("on") || name === "srcdoc") {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "src") && /^javascript:/i.test(value)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "src") && value.includes("?")) {
        const cut = value.indexOf("?", value.indexOf("?") + 1);
        if (cut > 0) el.setAttribute(attr.name, value.slice(0, cut));
      }
    }
  });
  tidyRoot(doc.body);
  return doc.body.innerHTML;
}

function rationalePlain(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function rationaleChunks(body: string): string[] {
  const date = "Day\\s*\\d+|Dec\\s*\\d+|Nov\\s*\\d+|Oct\\s*\\d+|\\d{1,2}\\/\\d{1,2}";
  const byDateBreak = body.split(new RegExp(`；(?=\\s*(?:${date}))`)).map((part) => part.trim()).filter(Boolean);
  if (byDateBreak.length > 1) return byDateBreak;
  return body.split("。").map((part) => part.trim()).filter(Boolean);
}

export function shapeRationale(html: string): { title: string; summary: string; points: RationalePoint[] } {
  let body = rationalePlain(html).replace(/^點解咁排（[^）]*）\s*/, "");
  let summary = "";
  const colon = body.indexOf("：");
  const firstDate = body.search(/Day\s*\d|Dec\s*\d|Nov\s*\d|Oct\s*\d|\d{1,2}\/\d{1,2}/);
  if (colon > 0 && (firstDate < 0 || colon < firstDate)) {
    summary = body.slice(0, colon).replace(/排嘅$/, "").replace(/^成個.+?係按/, "按").replace(/\s+/g, "").trim();
    body = body.slice(colon + 1).trim();
  }
  const points = rationaleChunks(body).map((chunk) => {
    const matched = chunk.match(/^(Day\s*\d+|Dec\s*\d{1,2}(?:（[^）]+）)?|Nov\s*\d{1,2}(?:（[^）]+）)?|Oct\s*\d{1,2}(?:（[^）]+）)?|\d{1,2}\/\d{1,2})/);
    if (!matched) return { label: "", text: chunk };
    const label = matched[1].replace(/\s+/g, "").replace(/^(Day)(\d)/, "$1 $2");
    const text = chunk
      .slice(matched[0].length)
      .replace(/^[（(][^）)]{0,16}[）)]/, "")
      .replace(/^[：:\s]+/, "")
      .trim();
    return { label, text };
  });
  return { title: "點解咁排", summary, points: points.filter((point) => point.text) };
}

function cleanFact(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[：:\s]+/, "").trim();
}

function valueAfter(text: string, labels: string[]): string {
  for (const label of labels) {
    const at = text.indexOf(label);
    if (at >= 0) return cleanFact(text.slice(at + label.length));
  }
  return "";
}

export function fillSpotFacts(
  html: string,
  current: { hours: string; address: string; price: string },
): { hours: string; address: string; price: string; html: string } {
  if (!html || typeof DOMParser === "undefined") return { ...current, html };
  const doc = new DOMParser().parseFromString(`<div id="facts">${html}</div>`, "text/html");
  const root = doc.getElementById("facts");
  if (!root) return { ...current, html };
  const deep = [...root.querySelectorAll(".deep")];
  deep.forEach((node) => node.remove());
  let hours = current.hours;
  let address = current.address;
  let price = current.price;
  for (const el of [...root.querySelectorAll("li, p")]) {
    if (!(el instanceof HTMLElement) || el.querySelector("li, p")) continue;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (!hours && /開放時間|營業時間/.test(text)) {
      hours = valueAfter(text, ["開放時間", "營業時間"]);
      el.remove();
      continue;
    }
    if (!address && text.indexOf("地址") >= 0 && text.indexOf("地址") < 12) {
      address = valueAfter(text, ["地址"]);
      el.remove();
      continue;
    }
    if (!price && /門票|票價|費用|價錢|人均/.test(text)) {
      const value = valueAfter(text, ["門票", "票價", "費用", "價錢", "人均"]);
      if (value && /免費|免票|¥|€|\$/.test(value)) {
        price = value;
        el.remove();
      }
    }
  }
  if (!hours) {
    for (const el of [...root.querySelectorAll("li")]) {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      const time = text.match(/(\d{1,2}:\d{2}\s*[–\-至到]\s*\d{1,2}:\d{2})/);
      if (!time || !/時段|開門|亮燈|開放|營業/.test(text)) continue;
      hours = time[1].replace(/\s+/g, "");
      break;
    }
  }
  if (!hours && /24\s*小時|通宵/.test(`${root.textContent || ""} ${deep.map((node) => node.textContent || "").join(" ")}`)) {
    hours = "24小時";
  }
  deep.forEach((node) => root.append(node));
  return { hours, address, price, html: root.innerHTML };
}

function normalizeTone(tone: string): string {
  const value = tone.trim().toLowerCase();
  if (value === "ok" || value === "yes" || value === "go") return "ok";
  if (value === "no" || value === "closed" || value === "stop") return "no";
  if (value === "na" || value === "optional" || value === "maybe") return "na";
  return "";
}

function parseSun(day: Record<string, unknown>): TripSun {
  const raw = day.sun && typeof day.sun === "object" ? (day.sun as Record<string, unknown>) : {};
  const sun = {
    sunrise: asString(raw.sunrise).trim(),
    sunset: asString(raw.sunset).trim(),
    sunriseCity: asString(raw.sunriseCity).trim(),
    sunsetCity: asString(raw.sunsetCity).trim(),
  };
  if (sun.sunrise || sun.sunset) return sun;
  const text = asString(day.sunHtml).replace(/<[^>]+>/g, " ");
  const times = [...text.matchAll(/(\d{1,2}:\d{2})/g)].map((match) => match[1]);
  return { ...sun, sunrise: times[0] || "", sunset: times[1] || "" };
}

export function sunLine(day: TripDay): string {
  const riseCity = day.sun.sunriseCity ? cityLabel(day.sun.sunriseCity) : "";
  const setCity = day.sun.sunsetCity ? cityLabel(day.sun.sunsetCity) : "";
  const rise = day.sun.sunrise ? `日出 ${day.sun.sunrise}${riseCity ? `（${riseCity}）` : ""}` : "";
  const set = day.sun.sunset ? `日落 ${day.sun.sunset}${setCity ? `（${setCity}）` : ""}` : "";
  return [rise, set].filter(Boolean).join(" · ");
}

function parseMeals(value: unknown): { slot: string; place: string; note: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = (item || {}) as Record<string, unknown>;
    const place = asString(row.place).trim();
    const note = asString(row.note).trim();
    if (!place && !note) return [];
    return [{ slot: asString(row.slot).trim(), place, note }];
  });
}

function parseFoodPlaces(value: unknown): FoodPlace[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = (item || {}) as Record<string, unknown>;
    const name = asString(row.name).trim();
    if (!name) return [];
    const links = Array.isArray(row.links)
      ? row.links.flatMap((link) => {
          const entry = (link || {}) as Record<string, unknown>;
          const href = asString(entry.href).trim();
          if (!/^https?:/i.test(href)) return [];
          return [{ label: asString(entry.label).trim() || "連結", href }];
        })
      : [];
    const lines = Array.isArray(row.lines) ? row.lines.map((line) => asString(line).trim()).filter(Boolean) : [];
    return [{ name, city: asString(row.city).trim().toLowerCase(), address: asString(row.address).trim(), lines, links }];
  });
}

function normName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, "")
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]/g, "");
}

function splitPlace(value: string): { name: string; address: string } {
  const text = value.replace(/\s+/g, " ").trim();
  const matched = text.match(/^(.{2,48}?)（(.+)）$/);
  if (!matched) return { name: text, address: "" };
  return { name: matched[1].trim(), address: matched[2].trim() };
}

function looksLikePlace(name: string): boolean {
  const text = name.trim();
  if (text.length < 2 || text.length > 48) return false;
  if (/[。！？]/.test(text)) return false;
  if (/^[€¥$0-9]/.test(text)) return false;
  if (/^(必試|午餐|晚餐|早餐|下午茶|輕晚餐|早午餐|宵夜|備選|人均|已定|唔|企|坐)/.test(text)) return false;
  if (/說明|文化|地圖|小費/.test(text)) return false;
  return true;
}

function cityHint(text: string): string {
  if (/米蘭|milan/i.test(text)) return "milan";
  if (/佛羅倫斯|florence|firenze/i.test(text)) return "florence";
  if (/馬德里|madrid/i.test(text)) return "madrid";
  if (/大阪|osaka/i.test(text)) return "osaka";
  if (/京都|kyoto/i.test(text)) return "kyoto";
  if (/東京|tokyo/i.test(text)) return "tokyo";
  return "";
}

function linksIn(root: ParentNode): FoodLink[] {
  return [...root.querySelectorAll("a")]
    .flatMap((link) => {
      if (link.querySelector("img")) return [];
      const href = link.getAttribute("href") || "";
      if (!/^https?:/i.test(href)) return [];
      const raw = (link.textContent || "").replace(/\s+/g, "");
      const label = /地圖|map/i.test(raw) ? "地圖" : /評論|tripadvisor/i.test(raw) ? "評論" : /官|網站|web/i.test(raw) ? "官網" : raw.slice(0, 8) || "連結";
      return [{ label, href }];
    })
    .filter((link, index, all) => all.findIndex((item) => item.href === link.href) === index)
    .slice(0, 3);
}

function linesIn(root: ParentNode): string[] {
  return [...root.querySelectorAll("li")]
    .map((item) => (item.textContent || "").replace(/\s+/g, " ").trim())
    .filter((line) => line && line.length < 180)
    .slice(0, 6);
}

export function foodCatalog(html: string, seeded: FoodPlace[] = []): FoodPlace[] {
  if (seeded.length) return seeded;
  if (!html || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div id="food-root">${html}</div>`, "text/html");
  const root = doc.getElementById("food-root");
  if (!root) return [];
  const places: FoodPlace[] = [];
  let city = "";
  const own = (el: Element) =>
    [...el.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();

  const push = (name: string, address: string, lines: string[], links: FoodLink[]) => {
    if (!looksLikePlace(name)) return;
    if (places.some((place) => place.name === name && place.address === address)) return;
    places.push({ name, city, address, lines: lines.filter((line) => !line.startsWith(name)), links });
  };

  for (const el of [...root.querySelectorAll("h2, h3, h4, p, li")]) {
    if (el.tagName === "H2" || el.tagName === "H3") {
      const found = cityHint(el.textContent || "");
      if (found) city = found;
      continue;
    }
    if (el.tagName === "H4") {
      const split = splitPlace(own(el) || (el.textContent || ""));
      if (!looksLikePlace(split.name) || !split.address) continue;
      const lines: string[] = [];
      const links: FoodLink[] = [];
      let sib = el.nextElementSibling;
      while (sib && !["H2", "H3", "H4"].includes(sib.tagName)) {
        if (sib.classList.contains("restextra")) links.push(...linksIn(sib));
        else if (sib.tagName === "P") {
          const text = (sib.textContent || "").replace(/\s+/g, " ").trim();
          if (text) lines.push(text);
        } else if (sib.tagName === "UL" || sib.tagName === "OL") lines.push(...linesIn(sib));
        sib = sib.nextElementSibling;
      }
      push(split.name, split.address, lines, links);
      continue;
    }
    const strong = el.querySelector(":scope > strong");
    const lead = [...el.childNodes].find((node) => node.nodeType !== Node.TEXT_NODE || (node.textContent || "").trim());
    if (!strong || lead !== strong) continue;
    const split = splitPlace((strong.textContent || "").replace(/\s+/g, " ").trim());
    const after = own(el);
    const paren = (after.match(/（([^）]+)）/) || [])[1] || "";
    const rawAddress = split.address || paren;
    const address = /^(day|dec|\d|早餐|午餐|晚餐|下午茶)/i.test(rawAddress) ? "" : rawAddress;
    if (!looksLikePlace(split.name)) continue;
    const lines: string[] = [];
    const links: FoodLink[] = [];
    if (el.tagName === "LI") {
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      const rest = text.replace(split.name, "").replace(/^（[^）]*）/, "").replace(/^[：:\-—\s]+/, "").trim();
      if (rest) lines.push(rest);
      const extra = el.nextElementSibling;
      if (extra?.classList.contains("restextra")) links.push(...linksIn(extra));
      links.push(...linksIn(el));
    } else {
      let sib = el.nextElementSibling;
      while (sib && !["H2", "H3", "H4"].includes(sib.tagName) && !(sib.tagName === "P" && sib.querySelector(":scope > strong"))) {
        if (sib.classList.contains("restextra")) links.push(...linksIn(sib));
        else if (sib.tagName === "UL" || sib.tagName === "OL") lines.push(...linesIn(sib));
        else if (sib.tagName === "P") {
          const text = (sib.textContent || "").replace(/\s+/g, " ").trim();
          if (text) lines.push(text);
        }
        sib = sib.nextElementSibling;
      }
    }
    push(split.name, address, lines, links);
  }
  return places;
}

function mealSlot(title: string, note: string): string {
  const matched = title.match(/^(輕晚餐|下午茶|早午餐|早餐|午餐|晚餐|宵夜)/);
  if (matched) return matched[1];
  const blob = `${title} ${note}`;
  return (["輕晚餐", "下午茶", "早午餐", "早餐", "午餐", "晚餐", "宵夜"].find((slot) => blob.includes(slot)) || "");
}

function candidates(title: string, note: string): string[] {
  const head = splitPlace(title).name.trim();
  const parts = `${title} ${note}`.split(/[／/、,，]/).map((part) => splitPlace(part).name.trim());
  return [...new Set([head, ...parts])].filter(looksLikePlace);
}

function pickPlace(query: string, places: FoodPlace[], city: string): FoodPlace | null {
  const wanted = normName(splitPlace(query).name);
  const tokens = [...new Set(query.split(/[\s／/、,，嘅的]/).map((part) => normName(splitPlace(part).name)).filter((part) => part.length >= 4))];
  const ranked = places
    .map((place) => {
      const name = normName(place.name);
      let score = 0;
      if (wanted.length >= 3 && (name === wanted || name.includes(wanted) || wanted.includes(name))) score = 100 - Math.abs(name.length - wanted.length);
      else {
        const hit = tokens.filter((token) => name.includes(token)).sort((a, b) => b.length - a.length)[0];
        if (hit && hit.length >= name.length * 0.45) score = hit.length;
      }
      return { place, score };
    })
    .filter((item) => item.score > 0);
  const local = ranked.filter((item) => !item.place.city || item.place.city === city);
  const pool = city && local.length ? local : ranked;
  pool.sort((a, b) => b.score - a.score);
  return pool[0]?.place || null;
}

export function dayMenu(day: TripDay, guide?: TripGuide): DayMeal[] {
  const catalog = foodCatalog(guide?.html || "", guide?.places || []);
  const city = day.city.trim().toLowerCase();
  const rows = day.meals.length
    ? day.meals.map((meal) => ({ slot: meal.slot, title: meal.place || meal.note, note: meal.note, queries: [meal.place].filter(Boolean) }))
    : dishesFromHtml(day.foodHtml);
  return rows
    .map((row) => {
      const places: FoodPlace[] = [];
      for (const query of row.queries) {
        const place = pickPlace(query, catalog, city);
        if (place && !places.some((item) => item.name === place.name && item.address === place.address)) places.push(place);
      }
      for (const place of catalog) {
        if (places.length >= 3) break;
        if (city && place.city && place.city !== city) continue;
        const blob = normName(`${row.title} ${row.note}`);
        const name = normName(place.name);
        const tokens = place.name
          .split(/\s+/)
          .map((part) => normName(part))
          .filter((part) => part.length >= 5 && !["coffee", "caffe", "hotel"].includes(part));
        const hit = (name.length >= 4 && blob.includes(name)) || tokens.some((token) => blob.includes(token));
        if (!hit) continue;
        if (!places.some((item) => item.name === place.name && item.address === place.address)) places.push(place);
      }
      return { slot: row.slot, title: row.title, note: row.note, places };
    })
    .filter((row) => row.title || row.note || row.places.length);
}

export type SouvenirItem = { name: string; detail: string; links: FoodLink[] };

export function daySouvenirs(day: TripDay, guide?: TripGuide): { items: SouvenirItem[]; notes: string[] } {
  const empty = { items: [] as SouvenirItem[], notes: [] as string[] };
  const html = guide?.html || "";
  if (!html || typeof DOMParser === "undefined") return empty;
  const doc = new DOMParser().parseFromString(`<div id="souv">${html}</div>`, "text/html");
  const root = doc.getElementById("souv");
  if (!root) return empty;
  const city = day.city.trim().toLowerCase();
  type Section = { city: string; items: SouvenirItem[]; notes: string[] };
  const sections: Section[] = [];
  // Each city section is an <h3> naming the city followed by an <ol> of items.
  for (const head of [...root.querySelectorAll("h3")]) {
    let list: HTMLOListElement | null = null;
    let sib = head.nextElementSibling;
    while (sib && sib.tagName !== "H3") {
      if (sib.tagName === "OL") {
        list = sib as HTMLOListElement;
        break;
      }
      sib = sib.nextElementSibling;
    }
    if (!list) continue;
    const items: SouvenirItem[] = [...list.querySelectorAll(":scope > li")].map((li) => {
      const strong = li.querySelector(":scope > strong");
      const name = (strong?.textContent || "").replace(/\s+/g, " ").trim();
      const clone = li.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".restlinks").forEach((node) => node.remove());
      const whole = (clone.textContent || "").replace(/\s+/g, " ").trim();
      const detail = whole.replace(name, "").replace(/^[：:\-—\s]+/, "").trim();
      return { name: name || whole, detail, links: linksIn(li) };
    });
    // Trailing tip paragraphs after the list, up to the next <h3> / <hr>.
    const notes: string[] = [];
    let tail = list.nextElementSibling;
    while (tail && tail.tagName !== "H3") {
      if (tail.tagName === "HR") break;
      if (tail.tagName === "P") {
        const text = (tail.textContent || "").replace(/\s+/g, " ").trim();
        if (text && !text.startsWith("小總結")) notes.push(text);
      }
      tail = tail.nextElementSibling;
    }
    sections.push({ city: cityHint(head.textContent || ""), items, notes });
  }
  if (!sections.length) return empty;
  const local = city ? sections.find((section) => section.city === city) : undefined;
  if (local) return local;
  const blank = sections.find((section) => !section.city);
  if (blank) return blank;
  // No city match: show everything rather than an empty box.
  return {
    items: sections.flatMap((section) => section.items),
    notes: sections.flatMap((section) => section.notes),
  };
}

const PLACE_GENERIC = new Set([
  "museo",
  "pinacoteca",
  "basilica",
  "galleria",
  "piazza",
  "hotel",
  "grand",
  "novotel",
  "teatro",
  "parque",
  "parco",
  "tour",
  "santa",
  "maria",
  "della",
  "degli",
  "delle",
  "centro",
  "center",
  "madrid",
  "milan",
  "milano",
  "florence",
  "firenze",
]);

function nameBits(value: string): string[] {
  const plain = value.replace(/[（）()]/g, " ");
  return [...new Set(plain.split(/[\s→＋+／/、,，·・\-—:：&]+/).map((part) => normName(part)))].filter((bit) => {
    if (!bit || PLACE_GENERIC.has(bit)) return false;
    if (/[\u4e00-\u9fff]/.test(bit)) return bit.length >= 2;
    return bit.length >= 4;
  });
}

function overlaps(bit: string, other: string): boolean {
  if (bit === other) return true;
  const min = /[\u4e00-\u9fff]/.test(`${bit}${other}`) ? 2 : 5;
  return bit.length >= min && other.length >= min && (bit.includes(other) || other.includes(bit));
}

function sharedBits(a: string, b: string): string[] {
  const right = nameBits(b);
  return nameBits(a).filter((bit) => right.some((other) => overlaps(bit, other)));
}

function landingSpot(to: string, spots: TripSpot[]): string {
  const ranked = spots
    .map((spot) => ({ name: spot.name, score: sharedBits(to, spot.name).reduce((sum, bit) => sum + bit.length, 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!ranked.length || ranked.length > 1 && ranked[0].score === ranked[1].score) return "";
  return ranked[0].name;
}

function samePlace(a: string, b: string): boolean {
  const left = nameBits(a);
  const right = nameBits(b);
  if (!left.length || !right.length) return false;
  return left.some((bit) =>
    right.some((other) => bit === other || (bit.length >= 5 && other.length >= 5 && (bit.includes(other) || other.includes(bit)))),
  );
}

function parseRides(value: unknown): Ride[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = (item || {}) as Record<string, unknown>;
    const from = asString(row.from).trim();
    const to = asString(row.to).trim();
    if (!from || !to) return [];
    return [
      {
        from,
        to,
        mode: asString(row.mode).trim(),
        detail: asString(row.detail).trim(),
        price: asString(row.price).trim(),
        note: asString(row.note).trim(),
        spot: asString(row.spot).trim(),
      },
    ];
  });
}

function rideMode(text: string): string {
  const start = text.split(/—|或/)[0].trim().slice(0, 48);
  if (/飛機|航班/.test(start)) return "飛機";
  if (/火車|特快|高鐵|Express|FR\d/i.test(start)) return "火車";
  if (/巴士|公車|電車|有軌/.test(start)) return "巴士";
  if (/的士|計程車|taxi/i.test(start)) return "的士";
  if (/地鐵|捷運/.test(start)) return "地鐵";
  if (/船|渡輪/.test(start)) return "船";
  if (/步行|行路|🚶/.test(start)) return "步行";
  return "";
}

function ridesFromHtml(html: string, spots: TripSpot[]): Ride[] {
  if (!html || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div id="legs">${html}</div>`, "text/html");
  const root = doc.getElementById("legs");
  if (!root) return [];
  return [...root.querySelectorAll("li")].flatMap((item) => {
    const strong = item.querySelector("strong");
    const title = (strong?.textContent || "").replace(/\s+/g, " ").trim();
    const ends = title.split(/\s*→\s*/).map((part) => part.trim()).filter(Boolean);
    if (ends.length < 2) return [];
    const rest = (item.textContent || "").replace(title, "").replace(/\s+/g, " ").trim();
    const [lead, ...more] = rest.split(/🕐|✅|⚠️/);
    const mode = rideMode(lead || "");
    const detail = (lead || "").replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, "").replace(new RegExp(`^${mode}`), "").trim();
    const landed = landingSpot(ends[ends.length - 1], spots);
    return [
      {
        from: ends[0],
        to: ends[ends.length - 1],
        mode,
        detail,
        price: "",
        note: more.join(" ").replace(/\s+/g, " ").trim(),
        spot: landed,
      },
    ];
  });
}

function attachRides(days: TripDay[], blocks: { heading: string; html: string }[]): TripDay[] {
  return days.map((day) => {
    if (day.rides.length) {
      return {
        ...day,
        rides: day.rides.map((ride) => {
          if (!ride.spot) return ride;
          if (day.spots.some((spot) => spot.name === ride.spot)) return ride;
          const landed = day.spots.find((spot) => samePlace(ride.spot, spot.name));
          return { ...ride, spot: landed?.name || "" };
        }),
      };
    }
    const key = day.label.replace(/\s+/g, "");
    const block = blocks.find((item) => key && item.heading.replace(/\s+/g, "").includes(key.slice(0, 6)));
    return { ...day, rides: block ? ridesFromHtml(block.html, day.spots) : [] };
  });
}

export function dayKey(value: string): string {
  const matched = value.match(/([A-Za-z]+)\s*(\d{1,2})/);
  if (!matched) return "";
  return `${matched[1].toLowerCase()}${Number(matched[2])}`;
}

export function diningForSpot(spot: TripSpot, day: TripDay, guide?: TripGuide): FoodPlace[] {
  const full = foodCatalog(guide?.html || "", guide?.places || []);
  const local = full.filter((place) => !day.city || !place.city || place.city === day.city);
  // Transfer days (e.g. Dec 26 Florence→Madrid) carry spots from a second city;
  // if nothing matches locally, retry against the full catalog by exact name
  // only — token matches across cities are too noisy (e.g. "galleria").
  const found = matchDining(spot, local, true);
  return found.length ? found : matchDining(spot, full, false);
}

function matchDining(spot: TripSpot, catalog: FoodPlace[], allowTokens: boolean): FoodPlace[] {
  const blob = normName(`${spot.name} ${spot.html.replace(/<[^>]+>/g, " ")}`);
  // CJK names carry full meaning in 2–3 chars (道頓堀); don't apply the
  // Latin-oriented length bars to them.
  const longEnough = (value: string, bar: number) =>
    value.length >= bar || (value.length >= 3 && /[\u4e00-\u9fff]/.test(value));
  const found: FoodPlace[] = [];
  for (const place of catalog) {
    const name = normName(place.name);
    const tokens = allowTokens
      ? place.name
          .split(/\s+/)
          .map((part) => normName(part))
          .filter((part) => longEnough(part, 5) && !["coffee", "caffe", "hotel", "galleria"].includes(part))
      : [];
    const hit = (longEnough(name, 4) && blob.includes(name)) || tokens.some((token) => blob.includes(token));
    if (!hit) continue;
    if (!found.some((item) => item.name === place.name && item.address === place.address)) found.push(place);
  }
  return found.slice(0, 3);
}

function dishesFromHtml(html: string): { slot: string; title: string; note: string; queries: string[] }[] {
  if (!html || typeof DOMParser === "undefined") return [];
  const doc = new DOMParser().parseFromString(`<div id="dish">${html}</div>`, "text/html");
  const root = doc.getElementById("dish");
  if (!root) return [];
  return [...root.querySelectorAll("li")].flatMap((item) => {
    const strong = item.querySelector("strong");
    const title = (strong?.textContent || "").replace(/\s+/g, " ").trim();
    const whole = (item.textContent || "").replace(/\s+/g, " ").trim();
    const note = whole.replace(title, "").replace(/^[（(][^）)]*[）)]/, "").replace(/^[：:\-—\s]+/, "").trim();
    if (!title && !note) return [];
    return [{ slot: mealSlot(title, note), title: title || note, note, queries: candidates(title, note) }];
  });
}

function parseDay(value: unknown, index: number): TripDay {
  if (!value || typeof value !== "object") throw new Error(`第 ${index + 1} 日格式不正確`);
  const day = value as Record<string, unknown>;
  const id = asString(day.id).trim() || `day-${index + 1}`;
  const spotsRaw = Array.isArray(day.spots) ? day.spots : [];
  const imagesRaw = Array.isArray(day.images) ? day.images : [];
  return {
    id,
    city: asString(day.city),
    label: asString(day.label, id),
    title: asString(day.title, id),
    leadHtml: sanitizeHtml(asString(day.leadHtml)),
    walkHtml: sanitizeHtml(asString(day.walkHtml)),
    foodHtml: sanitizeHtml(asString(day.foodHtml)),
    noteHtml: sanitizeHtml(asString(day.noteHtml)),
    sun: parseSun(day),
    meals: parseMeals(day.meals),
    rides: parseRides(day.rides),
    images: imagesRaw.map((image) => {
      const item = (image || {}) as Record<string, unknown>;
      return {
        src: asString(item.src),
        href: asString(item.href),
        alt: asString(item.alt),
        caption: cleanCredit(asString(item.caption)),
      };
    }),
    spots: spotsRaw.map((spot) => {
      const item = (spot || {}) as Record<string, unknown>;
      const rawHtml = asString(item.html);
      let name = asString(item.name).trim();
      let badge = asString(item.badge).trim();
      if ((!name || !badge) && typeof DOMParser !== "undefined" && rawHtml.includes("<summary")) {
        const doc = new DOMParser().parseFromString(rawHtml, "text/html");
        const summary = doc.querySelector("summary");
        if (!name) name = summary?.querySelector(".spotname")?.textContent?.trim() || "";
        if (!badge) badge = summary?.querySelector(".badge")?.textContent?.trim() || "";
      }
      const html = sanitizeHtml(rawHtml);
      const facts = fillSpotFacts(html, {
        hours: asString(item.hours).trim(),
        address: asString(item.address).trim(),
        price: asString(item.price).trim(),
      });
      return {
        name,
        badge,
        tone: normalizeTone(asString(item.tone)),
        hours: facts.hours,
        address: facts.address,
        price: facts.price,
        image: asString(item.image).trim(),
        refLink: asString(item.refLink).trim(),
        refLabel: asString(item.refLabel).trim(),
        html: facts.html,
      };
    }),
  };
}

export function parseTripBook(value: unknown): TripBook {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("行程檔要係一個 JSON 物件");
  }
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 1) throw new Error("只接受 schemaVersion: 1");
  const id = asString(raw.id).trim();
  const title = asString(raw.title).trim();
  if (!id) throw new Error("缺少 id");
  if (!title) throw new Error("缺少 title");
  const navRaw = Array.isArray(raw.nav) ? raw.nav : [];
  const guidesRaw = Array.isArray(raw.guides) ? raw.guides : [];
  const daysRaw = Array.isArray(raw.days) ? raw.days : [];
  const rationalesRaw = Array.isArray(raw.rationales) ? raw.rationales : [];
  const transportRaw =
    raw.transport && typeof raw.transport === "object"
      ? (raw.transport as Record<string, unknown>)
      : {};
  const blocksRaw = Array.isArray(transportRaw.blocks) ? transportRaw.blocks : [];
  const trip: TripBook = {
    schemaVersion: 1,
    id: id.slice(0, 80),
    locale: asString(raw.locale, "zh-Hant"),
    title,
    subtitle: asString(raw.subtitle),
    tagline: asString(raw.tagline),
    nav: navRaw
      .map((item) => {
        const nav = (item || {}) as Record<string, unknown>;
        return { id: asString(nav.id).trim(), label: asString(nav.label).trim() };
      })
      .filter((item) => item.id && item.label),
    overviewHtml: sanitizeHtml(asString(raw.overviewHtml)),
    rationales: rationalesRaw.map((item) => {
      const rationale = (item || {}) as Record<string, unknown>;
      const html = sanitizeHtml(asString(rationale.html));
      const shaped = shapeRationale(html);
      const given = Array.isArray(rationale.points) ? rationale.points : [];
      const points = given
        .map((point) => {
          const row = (point || {}) as Record<string, unknown>;
          return { label: asString(row.label).trim(), text: asString(row.text).trim() };
        })
        .filter((point) => point.text);
      return {
        city: asString(rationale.city),
        title: asString(rationale.title).trim() || shaped.title,
        summary: asString(rationale.summary).trim() || shaped.summary,
        points: points.length ? points : shaped.points,
        html,
      };
    }),
    days: daysRaw.map(parseDay),
    transport: {
      introHtml: sanitizeHtml(asString(transportRaw.introHtml)),
      blocks: blocksRaw.map((item) => {
        const block = (item || {}) as Record<string, unknown>;
        return { heading: asString(block.heading), html: sanitizeHtml(asString(block.html)) };
      }),
    },
    guides: guidesRaw
      .map((item) => {
        const guide = (item || {}) as Record<string, unknown>;
        return {
          id: asString(guide.id).trim(),
          label: asString(guide.label).trim(),
          html: sanitizeHtml(asString(guide.html)),
          places: parseFoodPlaces(guide.places),
        };
      })
      .filter((guide) => guide.id && guide.label),
    footer: asString(raw.footer),
  };
  trip.days = attachRides(trip.days, trip.transport.blocks);
  const hasBody =
    trip.overviewHtml ||
    trip.days.length > 0 ||
    trip.guides.length > 0 ||
    trip.transport.blocks.length > 0;
  if (!hasBody) throw new Error("行程檔沒有內容");
  return trip;
}

export function parseTripFile(text: string): TripBook[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("這不是有效的 JSON 檔");
  }
  const list = Array.isArray(data) ? data : [data];
  if (list.length === 0) throw new Error("檔案是空的");
  return list.map(parseTripBook);
}

export function loadTrips(): TripBook[] {
  try {
    const raw = localStorage.getItem(TRIPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      try {
        return [parseTripBook(item)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

const VISITS_KEY = "tripvisits.v1";

export type VisitMap = Record<string, Record<string, string>>;

export function visitKey(dayId: string, index: number): string {
  return `${dayId}:${index}`;
}

function readVisitMap(): VisitMap {
  try {
    const raw = localStorage.getItem(VISITS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as VisitMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadVisits(tripId: string): Record<string, string> {
  return readVisitMap()[tripId] || {};
}

export function writeVisit(tripId: string, key: string, at: string): void {
  const all = readVisitMap();
  const current = { ...(all[tripId] || {}) };
  if (at) current[key] = at;
  else delete current[key];
  all[tripId] = current;
  localStorage.setItem(VISITS_KEY, JSON.stringify(all));
  touchLocalEdit();
}

export function exportVisits(): VisitMap {
  return readVisitMap();
}

export function replaceVisits(visits: VisitMap): void {
  localStorage.setItem(VISITS_KEY, JSON.stringify(visits));
}

export type ExtraStop = {
  id: string;
  dayId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  at: string;
};

export type ExtraMap = Record<string, ExtraStop[]>;

const EXTRAS_KEY = "tripextras.v1";

function asStop(value: unknown): ExtraStop | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = asString(raw.name).trim();
  const dayId = asString(raw.dayId).trim();
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!name || !dayId || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: asString(raw.id).trim() || `extra-${Date.now().toString(36)}`,
    dayId,
    name: name.slice(0, 80),
    address: asString(raw.address).trim().slice(0, 160),
    lat,
    lng,
    at: asString(raw.at) || new Date().toISOString(),
  };
}

function readExtraMap(): ExtraMap {
  try {
    const raw = localStorage.getItem(EXTRAS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};
    const map: ExtraMap = {};
    for (const [tripId, rows] of Object.entries(parsed)) {
      if (!Array.isArray(rows)) continue;
      map[tripId] = rows.flatMap((row) => {
        const stop = asStop(row);
        return stop ? [stop] : [];
      });
    }
    return map;
  } catch {
    return {};
  }
}

export function loadExtras(tripId: string): ExtraStop[] {
  return readExtraMap()[tripId] || [];
}

export function addExtra(tripId: string, stop: Omit<ExtraStop, "id" | "at">): ExtraStop {
  const all = readExtraMap();
  const next: ExtraStop = { ...stop, id: `extra-${Date.now().toString(36)}`, at: new Date().toISOString() };
  all[tripId] = [...(all[tripId] || []), next];
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(all));
  touchLocalEdit();
  return next;
}

export function removeExtra(tripId: string, id: string): void {
  const all = readExtraMap();
  all[tripId] = (all[tripId] || []).filter((stop) => stop.id !== id);
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(all));
  touchLocalEdit();
}

export function exportExtras(): ExtraMap {
  return readExtraMap();
}

export function replaceExtras(extras: ExtraMap): void {
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
}

export type CheckMap = Record<string, Record<string, boolean>>;

const CHECKS_KEY = "tripchecks.v1";

function readCheckMap(): CheckMap {
  try {
    const raw = localStorage.getItem(CHECKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CheckMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadChecks(tripId: string): Record<string, boolean> {
  return readCheckMap()[tripId] || {};
}

export function writeCheck(tripId: string, key: string, on: boolean): void {
  const all = readCheckMap();
  const current = { ...(all[tripId] || {}) };
  if (on) current[key] = true;
  else delete current[key];
  all[tripId] = current;
  localStorage.setItem(CHECKS_KEY, JSON.stringify(all));
  touchLocalEdit();
}

export function exportChecks(): CheckMap {
  return readCheckMap();
}

export function replaceChecks(checks: CheckMap): void {
  localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
}

export function touchLocalEdit(iso = new Date().toISOString()): void {
  try {
    localStorage.setItem(EDIT_KEY, iso);
  } catch {
    /* ignore */
  }
}

export function localEditedAt(): string {
  try {
    return localStorage.getItem(EDIT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveTrips(trips: TripBook[], opts?: { silent?: boolean }): void {
  localStorage.setItem(TRIPS_KEY, JSON.stringify(trips));
  if (!opts?.silent) touchLocalEdit();
}

export function upsertTrips(current: TripBook[], incoming: TripBook[]): {
  trips: TripBook[];
  added: number;
  updated: number;
} {
  const trips = [...current];
  let added = 0;
  let updated = 0;
  for (const trip of incoming) {
    const index = trips.findIndex((item) => item.id === trip.id);
    if (index >= 0) {
      trips[index] = trip;
      updated += 1;
    } else {
      trips.unshift(trip);
      added += 1;
    }
  }
  saveTrips(trips);
  return { trips, added, updated };
}

export function deleteTrip(current: TripBook[], id: string): TripBook[] {
  const trips = current.filter((trip) => trip.id !== id);
  saveTrips(trips);
  const notes = loadAllNotes();
  if (notes[id]) {
    delete notes[id];
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }
  const checks = readCheckMap();
  if (checks[id]) {
    delete checks[id];
    localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
  }
  const visits = readVisitMap();
  if (visits[id]) {
    delete visits[id];
    localStorage.setItem(VISITS_KEY, JSON.stringify(visits));
  }
  const extras = readExtraMap();
  if (extras[id]) {
    delete extras[id];
    localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
  }
  return trips;
}

function loadAllNotes(): NoteMap {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as NoteMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function exportNotes(): NoteMap {
  return loadAllNotes();
}

export function replaceLibrary(
  trips: TripBook[],
  notes: NoteMap,
  editedAt: string,
  checks?: CheckMap,
  visits?: VisitMap,
  extras?: ExtraMap,
): void {
  saveTrips(trips, { silent: true });
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  if (checks) replaceChecks(checks);
  if (visits) replaceVisits(visits);
  if (extras) replaceExtras(extras);
  touchLocalEdit(editedAt);
}

export function loadNote(tripId: string, dayId: string): string {
  return loadAllNotes()[tripId]?.[dayId] || "";
}

export function saveNote(tripId: string, dayId: string, value: string): void {
  const notes = loadAllNotes();
  notes[tripId] = { ...(notes[tripId] || {}), [dayId]: value };
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  touchLocalEdit();
}

export type TripUi = { openId: string; tab: string; dayId: string };

export function loadUi(): TripUi {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (!raw) return { openId: "", tab: "", dayId: "" };
    const parsed = JSON.parse(raw) as TripUi;
    return {
      openId: asString(parsed.openId),
      tab: asString(parsed.tab),
      dayId: asString(parsed.dayId),
    };
  } catch {
    return { openId: "", tab: "", dayId: "" };
  }
}

export function saveUi(ui: TripUi): void {
  localStorage.setItem(UI_KEY, JSON.stringify(ui));
}

export function tabsFor(trip: TripBook): { id: string; label: string }[] {
  const available = new Set<string>();
  if (trip.overviewHtml) available.add("overview");
  if (trip.days.length) available.add("days");
  if (trip.transport.introHtml || trip.transport.blocks.length) available.add("transport");
  for (const guide of trip.guides) available.add(guide.id);
  const labels = new Map<string, string>();
  for (const item of trip.nav) labels.set(item.id, item.label);
  for (const guide of trip.guides) labels.set(guide.id, guide.label);
  if (!labels.has("overview")) labels.set("overview", "總覽");
  if (!labels.has("days")) labels.set("days", "每日行程");
  if (!labels.has("transport")) labels.set("transport", "交通");
  const order = trip.nav.length
    ? trip.nav.map((item) => item.id)
    : ["overview", "days", "transport", ...trip.guides.map((guide) => guide.id)];
  const seen = new Set<string>();
  const tabs: { id: string; label: string }[] = [];
  for (const id of [...order, ...available]) {
    if (!available.has(id) || seen.has(id)) continue;
    seen.add(id);
    tabs.push({ id, label: labels.get(id) || id });
  }
  return tabs;
}

export function absorbSaved(text: string): void {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return;
  }
  const list = Array.isArray(data) ? data : [data];
  const notes = loadAllNotes();
  const checks = readCheckMap();
  const visits = readVisitMap();
  const extras = readExtraMap();
  let changed = false;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const id = asString(raw.id).trim();
    const saved = raw.saved;
    if (!id || !saved || typeof saved !== "object") continue;
    const bag = saved as Record<string, unknown>;
    if (bag.notes && typeof bag.notes === "object") {
      notes[id] = bag.notes as Record<string, string>;
      changed = true;
    }
    if (bag.checks && typeof bag.checks === "object") {
      checks[id] = bag.checks as Record<string, boolean>;
      changed = true;
    }
    if (bag.visits && typeof bag.visits === "object") {
      visits[id] = bag.visits as Record<string, string>;
      changed = true;
    }
    if (Array.isArray(bag.extras)) {
      extras[id] = bag.extras.flatMap((row) => {
        const stop = asStop(row);
        return stop ? [stop] : [];
      });
      changed = true;
    }
  }
  if (!changed) return;
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
  localStorage.setItem(VISITS_KEY, JSON.stringify(visits));
  localStorage.setItem(EXTRAS_KEY, JSON.stringify(extras));
  touchLocalEdit();
}

export async function downloadTrip(trip: TripBook): Promise<void> {
  const file = {
    ...trip,
    saved: {
      notes: loadAllNotes()[trip.id] || {},
      checks: readCheckMap()[trip.id] || {},
      visits: readVisitMap()[trip.id] || {},
      extras: readExtraMap()[trip.id] || [],
    },
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const named = new File([blob], `${trip.id}.json`, { type: "application/json" });
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [named] })) {
    await navigator.share({ files: [named], title: trip.title });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = named.name;
  link.click();
  URL.revokeObjectURL(url);
}
