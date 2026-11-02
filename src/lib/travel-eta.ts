import { cityCenter, geocodeFirst, haversineKm, type GeoPoint } from "./geocode.ts";
import { clampTravel, entryGeocodeQueries, normalizePlannerMode, type TripDay } from "./trip.ts";

/** km/h heuristics when OSRM is unavailable or mode has no public router profile. */
export const MODE_SPEED_KMH: Record<string, number> = {
  步行: 4.5,
  電車: 22,
  地鐵: 25,
  巴士: 18,
  的士: 30,
  其他: 20,
};

export type LegEstimateSource = "osrm" | "haversine";

export type LegEstimate = {
  travelMin: number;
  mode: string;
  source: LegEstimateSource;
  distanceKm: number;
};

/** Pull lat/lng out of a Google Maps URL when present. */
export function parseMapsCoords(raw: string): GeoPoint | null {
  const text = (raw || "").trim();
  if (!text) return null;
  const at = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (at) return point(Number(at[1]), Number(at[2]));
  const bang = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (bang) return point(Number(bang[1]), Number(bang[2]));
  const q = text.match(/[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (q) return point(Number(q[1]), Number(q[2]));
  return null;
}

function point(lat: number, lng: number): GeoPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function speedKmhForMode(mode: string): number {
  const normalized = normalizePlannerMode(mode) || "步行";
  return MODE_SPEED_KMH[normalized] ?? MODE_SPEED_KMH["其他"];
}

/** Round a duration to a touch-friendly minute chip (prefer multiples of 5 above 7). */
export function roundTravelMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  if (minutes < 3) return clampTravel(1);
  if (minutes <= 7) return clampTravel(Math.round(minutes));
  return clampTravel(Math.max(5, Math.round(minutes / 5) * 5));
}

export function estimateMinutesFromKm(distanceKm: number, mode: string): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const speed = speedKmhForMode(mode);
  if (speed <= 0) return 0;
  return roundTravelMinutes((distanceKm / speed) * 60);
}

function osrmProfile(mode: string): "foot" | "driving" | null {
  const normalized = normalizePlannerMode(mode);
  if (!normalized || normalized === "步行") return "foot";
  if (normalized === "的士") return "driving";
  return null;
}

async function osrmDurationMin(from: GeoPoint, to: GeoPoint, profile: "foot" | "driving"): Promise<number | null> {
  const path = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `https://router.project-osrm.org/route/v1/${profile}/${path}?overview=false`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { code?: string; routes?: { duration?: number }[] };
    if (data.code && data.code !== "Ok") return null;
    const seconds = data.routes?.[0]?.duration;
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
    return roundTravelMinutes(seconds / 60);
  } catch {
    return null;
  }
}

async function resolveEntryPoint(day: TripDay, entryId: string): Promise<GeoPoint | null> {
  const plan = entryGeocodeQueries(day, entryId);
  const fromMaps = parseMapsCoords(plan.mapsUrl);
  if (fromMaps) return fromMaps;
  const bias = plan.bias || cityCenter(day.city);
  if (!plan.queries.length) return null;
  return geocodeFirst(plan.queries, bias);
}

/**
 * Estimate inter-stop travel minutes without a Google Directions key.
 * Prefers OSRM for walking / taxi; otherwise haversine × mode speed.
 */
export async function estimateLegTravel(input: {
  day: TripDay;
  fromEntryId: string;
  toEntryId: string;
  mode?: string;
}): Promise<LegEstimate | null> {
  const preferred = normalizePlannerMode(input.mode || "") || "";
  const [from, to] = await Promise.all([
    resolveEntryPoint(input.day, input.fromEntryId),
    resolveEntryPoint(input.day, input.toEntryId),
  ]);
  if (!from || !to) return null;
  const distanceKm = haversineKm(from, to);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;

  const profile = osrmProfile(preferred);
  if (profile) {
    const osrmMin = await osrmDurationMin(from, to, profile);
    if (osrmMin) {
      return {
        travelMin: osrmMin,
        mode: preferred || (profile === "foot" ? "步行" : "的士"),
        source: "osrm",
        distanceKm,
      };
    }
  }

  const mode = preferred || "步行";
  const travelMin = estimateMinutesFromKm(distanceKm, mode);
  if (!travelMin) return null;
  return { travelMin, mode, source: "haversine", distanceKm };
}
