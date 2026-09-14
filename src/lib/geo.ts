import type { LatLng, TransportMode } from "@/types/trip";

const EARTH_M = 6371000;

export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km`;
}

export function estimateTravel(
  from: LatLng,
  to: LatLng,
  mode: TransportMode,
): { durationMin: number; distanceM: number; mode: TransportMode } {
  const distanceM = haversineM(from, to);
  const km = distanceM / 1000;
  let durationMin = 0;
  switch (mode) {
    case "walk":
      durationMin = (km / 4.5) * 60;
      break;
    case "cycle":
      durationMin = (km / 14) * 60 + 2;
      break;
    case "taxi":
      durationMin = (km / 22) * 60 + 4;
      break;
    case "transit":
      durationMin = (km / 18) * 60 + 7;
      break;
  }
  return {
    mode,
    distanceM: Math.round(distanceM),
    durationMin: Math.max(1, Math.round(durationMin)),
  };
}

export function suggestMode(
  from: LatLng,
  to: LatLng,
  preferred: TransportMode,
): TransportMode {
  const m = haversineM(from, to);
  if (m < 700) return "walk";
  if (m < 1800 && preferred === "walk") return "walk";
  if (m > 8000 && preferred === "walk") return "transit";
  if (m > 12000) return preferred === "cycle" ? "transit" : preferred;
  return preferred;
}

export function centroid(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

export function maxPairDistance(points: LatLng[]): number {
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      max = Math.max(max, haversineM(points[i], points[j]));
    }
  }
  return max;
}
