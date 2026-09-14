import type { TripDestination } from "@/types/trip";

export type Airport = {
  iata: string;
  name: string;
  city: string;
  country: string;
  tz: string;
  lat: number;
  lng: number;
};

type CompactAirport = [string, string, string, string, string, number, number];

const POPULAR = [
  "HKG", "TPE", "NRT", "HND", "KIX", "NGO", "CTS", "FUK", "OKA",
  "ICN", "PUS", "SIN", "BKK", "CNX", "KUL", "PEN", "MNL", "SGN", "HAN", "DPS",
  "PVG", "PEK", "CAN", "SZX", "MFM", "KHH", "RMQ",
  "LHR", "LGW", "CDG", "AMS", "FRA", "FCO", "MAD", "BCN", "ZRH", "IST",
  "JFK", "EWR", "LAX", "SFO", "ORD", "SEA", "YVR", "YYZ", "MIA", "ATL",
  "SYD", "MEL", "AKL", "DXB", "DOH", "AUH", "DEL", "BOM", "CGK", "JNB",
];

let cache: Airport[] | null = null;
let inflight: Promise<Airport[]> | null = null;
const countryAliasCache = new Map<string, string[]>();

function expand(row: CompactAirport): Airport {
  return {
    iata: row[0],
    name: row[1],
    city: row[2],
    country: row[3],
    tz: row[4],
    lat: row[5],
    lng: row[6],
  };
}

export async function loadAirports(): Promise<Airport[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const url = `${import.meta.env.BASE_URL}data/airports.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load airports (${res.status})`);
    const rows = (await res.json()) as CompactAirport[];
    cache = rows.map(expand);
    return cache;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countryAliases(code: string): string[] {
  if (!code) return [];
  const hit = countryAliasCache.get(code);
  if (hit) return hit;
  const names = [fold(code)];
  for (const loc of ["en", "zh-Hant", "zh-HK", "zh-Hans", "zh-CN", "ja"]) {
    try {
      const n = new Intl.DisplayNames([loc], { type: "region" }).of(code.toUpperCase());
      if (n) names.push(fold(n));
    } catch {
      /* ignore */
    }
  }
  const uniq = [...new Set(names.filter(Boolean))];
  countryAliasCache.set(code, uniq);
  return uniq;
}

function scoreAirport(q: string, a: Airport): number {
  if (!q) return 0;
  const iata = fold(a.iata);
  const name = fold(a.name);
  const city = fold(a.city);
  if (iata === q) return 200;
  if (iata.startsWith(q)) return 160;
  if (city === q) return 140;
  if (city.startsWith(q)) return 110;
  if (name.startsWith(q)) return 90;
  if (city.includes(q)) return 70;
  if (name.includes(q)) return 50;
  const countries = countryAliases(a.country);
  if (countries.some((n) => n === q)) return 28;
  if (q.length >= 2 && countries.some((n) => n.startsWith(q))) return 18;
  return 0;
}

export function searchAirports(
  airports: Airport[],
  query: string,
  limit = 12,
  extraQueries: string[] = [],
): Airport[] {
  const terms = [...new Set([query, ...extraQueries].map(fold).filter(Boolean))];
  if (!terms.length) {
    const popular = new Map(POPULAR.map((code, i) => [code, i]));
    return airports
      .filter((a) => popular.has(a.iata))
      .sort((a, b) => (popular.get(a.iata) ?? 99) - (popular.get(b.iata) ?? 99))
      .slice(0, limit);
  }
  return airports
    .map((a) => ({ a, s: Math.max(...terms.map((t) => scoreAirport(t, a))) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.a.iata.localeCompare(b.a.iata))
    .slice(0, limit)
    .map((x) => x.a);
}

export function findAirport(airports: Airport[], iataOrName: string): Airport | undefined {
  const q = fold(iataOrName);
  if (!q) return undefined;
  return airports.find((a) => fold(a.iata) === q) ?? airports.find((a) => fold(a.name) === q);
}

export function airportToDestination(a: Airport): TripDestination {
  return {
    id: `apt-${a.iata.toLowerCase()}`,
    name: a.city || a.name,
    country: a.country,
    timezone: a.tz || "UTC",
    lat: a.lat,
    lng: a.lng,
    iata: a.iata,
  };
}

export function countryLabel(code: string, locale: string): string {
  if (!code) return "";
  if (code.length === 2) {
    try {
      return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
    } catch {
      return code;
    }
  }
  return code;
}

export function airportLine(a: Airport, locale: string): string {
  const country = countryLabel(a.country, locale);
  const where = [a.city, country].filter(Boolean).join(", ");
  return where ? `${a.iata} · ${where}` : a.iata;
}
