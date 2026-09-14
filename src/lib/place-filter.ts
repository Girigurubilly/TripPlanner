import { isOpenOn, todayInZone } from "@/lib/datetime";
import type { PlaceFilterState } from "@/components/places/place-filters";
import type { Place } from "@/types/trip";

export function filterPlaces(
  places: Place[],
  filters: PlaceFilterState,
  assignedIds: Set<string>,
  timezone = "Asia/Tokyo",
): Place[] {
  const q = filters.q.trim().toLowerCase();
  return places.filter((p) => {
    if (q) {
      const hay = `${p.name} ${p.address} ${p.neighbourhood} ${p.tags.join(" ")} ${p.notes}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.category !== "all" && p.category !== filters.category) return false;
    if (filters.neighbourhood !== "all" && p.neighbourhood !== filters.neighbourhood) return false;
    if (filters.priority !== "all" && p.priority !== filters.priority) return false;
    if (filters.assigned === "assigned" && !assignedIds.has(p.id)) return false;
    if (filters.assigned === "unassigned" && assignedIds.has(p.id)) return false;
    if (filters.indoor !== "all" && p.indoorOutdoor !== filters.indoor) return false;
    if (filters.hours === "known" && !p.openingHours) return false;
    if (filters.hours === "unknown" && p.openingHours) return false;
    if (filters.hours === "open") {
      const today = todayInZone(timezone);
      if (isOpenOn(p.openingHours, today) !== "open") return false;
    }
    if (filters.tag !== "all" && !p.tags.includes(filters.tag)) return false;
    return true;
  });
}
