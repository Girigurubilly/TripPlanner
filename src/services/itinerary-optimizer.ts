import { centroid, haversineM } from "@/lib/geo";
import type {
  DayStats,
  ItineraryItem,
  OptimizationProposal,
  Place,
  Trip,
} from "@/types/trip";

export type OptimizeInput = {
  trip: Trip;
  places: Place[];
  items: ItineraryItem[];
  dayStats: DayStats[];
};

export interface ItineraryOptimizer {
  suggest(input: OptimizeInput): OptimizationProposal[];
}

export class MockItineraryOptimizer implements ItineraryOptimizer {
  suggest(input: OptimizeInput): OptimizationProposal[] {
    const { trip, places, items, dayStats } = input;
    const byId = new Map(places.map((p) => [p.id, p]));
    const tripPlaces = places.filter((p) => trip.placeIds.includes(p.id) && p.category !== "hotel");
    const assignedIds = new Set(items.map((i) => i.placeId));
    const unassigned = tripPlaces.filter((p) => !assignedIds.has(p.id));
    const proposals: OptimizationProposal[] = [];

    const dayCentroids = new Map<string, { lat: number; lng: number }>();
    for (const date of [...new Set(items.map((i) => i.date))]) {
      const pts = items
        .filter((i) => i.date === date)
        .map((i) => byId.get(i.placeId))
        .filter((p): p is Place => Boolean(p));
      const c = centroid(pts);
      if (c) dayCentroids.set(date, c);
    }

    for (const place of unassigned.filter((p) => p.priority === "must-do" || p.priority === "want")) {
      let bestDate: string | undefined;
      let bestD = Infinity;
      for (const [date, c] of dayCentroids) {
        const d = haversineM(place, c);
        if (d < bestD) {
          bestD = d;
          bestDate = date;
        }
      }
      if (bestDate && bestD < 2500) {
        proposals.push({
          id: `assign-${place.id}-${bestDate}`,
          kind: "assign",
          titleKey: "optimize.assignTitle",
          detailKey: "optimize.assignDetail",
          params: {
            name: place.name,
            date: bestDate,
            neighbourhood: place.neighbourhood,
            meters: Math.round(bestD),
            duration: place.estimatedDurationMin,
          },
          tripId: trip.id,
          placeIds: [place.id],
          toDate: bestDate,
        });
      }
    }

    const overloaded = dayStats.filter((d) => d.load === "overloaded");
    const light = dayStats
      .filter((d) => d.load === "comfortable")
      .sort((a, b) => a.activityMin - b.activityMin);

    for (const day of overloaded) {
      const movable = items
        .filter((i) => i.date === day.date && !i.locked)
        .map((i) => ({ item: i, place: byId.get(i.placeId) }))
        .filter((x) => x.place && x.place.priority !== "must-do")
        .sort((a, b) => (a.place!.priority === "if-time" ? -1 : 1));
      const target = light[0];
      const pick = movable[0];
      if (pick?.place && target) {
        proposals.push({
          id: `move-${pick.item.id}-${target.date}`,
          kind: "move",
          titleKey: "optimize.moveTitle",
          detailKey: "optimize.moveDetail",
          params: {
            name: pick.place.name,
            from: day.date,
            to: target.date,
            hours: Math.round((day.activityMin + day.travelMin) / 60),
          },
          tripId: trip.id,
          placeIds: [pick.place.id],
          fromDate: day.date,
          toDate: target.date,
        });
      }
    }

    const clusters = clusterPlaces(
      unassigned.filter((p) => p.priority !== "skip"),
      1400,
    );
    for (const group of clusters.filter((g) => g.length >= 3)) {
      proposals.push({
        id: `cluster-${group.map((p) => p.id).join("-")}`,
        kind: "cluster",
        titleKey: "optimize.clusterTitle",
        detailKey: "optimize.clusterDetail",
        params: {
          count: group.length,
          names: group.map((p) => p.name).join(", "),
          areas: [...new Set(group.map((p) => p.neighbourhood))].join(" / "),
        },
        tripId: trip.id,
        placeIds: group.map((p) => p.id),
      });
    }

    for (const [date] of dayCentroids) {
      const dayItems = items
        .filter((i) => i.date === date)
        .sort((a, b) => a.order - b.order);
      if (dayItems.length < 3) continue;
      const orderedPlaces = dayItems
        .map((i) => byId.get(i.placeId))
        .filter((p): p is Place => Boolean(p));
      const nn = nearestNeighborOrder(orderedPlaces);
      const current = pathLength(orderedPlaces);
      const improved = pathLength(nn);
      if (improved + 400 < current) {
        proposals.push({
          id: `reorder-${date}`,
          kind: "reorder",
          titleKey: "optimize.reorderTitle",
          detailKey: "optimize.reorderDetail",
          params: {
            date,
            km: Math.round((current - improved) / 100) / 10,
          },
          tripId: trip.id,
          placeIds: nn.map((p) => p.id),
          toDate: date,
          suggestedOrder: nn.map((p) => p.id),
        });
      }
    }

    const seen = new Set<string>();
    return proposals.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    }).slice(0, 8);
  }
}

function clusterPlaces(places: Place[], radiusM: number): Place[][] {
  const unused = [...places];
  const groups: Place[][] = [];
  while (unused.length) {
    const seed = unused.shift()!;
    const group = [seed];
    for (let i = unused.length - 1; i >= 0; i--) {
      if (group.some((g) => haversineM(g, unused[i]) <= radiusM)) {
        group.push(unused[i]);
        unused.splice(i, 1);
      }
    }
    groups.push(group);
  }
  return groups;
}

function nearestNeighborOrder(places: Place[]): Place[] {
  if (places.length <= 1) return places;
  const remaining = [...places];
  const path = [remaining.shift()!];
  while (remaining.length) {
    const last = path[path.length - 1];
    remaining.sort((a, b) => haversineM(last, a) - haversineM(last, b));
    path.push(remaining.shift()!);
  }
  return path;
}

function pathLength(places: Place[]): number {
  let n = 0;
  for (let i = 1; i < places.length; i++) n += haversineM(places[i - 1], places[i]);
  return n;
}

export const itineraryOptimizer: ItineraryOptimizer = new MockItineraryOptimizer();
