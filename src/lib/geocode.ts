export type GeoPoint = { lat: number; lng: number };

const KEY = "tripgeo.v2";

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
  // Clean the raw address/name: drop (...) / （…） asides and the
  // '；…' transit note that follows the real address, normalise CJK
  // separators to spaces.
  const cleaned = name
    .replace(/[（(][^）)]*[）)]/g, "")
    .split("；")[0]
    .replace(/[／・＋、]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Latin-script text keeps the old behaviour (CJK descriptor suffixes
  // like 聖誕音樂會 are dropped); CJK text is used whole — the Latin
  // extraction would shred a CJK address to digit fragments ("1-1 JR")
  // that the geocoder resolves to a wrong, shared location.
  const latin = cleaned.replace(/[^\p{Script=Latin}\d\s.'’&,/-]/gu, " ").replace(/\s+/g, " ").trim();
  const place = /[A-Za-z]{3}/.test(latin) ? latin : cleaned;
  const where = WHERE[city.trim().toLowerCase()] || city.trim();
  const query = where ? `${place}, ${where}` : place;
  return toJapaneseQuery(query);
}

/** Traditional → Japanese shinjitai for the handful of variant kanji
 *  that appear in Hong Kong-written Japanese addresses. Photon/OSM
 *  indexes the Japanese forms, so Traditional forms (區, 觀, 禪…)
 *  must be converted or the address will not resolve. Applied to the
 *  geocode query only — stored trip text is untouched. */
const TRAD_TO_JP: Record<string, string> = {
  區: "区",
  觀: "観",
  禪: "禅",
  會: "会",
  廣: "広",
  龍: "竜",
  驛: "駅",
  邊: "辺",
  樂: "楽",
  氣: "気",
  樓: "楼",
  廳: "庁",
  鐵: "鉄",
  錢: "銭",
  龜: "亀",
  臺: "台",
  灣: "湾",
  濟: "済",
  澤: "沢",
  濱: "浜",
  櫻: "桜",
  圍: "囲",
  圖: "図",
};

export function toJapaneseQuery(text: string): string {
  return text.replace(/./gu, (ch) => TRAD_TO_JP[ch] ?? ch);
}

/** The Japanese district (区) named in a query, e.g. 北区 in
 *  '大阪市北区曽根崎新地 2-4-1'. Used to reject geocode results that
 *  landed in a different district (Photon happily returns a same-number
 *  address across town). Null when the query names no district. */
export function districtOfQuery(query: string): string | null {
  const ku = query.indexOf("区");
  if (ku < 0) return null;
  const before = query.slice(0, ku);
  const cut = Math.max(
    before.lastIndexOf("市"),
    before.lastIndexOf("都"),
    before.lastIndexOf("府"),
    before.lastIndexOf("県"),
    before.lastIndexOf(" "),
    before.lastIndexOf(","),
  );
  const district = `${before.slice(cut + 1)}区`;
  return /^[\p{Script=Han}]{1,4}区$/u.test(district) ? district : null;
}

/** The town (町/新地/…) part of a Japanese address, e.g.
 *  '京都市中京区壬生高樋町65-21' → '壬生高樋町'. Photon resolves a
 *  bare town but chokes on the full prefixed address (it falls back to
 *  the city), so this is the last-resort candidate. Null when the
 *  address has no town part. */
export function townOfAddress(address: string): string | null {
  const cleaned = toJapaneseQuery(
    address
      .replace(/[（(][^）)]*[）)]/g, "")
      .split("；")[0]
      .trim(),
  );
  const noNumber = cleaned.replace(/[\s　]*[0-9０-９]+(?:[-–—－][0-9０-９]+)*\s*$/, "");
  const ku = noNumber.lastIndexOf("区");
  if (ku < 0) return null;
  const town = noNumber.slice(ku + 1).trim();
  return town || null;
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

/** Try each candidate query in order and return the first result that
 *  passes validation. Candidates are e.g. [street address, place name,
 *  town without house number] — different entries resolve best by
 *  different queries, and a wrong pin is worse than no pin. */
export async function geocodeFirst(queries: string[], bias?: GeoPoint | null): Promise<GeoPoint | null> {
  for (const query of queries) {
    if (!query.trim()) continue;
    const point = await geocode(query, bias);
    if (point) return point;
  }
  return null;
}

export async function geocode(query: string, bias?: GeoPoint | null): Promise<GeoPoint | null> {
  const key = `${query.trim().toLowerCase()}|${bias ? `${bias.lat.toFixed(2)},${bias.lng.toFixed(2)}` : ""}`;
  if (!query.trim()) return null;
  const cache = readCache();
  if (key in cache) return cache[key];
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = fetchCandidate(query, bias)
    .then((result) => {
      const point = result && acceptResult(result, query, bias) ? result.point : null;
      const next = readCache();
      next[key] = point;
      localStorage.setItem(KEY, JSON.stringify(next));
      return point;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

type CandidateResult = { point: GeoPoint; district: string | null; coarse: boolean };

const COARSE_VALUES = new Set(["city", "state", "country", "county"]);

function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(s));
}

/** Is a geocode result believable for this query? Rejects city-level
 *  fallbacks, results impossibly far from the entry's city, and results
 *  in a different Japanese district than the address names — Photon
 *  returns plausible-but-wrong matches for all three (a Fukuoka café
 *  for an Osaka entry, a same-number address across town), and a wrong
 *  pin is worse than no pin. */
export function acceptResult(result: CandidateResult, query: string, bias?: GeoPoint | null): boolean {
  if (result.coarse) return false;
  if (bias && haversineKm(result.point, bias) > 25) return false;
  const want = districtOfQuery(query);
  if (want && result.district && result.district !== want) return false;
  return true;
}

async function fetchCandidate(query: string, bias?: GeoPoint | null): Promise<CandidateResult | null> {
  const params = new URLSearchParams({ q: query, limit: "1" });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
  }
  const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
  if (!response.ok) return null;
  const data = (await response.json()) as {
    features?: {
      geometry?: { coordinates?: number[] };
      properties?: { district?: string; osm_value?: string; type?: string };
    }[];
  };
  const feature = data.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  const props = feature?.properties ?? {};
  return {
    point: { lat, lng },
    district: typeof props.district === "string" ? props.district : null,
    coarse: COARSE_VALUES.has(props.osm_value ?? "") || COARSE_VALUES.has(props.type ?? ""),
  };
}
