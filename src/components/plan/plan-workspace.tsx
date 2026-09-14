import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock, LockOpen, Trash2, Waypoints } from "lucide-react";
import { toast } from "sonner";
import { TripMap } from "@/components/map/trip-map";
import { PlacePhoto } from "@/components/places/place-photo";
import { Badge, LoadChip, PriorityChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TimeSelect } from "@/components/trips/time-select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { findConflicts } from "@/lib/conflicts";
import { tripDates } from "@/lib/datetime";
import { formatDayHeading, formatDistanceI18n, formatDurationI18n } from "@/i18n/format";
import { dayStatsFor, hotelForDate } from "@/lib/planning";
import { itineraryOptimizer } from "@/services/itinerary-optimizer";
import { useTripStore } from "@/store/trip-store";
import { cn } from "@/lib/utils";
import { useI18n, type Locale, type MessageKey, type Translate } from "@/i18n";
import type { OptimizationProposal, Place, TransportMode } from "@/types/trip";

export function PlanWorkspace({ tripId }: { tripId: string }) {
  const trip = useTripStore((s) => s.trips.find((t) => t.id === tripId));
  const places = useTripStore((s) => s.places);
  const allItems = useTripStore((s) => s.items);
  const items = allItems.filter((i) => i.tripId === tripId);
  const assignPlacesToDate = useTripStore((s) => s.assignPlacesToDate);
  const moveItem = useTripStore((s) => s.moveItem);
  const reorderDay = useTripStore((s) => s.reorderDay);
  const unassignItem = useTripStore((s) => s.unassignItem);
  const updateItem = useTripStore((s) => s.updateItem);
  const { t, locale } = useI18n();
  const [selectedDate, setSelectedDate] = useState(trip?.startDate ?? "");
  const [query, setQuery] = useState("");
  const [proposals, setProposals] = useState<OptimizationProposal[] | null>(null);
  const [mobile, setMobile] = useState<"pool" | "timeline" | "map">("timeline");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);

  if (!trip) return null;
  const dates = tripDates(trip.startDate, trip.endDate);
  const assigned = new Set(items.map((i) => i.placeId));
  const unassigned = places.filter((p) => trip.placeIds.includes(p.id) && !assigned.has(p.id) && p.category !== "hotel");
  const filteredPool = unassigned.filter((p) => {
    if (!query.trim()) return true;
    return `${p.name} ${p.neighbourhood}`.toLowerCase().includes(query.toLowerCase());
  });

  const selectedItems = items.filter((i) => i.date === selectedDate).sort((a, b) => a.order - b.order);
  const stats = dates.map((d) =>
    dayStatsFor(
      d,
      items.filter((i) => i.date === d),
      trip.pace,
    ),
  );
  const conflicts = findConflicts(trip, selectedDate, selectedItems, byId);
  const hotel = hotelForDate(trip, selectedDate);

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !trip) return;
    const overId = String(over.id);
    const activeId = String(active.id);
    const date = overId.startsWith("day:")
      ? overId.slice(4)
      : overId.startsWith("item:")
        ? items.find((i) => i.id === overId.slice(5))?.date
        : overId === "unassigned"
          ? undefined
          : undefined;

    if (activeId.startsWith("place:")) {
      const placeId = activeId.slice(6);
      if (date) {
        await assignPlacesToDate(trip.id, [placeId], date);
        setSelectedDate(date);
      }
      return;
    }
    if (activeId.startsWith("item:")) {
      const itemId = activeId.slice(5);
      if (overId === "unassigned") {
        await unassignItem(itemId);
        return;
      }
      if (date) {
        const dayItems = items.filter((i) => i.date === date && i.id !== itemId).sort((a, b) => a.order - b.order);
        let index = dayItems.length;
        if (overId.startsWith("item:")) {
          const overItem = overId.slice(5);
          const found = dayItems.findIndex((i) => i.id === overItem);
          if (found >= 0) index = found;
        }
        await moveItem(itemId, date, index);
        setSelectedDate(date);
      }
    }
  }

  function suggest() {
    if (!trip) return;
    const list = itineraryOptimizer.suggest({
      trip,
      places,
      items,
      dayStats: stats,
    });
    setProposals(list);
    if (!list.length) toast.message(t("plan.none"));
  }

  async function applyProposal(p: OptimizationProposal) {
    if (!trip) return;
    if (p.kind === "assign" && p.toDate) {
      await assignPlacesToDate(trip.id, p.placeIds, p.toDate);
    } else if (p.kind === "move" && p.toDate) {
      const item = items.find((i) => p.placeIds.includes(i.placeId));
      if (item) await moveItem(item.id, p.toDate, 99);
    } else if (p.kind === "reorder" && p.toDate && p.suggestedOrder) {
      const orderedIds = p.suggestedOrder
        .map((pid) => items.find((i) => i.placeId === pid && i.date === p.toDate)?.id)
        .filter((x): x is string => Boolean(x));
      await reorderDay(trip.id, p.toDate, orderedIds);
    } else if (p.kind === "cluster") {
      toast.message(t("plan.clusterHint"));
    }
    setProposals((list) => list?.filter((x) => x.id !== p.id) ?? null);
    toast.success(t("plan.applied"));
  }

  const mapStops = selectedItems
    .map((it, i) => {
      const place = byId.get(it.placeId);
      if (!place) return null;
      return { id: it.id, lat: place.lat, lng: place.lng, name: place.name, number: i + 1, kind: "stop" as const };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const mapLegs = selectedItems.slice(1).map((it, i) => {
    const from = byId.get(selectedItems[i].placeId)!;
    const to = byId.get(it.placeId)!;
    return {
      from: { lat: from.lat, lng: from.lng },
      to: { lat: to.lat, lng: to.lng },
      mode: it.transportFromPrevious?.mode ?? trip.preferredTransport,
    };
  });

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={(e) => void onDragEnd(e)}>
      <div className="flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top)-5.5rem-env(safe-area-inset-bottom))] flex-col lg:h-[calc(100dvh-3.5rem-env(safe-area-inset-top))]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-3 sm:px-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl">{t("plan.title")}</h1>
            <p className="hidden text-xs text-muted sm:block">{t("plan.subtitle")}</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="flex min-h-11 flex-1 rounded-lg bg-surface-2 p-1 lg:hidden">
              {(["pool", "timeline", "map"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={cn(
                    "h-9 flex-1 rounded-md px-2 text-xs capitalize transition-colors duration-150",
                    mobile === k && "bg-surface text-ink shadow-soft",
                  )}
                  onClick={() => setMobile(k)}
                >
                  {k === "pool" ? t("plan.saved") : k === "timeline" ? t("plan.timeline") : t("plan.map")}
                </button>
              ))}
            </div>
            <Button size="sm" className="min-h-11 shrink-0 px-3" onClick={suggest}>
              <Waypoints className="size-4" />
              <span className="sm:hidden">{t("plan.suggest")}</span>
              <span className="hidden sm:inline">{t("plan.suggestLong")}</span>
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)_340px]">
          <section className={cn("min-h-0 overflow-y-auto border-r border-line p-3", mobile !== "pool" && "hidden lg:block")}>
            <UnassignedColumn query={query} onQuery={setQuery} places={filteredPool} t={t} />
          </section>

          <section className={cn("min-h-0 overflow-y-auto p-3", mobile !== "timeline" && "hidden lg:block")}>
            <div className="space-y-3">
              {dates.map((date) => {
                const dayItems = items.filter((i) => i.date === date).sort((a, b) => a.order - b.order);
                const st = stats.find((s) => s.date === date)!;
                return (
                  <DayColumn
                    key={date}
                    date={date}
                    selected={selectedDate === date}
                    onSelect={() => setSelectedDate(date)}
                    items={dayItems}
                    placesById={byId}
                    activityMin={st.activityMin}
                    travelMin={st.travelMin}
                    walkDistanceM={st.walkDistanceM}
                    load={st.load}
                    onUnassign={(id) => void unassignItem(id)}
                    onUpdate={(id, patch) => void updateItem(id, patch)}
                    t={t}
                    locale={locale}
                  />
                );
              })}
            </div>
          </section>

          <section className={cn("min-h-0 border-l border-line", mobile !== "map" && "hidden lg:flex lg:flex-col", mobile === "map" && "flex flex-col")}>
            <div className="min-h-64 flex-1">
              <TripMap className="h-full min-h-72" hotel={hotel} stops={mapStops} legs={mapLegs} />
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto border-t border-line p-3">
              <p className="text-xs font-medium text-muted">{t("plan.flagsFor", { date: formatDayHeading(selectedDate, locale) })}</p>
              {conflicts.length ? (
                conflicts.map((c) => (
                  <p key={c.id} className={cn("text-xs", c.severity === "error" ? "text-danger" : "text-warn")}>
                    {formatConflict(c, t, locale)}
                  </p>
                ))
              ) : (
                <p className="text-xs text-muted">{t("plan.noFlags")}</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <Sheet open={Boolean(proposals)} onOpenChange={(o) => !o && setProposals(null)}>
        <SheetContent className="p-5">
          <h2 className="font-display pr-10 text-2xl">{t("plan.review")}</h2>
          <p className="mt-1 text-sm text-muted">{t("plan.reviewHint")}</p>
          <ul className="mt-4 space-y-3 overflow-y-auto">
            {(proposals ?? []).map((p) => (
              <li key={p.id} className="rounded-lg border border-line p-3">
                <p className="text-sm font-medium">{t(p.titleKey, localizeProposal(p.params, locale))}</p>
                <p className="mt-1 text-xs text-muted">{t(p.detailKey, localizeProposal(p.params, locale))}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="min-h-11 sm:min-h-8" onClick={() => void applyProposal(p)}>
                    {t("plan.accept")}
                  </Button>
                  <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => setProposals((list) => list?.filter((x) => x.id !== p.id) ?? null)}>
                    {t("plan.reject")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </DndContext>
  );
}

function UnassignedColumn({
  query,
  onQuery,
  places,
  t,
}: {
  query: string;
  onQuery: (v: string) => void;
  places: Place[];
  t: Translate;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned" });
  return (
    <div ref={setNodeRef} className={cn("flex h-full flex-col gap-2 rounded-lg p-1", isOver && "bg-accent-soft")}>
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{t("plan.unassigned")}</p>
      <Input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={t("plan.filterPlaces")} className="h-11 sm:h-9" />
      <SortableContext items={places.map((p) => `place:${p.id}`)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {places.map((place) => (
            <SortablePlace key={place.id} place={place} t={t} />
          ))}
        </ul>
      </SortableContext>
      {!places.length ? <p className="text-xs text-muted">{t("plan.allAssigned")}</p> : null}
    </div>
  );
}

function SortablePlace({ place, t }: { place: Place; t: Translate }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `place:${place.id}`,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-md border border-line bg-surface p-2", isDragging && "opacity-60")}
    >
      <div className="flex items-start gap-1">
        <button type="button" className="mt-0.5 min-h-11 min-w-8 text-faint sm:min-h-0" {...attributes} {...listeners} aria-label={t("common.drag")}>
          <GripVertical className="size-4" />
        </button>
        <PlacePhoto
          name={place.name}
          neighbourhood={place.neighbourhood}
          photos={place.photos}
          category={place.category}
          className="size-11 shrink-0 rounded-md"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{place.name}</p>
          <p className="text-xs text-muted">
            {place.neighbourhood} · {formatDurationI18n(place.estimatedDurationMin, t)}
          </p>
        </div>
      </div>
    </li>
  );
}

function DayColumn({
  date,
  selected,
  onSelect,
  items,
  placesById,
  activityMin,
  travelMin,
  walkDistanceM,
  load,
  onUnassign,
  onUpdate,
  t,
  locale,
}: {
  date: string;
  selected: boolean;
  onSelect: () => void;
  items: { id: string; placeId: string; startTime: string; endTime: string; durationMin: number; notes: string; locked: boolean; priority: Place["priority"]; transportFromPrevious?: { mode: TransportMode; durationMin: number; distanceM: number } }[];
  placesById: Map<string, Place>;
  activityMin: number;
  travelMin: number;
  walkDistanceM: number;
  load: "comfortable" | "busy" | "overloaded";
  onUnassign: (id: string) => void;
  onUpdate: (id: string, patch: { locked?: boolean; notes?: string; startTime?: string; endTime?: string; durationMin?: number }) => void;
  t: Translate;
  locale: Locale;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });
  return (
    <Card
      className={cn("p-3 transition-colors duration-150", selected ? "border-accent" : "", isOver ? "bg-accent-soft/40" : "")}
      onClick={onSelect}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg">{formatDayHeading(date, locale)}</p>
          <p className="text-xs text-muted">
            {t("plan.dayMeta", {
              activity: formatDurationI18n(activityMin, t),
              travel: formatDurationI18n(travelMin, t),
              walk: formatDistanceI18n(walkDistanceM, t),
            })}
          </p>
        </div>
        <LoadChip load={load} />
      </div>
      <div ref={setNodeRef} className="mt-3 space-y-2">
        <SortableContext items={items.map((i) => `item:${i.id}`)} strategy={verticalListSortingStrategy}>
          {items.map((item, index) => {
            const place = placesById.get(item.placeId);
            if (!place) return null;
            return (
              <SortableItem
                key={item.id}
                item={item}
                place={place}
                index={index}
                onUnassign={onUnassign}
                onUpdate={onUpdate}
                t={t}
              />
            );
          })}
        </SortableContext>
        {!items.length ? <p className="rounded-md border border-dashed border-line-strong px-3 py-6 text-center text-xs text-muted">{t("plan.dropHere")}</p> : null}
      </div>
    </Card>
  );
}

function SortableItem({
  item,
  place,
  index,
  onUnassign,
  onUpdate,
  t,
}: {
  item: {
    id: string;
    startTime: string;
    endTime: string;
    durationMin: number;
    notes: string;
    locked: boolean;
    priority: Place["priority"];
    transportFromPrevious?: { mode: TransportMode; durationMin: number; distanceM: number };
  };
  place: Place;
  index: number;
  onUnassign: (id: string) => void;
  onUpdate: (id: string, patch: { locked?: boolean; notes?: string; startTime?: string; endTime?: string; durationMin?: number }) => void;
  t: Translate;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `item:${item.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-md border border-line bg-surface-2 p-2", isDragging && "opacity-60")}
      onClick={(e) => e.stopPropagation()}
    >
      {item.transportFromPrevious && index > 0 ? (
        <p className="mb-1 pl-7 text-xs text-muted">
          {t(`transport.${item.transportFromPrevious.mode}`)} · {formatDurationI18n(item.transportFromPrevious.durationMin, t)} · {formatDistanceI18n(item.transportFromPrevious.distanceM, t)}
        </p>
      ) : null}
      <div className="flex items-start gap-2">
        <button type="button" className="mt-1 min-h-11 min-w-8 text-faint sm:min-h-0" {...attributes} {...listeners} aria-label={t("common.reorder")}>
          <GripVertical className="size-4" />
        </button>
        <span className="mt-0.5 grid size-6 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-fg">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium">{place.name}</p>
            <PriorityChip priority={item.priority} />
            {item.locked ? <Badge>{t("plan.locked")}</Badge> : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TimeSelect
              value={item.startTime}
              disabled={item.locked}
              className="w-32"
              inputClassName="h-11 w-32 sm:h-8"
              onChange={(time) => onUpdate(item.id, { startTime: time, locked: true })}
            />
            <span className="text-xs text-muted">–</span>
            <TimeSelect
              value={item.endTime}
              disabled={item.locked}
              className="w-32"
              inputClassName="h-11 w-32 sm:h-8"
              onChange={(time) => onUpdate(item.id, { endTime: time, locked: true })}
            />
            <Input
              type="number"
              value={item.durationMin}
              className="h-11 w-24 sm:h-8 sm:w-20"
              onChange={(e) => onUpdate(item.id, { durationMin: Number(e.target.value) })}
              aria-label={t("plan.durationMin")}
            />
          </div>
          <Input
            value={item.notes}
            placeholder={t("common.notes")}
            className="mt-2 h-11 sm:h-8"
            onChange={(e) => onUpdate(item.id, { notes: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Button size="icon" variant="ghost" className="min-h-11 min-w-11 sm:size-8 sm:min-h-8 sm:min-w-8" onClick={() => onUpdate(item.id, { locked: !item.locked })} aria-label={item.locked ? t("common.unlock") : t("common.lock")}>
            {item.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="min-h-11 min-w-11 sm:size-8 sm:min-h-8 sm:min-w-8" onClick={() => onUnassign(item.id)} aria-label={t("common.removeFromDay")}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function localizeProposal(params: Record<string, string | number>, locale: Locale) {
  const next = { ...params };
  for (const key of ["date", "from", "to"] as const) {
    const value = next[key];
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      next[key] = formatDayHeading(value, locale);
    }
  }
  return next;
}

function formatConflict(
  c: { messageKey: MessageKey; params: Record<string, string | number> },
  t: Translate,
  locale: Locale,
) {
  const params = { ...c.params };
  if (!params.name) params.name = t("conflict.previousStop");
  if (params.airport === "") params.airport = t("conflict.theAirport");
  if (typeof params.mode === "string") params.mode = t(`transport.${params.mode}` as MessageKey);
  if (typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    params.date = formatDayHeading(params.date, locale);
  }
  return t(c.messageKey, params);
}
