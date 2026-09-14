import { haversineM } from "@/lib/geo";
import { isOpenOn, minutesBetween } from "@/lib/datetime";
import { hotelForDate } from "@/lib/planning";
import type { ItineraryItem, Place, PlanningConflict, Trip } from "@/types/trip";

export function findConflicts(
  trip: Trip,
  date: string,
  items: ItineraryItem[],
  placesById: Map<string, Place>,
): PlanningConflict[] {
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const conflicts: PlanningConflict[] = [];
  const hotel = hotelForDate(trip, date);

  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    const place = placesById.get(item.placeId);
    const prev = ordered[i - 1];

    if (prev && item.startTime && prev.endTime) {
      const gap = minutesBetween(prev.endTime, item.startTime);
      if (gap < 0) {
        conflicts.push({
          id: `overlap-${item.id}`,
          kind: "overlap",
          severity: "error",
          itemId: item.id,
          date,
          messageKey: "conflict.overlap",
          params: {
            name: placesById.get(prev.placeId)?.name ?? "",
            min: Math.abs(gap),
          },
        });
      } else {
        const need = item.transportFromPrevious?.durationMin ?? 0;
        if (need > 0 && gap < need) {
          conflicts.push({
            id: `buffer-${item.id}`,
            kind: "short-buffer",
            severity: gap + 8 < need ? "error" : "warn",
            itemId: item.id,
            date,
            messageKey: "conflict.shortBuffer",
            params: {
              gap,
              need,
              mode: item.transportFromPrevious?.mode ?? "walk",
            },
          });
        }
      }
    }

    if (place) {
      const open = isOpenOn(place.openingHours, date, item.startTime);
      if (open === "unknown" && (place.priority === "must-do" || !place.openingHours)) {
        if (!place.openingHours) {
          conflicts.push({
            id: `hours-${item.id}`,
            kind: "unknown-hours",
            severity: "warn",
            itemId: item.id,
            date,
            messageKey: "conflict.unknownHours",
            params: { name: place.name },
          });
        }
      }
      if (open === "closed") {
        conflicts.push({
          id: `closed-${item.id}`,
          kind: "closed",
          severity: "error",
          itemId: item.id,
          date,
          messageKey: "conflict.closed",
          params: {
            name: place.name,
            note: place.openingHours?.note ? ` · ${place.openingHours.note}` : "",
          },
        });
      }
    }

    if (hotel && date === hotel.checkOutDate && item.startTime && place) {
      const beforeCheckout = minutesBetween(item.startTime, hotel.checkOutTime) > 0;
      const far = haversineM(place, hotel) > 2500;
      if (beforeCheckout && far) {
        conflicts.push({
          id: `checkout-${item.id}`,
          kind: "checkout",
          severity: "warn",
          itemId: item.id,
          date,
          messageKey: "conflict.checkout",
          params: {
            time: hotel.checkOutTime,
            km: Math.round(haversineM(place, hotel) / 100) / 10,
          },
        });
      }
    }
  }

  if (date === trip.startDate && ordered[0]?.startTime) {
    const earliest = addMinutes(trip.arrivalTime, 75);
    if (minutesBetween(ordered[0].startTime, earliest) > 0) {
      conflicts.push({
        id: `arrival-${ordered[0].id}`,
        kind: "arrival",
        severity: "warn",
        itemId: ordered[0].id,
        date,
        messageKey: "conflict.arrival",
        params: {
          time: trip.arrivalTime,
          airport: trip.arrivalAirport ?? "",
        },
      });
    }
  }

  if (date === trip.endDate && ordered.length) {
    const last = ordered[ordered.length - 1];
    if (last.endTime) {
      const leaveBy = addMinutes(trip.departureTime, -150);
      if (minutesBetween(leaveBy, last.endTime) > 0) {
        conflicts.push({
          id: `depart-${last.id}`,
          kind: "departure",
          severity: "error",
          itemId: last.id,
          date,
          messageKey: "conflict.departure",
          params: {
            end: last.endTime,
            time: trip.departureTime,
            airport: trip.departureAirport ?? "",
          },
        });
      }
    }
  }

  return unique(conflicts);
}

function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = ((h * 60 + m + min) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function unique(list: PlanningConflict[]): PlanningConflict[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}
