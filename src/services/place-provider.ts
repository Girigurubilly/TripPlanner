import { PLACES_CATALOG, TOKYO_CATALOG } from "@/data/catalog";
import { haversineM } from "@/lib/geo";
import type { PlaceSearchResult } from "@/types/trip";

export interface PlaceProvider {
  search(query: string): Promise<PlaceSearchResult[]>;
  lookupMapsUrl(url: string): Promise<PlaceSearchResult | null>;
  reverseGeocode(lat: number, lng: number): Promise<{ address: string; neighbourhood: string }>;
}

function scoreMatch(q: string, place: PlaceSearchResult): number {
  const hay = `${place.name} ${place.address} ${place.neighbourhood} ${place.tags.join(" ")} ${place.category}`.toLowerCase();
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  let score = 0;
  for (const w of words) {
    if (place.name.toLowerCase().includes(w)) score += 5;
    else if (hay.includes(w)) score += 2;
  }
  return score;
}

function parseMapsUrl(url: string): { lat?: number; lng?: number; name?: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  const isMaps =
    (host.includes("google.") && parsed.pathname.includes("/maps")) ||
    host === "maps.google.com" ||
    host === "maps.app.goo.gl" ||
    host === "goo.gl";
  if (!isMaps && !/google\./.test(host)) return null;
  if (host === "maps.app.goo.gl" || host === "goo.gl") {
    return {};
  }
  const at = parsed.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const q = parsed.searchParams.get("q") || parsed.searchParams.get("query");
  if (q) {
    const coord = q.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
    if (coord) return { lat: Number(coord[1]), lng: Number(coord[2]) };
    return { name: q };
  }
  const place = parsed.pathname.match(/\/place\/([^/@]+)/);
  if (place) return { name: decodeURIComponent(place[1].replaceAll("+", " ")) };
  const ll = parsed.searchParams.get("ll");
  if (ll) {
    const [lat, lng] = ll.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

export class MockPlaceProvider implements PlaceProvider {
  async search(query: string): Promise<PlaceSearchResult[]> {
    const q = query.trim();
    if (!q) return TOKYO_CATALOG.slice(0, 8);
    return PLACES_CATALOG.map((p) => ({ p, s: scoreMatch(q, p) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.p);
  }

  async lookupMapsUrl(url: string): Promise<PlaceSearchResult | null> {
    const parsed = parseMapsUrl(url);
    if (!parsed) return null;
    if (parsed.lat == null && parsed.lng == null && !parsed.name) {
      return null;
    }
    if (parsed.lat != null && parsed.lng != null) {
      const nearest = nearestCatalog(parsed.lat, parsed.lng, 180);
      if (nearest) return nearest;
      const geo = await this.reverseGeocode(parsed.lat, parsed.lng);
      return {
        name: parsed.name || "Pinned place",
        address: geo.address,
        lat: parsed.lat,
        lng: parsed.lng,
        category: "other",
        neighbourhood: geo.neighbourhood,
        estimatedDurationMin: 60,
        indoorOutdoor: "mixed",
        reservationRequired: "unknown",
        tags: ["maps-url"],
        photos: [],
      };
    }
    if (parsed.name) {
      const hits = await this.search(parsed.name);
      return hits[0] ?? null;
    }
    return null;
  }

  async reverseGeocode(lat: number, lng: number) {
    const nearest = nearestCatalog(lat, lng, 800);
    if (nearest) {
      return { address: nearest.address, neighbourhood: nearest.neighbourhood };
    }
    return {
      address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      neighbourhood: "",
    };
  }
}

function nearestCatalog(lat: number, lng: number, maxM: number): PlaceSearchResult | null {
  let best: PlaceSearchResult | null = null;
  let bestD = maxM;
  for (const p of PLACES_CATALOG) {
    const d = haversineM({ lat, lng }, p);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

export const placeProvider: PlaceProvider = new MockPlaceProvider();
