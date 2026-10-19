export type GeoPoint = { lat: number; lng: number };

const KEY = "tripgeo.v1";

const WHERE: Record<string, string> = {
  milan: "Milano, Italy",
  milano: "Milano, Italy",
  florence: "Firenze, Italy",
  firenze: "Firenze, Italy",
  rome: "Roma, Italy",
  roma: "Roma, Italy",
  venice: "Venezia, Italy",
  madrid: "Madrid, Spain",
  barcelona: "Barcelona, Spain",
  osaka: "Osaka, Japan",
  kyoto: "Kyoto, Japan",
  tokyo: "Tokyo, Japan",
  hongkong: "Hong Kong",
  hk: "Hong Kong",
};

const CENTER: Record<string, GeoPoint> = {
  milan: { lat: 45.4642, lng: 9.19 },
  milano: { lat: 45.4642, lng: 9.19 },
  florence: { lat: 43.7696, lng: 11.2558 },
  firenze: { lat: 43.7696, lng: 11.2558 },
  rome: { lat: 41.9028, lng: 12.4964 },
  roma: { lat: 41.9028, lng: 12.4964 },
  venice: { lat: 45.4408, lng: 12.3155 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  barcelona: { lat: 41.3874, lng: 2.1686 },
  osaka: { lat: 34.6937, lng: 135.5023 },
  kyoto: { lat: 35.0116, lng: 135.7681 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  hongkong: { lat: 22.3193, lng: 114.1694 },
  hk: { lat: 22.3193, lng: 114.1694 },
};

export function cityCenter(city: string): GeoPoint | null {
  return CENTER[city.trim().toLowerCase()] || null;
}

/** Detect which city a place belongs to from its address/name text, so
 *  transfer days (Milan → Florence, Florence → Madrid) geocode each
 *  entry against its own city instead of the day's start city. Falls
 *  back to the day's city when the text names no known city. */
const CITY_TOKENS: Array<[RegExp, string]> = [
  [/milano|milan/i, "milan"],
  [/firenze|florence/i, "florence"],
  [/roma|rome/i, "rome"],
  [/venezia|venice/i, "venice"],
  [/madrid/i, "madrid"],
  [/barcelona/i, "barcelona"],
  [/osaka|大阪/i, "osaka"],
  [/kyoto|京都/i, "kyoto"],
  [/tokyo|東京/i, "tokyo"],
  [/hong\s*kong|香港/i, "hongkong"],
];

export function cityKeyFor(text: string, fallbackCity: string): string {
  for (const [pattern, key] of CITY_TOKENS) {
    if (pattern.test(text)) return key;
  }
  return fallbackCity.trim().toLowerCase();
}

export function mapQuery(name: string, city: string): string {
  const head = name.split("（")[0].replace(/[（(].*$/, "").trim();
  const latin = head.replace(/[^\p{Script=Latin}\d\s.'’&,/-]/gu, " ").replace(/\s+/g, " ").trim();
  const place = latin.length >= 3 ? latin : head;
  const where = WHERE[city.trim().toLowerCase()] || city.trim();
  return where ? `${place}, ${where}` : place;
}

export function canMap(name: string): boolean {
  const head = name.split("（")[0].trim();
  if (/[A-Za-z]{3}/.test(head)) return true;
  return !/^(抵達|輕鬆|大份|輕晚|早餐|午餐|晚餐|下午茶|早抖|休息|回程)/.test(head) && head.length >= 2;
}

function readCache(): Record<string, GeoPoint | null> {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, GeoPoint | null>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const inflight = new Map<string, Promise<GeoPoint | null>>();

export async function geocode(query: string, bias?: GeoPoint | null): Promise<GeoPoint | null> {
  const key = `${query.trim().toLowerCase()}|${bias ? `${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}` : ""}`;
  if (!query.trim()) return null;
  const cache = readCache();
  if (key in cache) return cache[key];
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = fetchPoint(query, bias)
    .then((point) => {
      const next = readCache();
      next[key] = point;
      localStorage.setItem(KEY, JSON.stringify(next));
      return point;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

async function fetchPoint(query: string, bias?: GeoPoint | null): Promise<GeoPoint | null> {
  const params = new URLSearchParams({ q: query, limit: "1" });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
  }
  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
  if (!response.ok) return null;
  const data = (await response.json()) as { features?: { geometry?: { coordinates?: number[] } }[] };
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (bias && Math.abs(lat - bias.lat) > 1.2) return null;
  return { lat, lng };
}
