import { routeProvider } from "@/services/route-provider";
import { loadThresholds, minutesBetween } from "@/lib/datetime";
import type {
  DayLoad,
  DayStats,
  HotelStay,
  ItineraryItem,
  Place,
  TransportMode,
  Trip,
} from "@/types/trip";

export function hotelForDate(trip: Trip, date: string): HotelStay | undefined {
  return trip.hotels.find((h) => h.checkInDate <= date && h.checkOutDate >= date) ?? trip.hotels[0];
}

export async function recomputeDayItems(
  trip: Trip,
  date: string,
  items: ItineraryItem[],
  placesById: Map<string, Place>,
  preferred: TransportMode,
): Promise<ItineraryItem[]> {
  const ordered = [...items].sort((a, b) => a.order - b.order).map((it, i) => ({ ...it, order: i }));
  const hotel = hotelForDate(trip, date);
  let cursor = date === trip.startDate ? addBuffer(trip.arrivalTime, 90) : "09:00";
  if (date === trip.startDate && hotel) {
    cursor = maxTime(cursor, hotel.checkInTime);
  }

  const result: ItineraryItem[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const item = { ...ordered[i] };
    const place = placesById.get(item.placeId);
    if (!place) {
      result.push(item);
      continue;
    }
    const prevPlace =
      i === 0
        ? hotel
          ? { lat: hotel.lat, lng: hotel.lng }
          : null
        : placesById.get(ordered[i - 1].placeId) ?? null;
    if (prevPlace) {
      item.transportFromPrevious = await routeProvider.route(
        prevPlace,
        place,
        undefined,
        preferred,
      );
    } else {
      item.transportFromPrevious = undefined;
    }
    const travel = item.transportFromPrevious?.durationMin ?? 0;
    if (!item.locked) {
      const start = i === 0 ? cursor : addBuffer(cursor, travel);
      item.startTime = start;
      item.endTime = addBuffer(start, item.durationMin);
    }
    cursor = item.endTime || cursor;
    result.push(item);
  }
  return result;
}

function addBuffer(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + min;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function maxTime(a: string, b: string): string {
  return minutesBetween("00:00", a) >= minutesBetween("00:00", b) ? a : b;
}

export function dayStatsFor(
  date: string,
  items: ItineraryItem[],
  pace: Trip["pace"],
): DayStats {
  const activityMin = items.reduce((s, i) => s + i.durationMin, 0);
  const travelMin = items.reduce((s, i) => s + (i.transportFromPrevious?.durationMin ?? 0), 0);
  const walkDistanceM = items.reduce((s, i) => {
    const leg = i.transportFromPrevious;
    if (!leg || leg.mode !== "walk") return s;
    return s + leg.distanceM;
  }, 0);
  const total = activityMin + travelMin;
  const { busy, overloaded } = loadThresholds(pace);
  let load: DayLoad = "comfortable";
  if (total >= overloaded) load = "overloaded";
  else if (total >= busy) load = "busy";
  return {
    date,
    activityMin,
    travelMin,
    walkDistanceM,
    load,
    itemCount: items.length,
  };
}
