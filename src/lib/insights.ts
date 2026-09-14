import { centroid, haversineM, maxPairDistance } from "@/lib/geo";
import { tripDates } from "@/lib/datetime";
import { dayStatsFor } from "@/lib/planning";
import { findConflicts } from "@/lib/conflicts";
import type { DayStats, I18nParams, ItineraryItem, Place, PlanningConflict, Trip } from "@/types/trip";
import type { MessageKey } from "@/i18n";

export type Insight = {
  id: string;
  tone: "warn" | "info" | "ok";
  titleKey: MessageKey;
  detailKey: MessageKey;
  params: I18nParams;
  tripId: string;
  placeIds?: string[];
  date?: string;
};

export function buildInsights(
  trip: Trip,
  places: Place[],
  items: ItineraryItem[],
): {
  insights: Insight[];
  dayStats: DayStats[];
  conflicts: PlanningConflict[];
} {
  const byId = new Map(places.map((p) => [p.id, p]));
  const dates = tripDates(trip.startDate, trip.endDate);
  const dayStats: DayStats[] = [];
  const conflicts: PlanningConflict[] = [];
  const tripPlaces = places.filter((p) => trip.placeIds.includes(p.id) && p.category !== "hotel");
  const assigned = new Set(items.map((i) => i.placeId));

  for (const date of dates) {
    const dayItems = items.filter((i) => i.date === date).sort((a, b) => a.order - b.order);
    dayStats.push(dayStatsFor(date, dayItems, trip.pace));
    conflicts.push(...findConflicts(trip, date, dayItems, byId));
  }

  const insights: Insight[] = [];

  const unassignedMust = tripPlaces.filter((p) => !assigned.has(p.id) && p.priority === "must-do");
  if (unassignedMust.length) {
    insights.push({
      id: "unassigned-must",
      tone: "warn",
      titleKey: unassignedMust.length === 1 ? "insights.unassignedMustOne" : "insights.unassignedMust",
      detailKey: "insights.names",
      params: { count: unassignedMust.length, names: unassignedMust.map((p) => p.name).join(" · ") },
      tripId: trip.id,
      placeIds: unassignedMust.map((p) => p.id),
    });
  }

  for (const day of dayStats.filter((d) => d.load === "overloaded")) {
    insights.push({
      id: `over-${day.date}`,
      tone: "warn",
      titleKey: "insights.overloaded",
      detailKey: "insights.overloadedDetail",
      params: {
        date: day.date,
        count: day.itemCount,
        hours: Math.round((day.activityMin + day.travelMin) / 60),
      },
      tripId: trip.id,
      date: day.date,
    });
  }

  const fuzzy = tripPlaces.filter(
    (p) =>
      assigned.has(p.id) &&
      (p.openingHours == null || p.reservationRequired === "unknown") &&
      p.priority !== "skip",
  );
  if (fuzzy.length) {
    insights.push({
      id: "unknown-meta",
      tone: "info",
      titleKey: fuzzy.length === 1 ? "insights.unknownMetaOne" : "insights.unknownMeta",
      detailKey: "insights.names",
      params: { count: fuzzy.length, names: fuzzy.map((p) => p.name).join(" · ") },
      tripId: trip.id,
      placeIds: fuzzy.map((p) => p.id),
    });
  }

  for (const date of dates) {
    const dayItems = items.filter((i) => i.date === date);
    const pts = dayItems.map((i) => byId.get(i.placeId)).filter((p): p is Place => Boolean(p));
    if (pts.length < 3) continue;
    const span = maxPairDistance(pts);
    const c = centroid(pts);
    if (!c) continue;
    const far = pts.filter((p) => haversineM(p, c) > 3500);
    if (span > 9000 || far.length >= 2) {
      insights.push({
        id: `geo-${date}`,
        tone: "warn",
        titleKey: "insights.geoJump",
        detailKey: "insights.geoJumpDetail",
        params: {
          date,
          names: far.map((p) => p.name).join(", ") || pts.map((p) => p.name).join(", "),
        },
        tripId: trip.id,
        date,
        placeIds: pts.map((p) => p.id),
      });
    }
  }

  const unassigned = tripPlaces.filter((p) => !assigned.has(p.id) && p.priority !== "skip");
  const cluster = greedyCluster(unassigned, 1300).filter((g) => g.length >= 3);
  for (const group of cluster.slice(0, 2)) {
    insights.push({
      id: `cluster-${group.map((p) => p.id).join("-")}`,
      tone: "ok",
      titleKey: "insights.clusterTitle",
      detailKey: "insights.clusterDetail",
      params: {
        count: group.length,
        names: group.map((p) => p.name).join(" · "),
        areas: [...new Set(group.map((p) => p.neighbourhood))].join(" / "),
      },
      tripId: trip.id,
      placeIds: group.map((p) => p.id),
    });
  }

  if (!insights.length) {
    insights.push({
      id: "healthy",
      tone: "ok",
      titleKey: "insights.healthy",
      detailKey: "insights.healthyDetail",
      params: {},
      tripId: trip.id,
    });
  }

  return { insights, dayStats, conflicts };
}

function greedyCluster(places: Place[], radiusM: number): Place[][] {
  const unused = [...places];
  const groups: Place[][] = [];
  while (unused.length) {
    const seed = unused.shift()!;
    const group = [seed];
    for (let i = unused.length - 1; i >= 0; i--) {
      if (group.some((g) => haversineM(g, unused[i]) <= radiusM)) {
        group.push(unused.splice(i, 1)[0]);
      }
    }
    groups.push(group);
  }
  return groups.sort((a, b) => b.length - a.length);
}
