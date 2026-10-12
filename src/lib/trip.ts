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
  html: string;
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
  images: TripImage[];
  spots: TripSpot[];
};

export type TripGuide = {
  id: string;
  label: string;
  html: string;
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
  rationales: { city: string; html: string }[];
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

export function tripStats(trip: TripBook): string {
  const cities = [...new Set(trip.days.map((day) => day.city).filter(Boolean))];
  const spots = trip.days.reduce((sum, day) => sum + day.spots.length, 0);
  const place = cities.map(cityLabel).join(" → ");
  const bits = [`${trip.days.length} 日`, `${spots} 個景點`];
  if (place) bits.unshift(place);
  return bits.join(" · ");
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
  return doc.body.innerHTML;
}

function normalizeTone(tone: string): string {
  const value = tone.trim().toLowerCase();
  if (value === "ok" || value === "yes" || value === "go") return "ok";
  if (value === "no" || value === "closed" || value === "stop") return "no";
  if (value === "na" || value === "optional" || value === "maybe") return "na";
  return "";
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
    images: imagesRaw.map((image) => {
      const item = (image || {}) as Record<string, unknown>;
      return {
        src: asString(item.src),
        href: asString(item.href),
        alt: asString(item.alt),
        caption: asString(item.caption),
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
      return {
        name,
        badge,
        tone: normalizeTone(asString(item.tone)),
        hours: asString(item.hours).trim(),
        address: asString(item.address).trim(),
        price: asString(item.price).trim(),
        html: sanitizeHtml(rawHtml),
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
      return { city: asString(rationale.city), html: sanitizeHtml(asString(rationale.html)) };
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
        };
      })
      .filter((guide) => guide.id && guide.label),
    footer: asString(raw.footer),
  };
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

const CHECKS_KEY = "tripchecks.v1";

export type CheckMap = Record<string, Record<string, boolean>>;

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

export function replaceLibrary(trips: TripBook[], notes: NoteMap, editedAt: string, checks?: CheckMap): void {
  saveTrips(trips, { silent: true });
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  if (checks) replaceChecks(checks);
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

export function downloadTrip(trip: TripBook): void {
  const blob = new Blob([JSON.stringify(trip, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${trip.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
