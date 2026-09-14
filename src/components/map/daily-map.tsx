import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, SkipForward, Ticket, Undo2, Waypoints } from "lucide-react";
import { toast } from "sonner";
import { TripMap } from "@/components/map/trip-map";
import { Badge, CategoryChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { todayInZone, tripDates } from "@/lib/datetime";
import { formatDayHeading, formatDistanceI18n, formatDurationI18n } from "@/i18n/format";
import { hotelForDate } from "@/lib/planning";
import { useTripStore } from "@/store/trip-store";
import { cn } from "@/lib/utils";
import { useI18n, type MessageKey } from "@/i18n";

export function DailyMap({ tripId }: { tripId: string }) {
  const trip = useTripStore((s) => s.trips.find((x) => x.id === tripId));
  const places = useTripStore((s) => s.places);
  const allItems = useTripStore((s) => s.items);
  const allBookings = useTripStore((s) => s.bookings);
  const items = allItems.filter((i) => i.tripId === tripId);
  const bookings = allBookings.filter((b) => b.tripId === tripId);
  const alternate = useTripStore((s) => s.alternatePlans.find((p) => p.tripId === tripId));
  const updateItem = useTripStore((s) => s.updateItem);
  const assignPlacesToDate = useTripStore((s) => s.assignPlacesToDate);
  const moveItem = useTripStore((s) => s.moveItem);
  const { t, locale } = useI18n();

  const dates = trip ? tripDates(trip.startDate, trip.endDate) : [];
  const today = trip ? todayInZone(trip.timezone) : "";
  const inTrip = dates.includes(today);
  const [date, setDate] = useState(inTrip ? today : (trip?.startDate ?? ""));
  const [rain, setRain] = useState(false);
  const [replan, setReplan] = useState(false);

  const byId = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  if (!trip) return null;

  const hotel = hotelForDate(trip, date);
  const rainIds = rain ? alternate?.dates[date] : undefined;

  const dayItems = rainIds
    ? rainIds.map((placeId, order) => {
        const existing = items.find((i) => i.placeId === placeId);
        const place = byId.get(placeId);
        return (
          existing ?? {
            id: `rain-${placeId}`,
            tripId,
            placeId,
            date,
            order,
            startTime: "",
            endTime: "",
            durationMin: place?.estimatedDurationMin ?? 60,
            notes: "Rain-plan stop",
            priority: place?.priority ?? "want",
            locked: false,
            progressStatus: "pending" as const,
          }
        );
      })
    : items.filter((i) => i.date === date).sort((a, b) => a.order - b.order);

  const next = dayItems.find((i) => i.progressStatus === "pending");
  const nextPlace = next ? byId.get(next.placeId) : undefined;
  const nextBooking = next ? bookings.find((b) => b.itineraryItemId === next.id || b.placeId === next.placeId) : undefined;
  const leaveBy = next?.startTime && next.transportFromPrevious
    ? subtractMin(next.startTime, next.transportFromPrevious.durationMin)
    : next?.startTime;

  const stops = dayItems
    .map((it, i) => {
      const p = byId.get(it.placeId);
      if (!p) return null;
      return { id: it.id, lat: p.lat, lng: p.lng, name: p.name, number: i + 1, kind: "stop" as const };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const legs = dayItems.slice(1).flatMap((it, i) => {
    const from = byId.get(dayItems[i].placeId);
    const to = byId.get(it.placeId);
    if (!from || !to) return [];
    return [
      {
        from: { lat: from.lat, lng: from.lng },
        to: { lat: to.lat, lng: to.lng },
        mode: it.transportFromPrevious?.mode ?? trip.preferredTransport,
      },
    ];
  });

  const unassignedNearby = places.filter(
    (p) => trip.placeIds.includes(p.id) && !items.some((i) => i.placeId === p.id) && p.indoorOutdoor !== "outdoor",
  );

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top)-5.5rem)] flex-col lg:min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] lg:flex-row">
      <div className="relative min-h-[52dvh] flex-1 lg:min-h-[420px]">
        <TripMap className="absolute inset-0 h-full" hotel={hotel} stops={stops} legs={legs} selectedId={next?.id} />
        <div className="tc-hide-scroll absolute top-3 right-3 left-3 flex gap-1.5 overflow-x-auto pb-1">
          {dates.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDate(d)}
              className={cn(
                "h-11 shrink-0 rounded-full border px-3 text-xs font-medium shadow-soft transition-colors duration-150 sm:h-9",
                d === date ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-ink",
              )}
            >
              {formatDayHeading(d, locale)}
              {d === today ? ` · ${t("common.today")}` : ""}
            </button>
          ))}
        </div>
      </div>

      <aside className="w-full shrink-0 border-t border-line bg-surface lg:w-[380px] lg:border-t-0 lg:border-l">
        <div className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs tracking-wide text-muted uppercase">
                {inTrip && date === today ? t("common.today") : formatDayHeading(date, locale)}
              </p>
              <h1 className="font-display text-2xl">{t("map.onGround")}</h1>
              {!inTrip ? (
                <p className="mt-1 text-xs text-muted">{t("map.preview")}</p>
              ) : null}
            </div>
            <Button size="sm" className="min-h-11 shrink-0 sm:min-h-8" variant={rain ? "default" : "secondary"} onClick={() => setRain((v) => !v)}>
              {rain ? t("map.rainOn") : t("map.rain")}
            </Button>
          </div>

          {next && nextPlace ? (
            <Card className="p-4">
              <p className="text-xs text-muted">{t("map.next")}</p>
              <h2 className="mt-1 font-display text-xl">{nextPlace.name}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <CategoryChip category={nextPlace.category} />
                {next.startTime ? <Badge>{next.startTime}–{next.endTime}</Badge> : null}
              </div>
              {leaveBy ? (
                <p className="mt-3 text-sm">
                  {t("map.leaveBy", { time: leaveBy })}
                  {next.transportFromPrevious
                    ? ` · ${t(`transport.${next.transportFromPrevious.mode}` as MessageKey)} ${formatDurationI18n(next.transportFromPrevious.durationMin, t)} / ${formatDistanceI18n(next.transportFromPrevious.distanceM, t)}`
                    : ""}
                </p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button asChild className="min-h-11">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${nextPlace.lat},${nextPlace.lng}&travelmode=${mapsMode(next.transportFromPrevious?.mode ?? trip.preferredTransport)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink />
                    {t("map.googleMaps")}
                  </a>
                </Button>
                {nextBooking ? (
                  <Button variant="secondary" asChild className="min-h-11">
                    <Link to="/trips/$tripId/bookings" params={{ tripId }}>
                      <Ticket />
                      {t("map.booking")}
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" disabled className="min-h-11">
                    <Ticket />
                    {t("map.noBooking")}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="min-h-11"
                  onClick={() => {
                    void updateItem(next.id, { progressStatus: "done" });
                    toast.success(t("map.markedDone"));
                  }}
                  disabled={next.id.startsWith("rain-")}
                >
                  {t("map.markDone")}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    void updateItem(next.id, { progressStatus: "skipped" });
                    toast.message(t("map.skipped"));
                  }}
                  disabled={next.id.startsWith("rain-")}
                >
                  <SkipForward />
                  {t("map.skip")}
                </Button>
              </div>
              <Button className="mt-2 min-h-11 w-full" variant="ghost" onClick={() => setReplan(true)}>
                <Waypoints />
                {t("map.replan")}
              </Button>
            </Card>
          ) : (
            <Card className="p-4 text-sm text-muted">{t("map.allDone")}</Card>
          )}

          <div className="space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">{t("map.legs")}</p>
            {dayItems.map((it, i) => {
              const place = byId.get(it.placeId);
              if (!place) return null;
              return (
                <div key={it.id} className="flex items-start gap-2 text-sm">
                  <span className="grid size-6 place-items-center rounded-full bg-accent text-xs text-accent-fg">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={cn("truncate font-medium", it.progressStatus !== "pending" && "text-muted line-through")}>
                      {place.name}
                    </p>
                    {it.transportFromPrevious && i > 0 ? (
                      <p className="text-xs text-muted">
                        {t(`transport.${it.transportFromPrevious.mode}` as MessageKey)} · {formatDurationI18n(it.transportFromPrevious.durationMin, t)} · {formatDistanceI18n(it.transportFromPrevious.distanceM, t)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted">{it.startTime || t("map.flexible")}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <Sheet open={replan} onOpenChange={setReplan}>
        <SheetContent className="p-5">
          <h2 className="font-display pr-10 text-2xl">{t("map.replanTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("map.replanHint")}</p>
          <ul className="mt-4 space-y-2">
            {unassignedNearby.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-line p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted">{p.neighbourhood} · {t(`indoor.${p.indoorOutdoor}` as MessageKey)}</p>
                </div>
                <Button
                  size="sm"
                  className="min-h-11 shrink-0 sm:min-h-8"
                  onClick={() => {
                    void assignPlacesToDate(trip.id, [p.id], date);
                    setReplan(false);
                    toast.success(t("map.added", { name: p.name }));
                  }}
                >
                  {t("map.addToday")}
                </Button>
              </li>
            ))}
          </ul>
          {next && dates[dates.indexOf(date) + 1] ? (
            <Button
              className="mt-4 min-h-11 w-full"
              variant="secondary"
              onClick={() => {
                void moveItem(next.id, dates[dates.indexOf(date) + 1], 0);
                setReplan(false);
                toast.success(t("map.movedTomorrow"));
              }}
            >
              <Undo2 />
              {t("map.moveTomorrow")}
            </Button>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function subtractMin(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = ((h * 60 + m - min) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function mapsMode(mode: string): string {
  if (mode === "walk") return "walking";
  if (mode === "cycle") return "bicycling";
  if (mode === "transit") return "transit";
  return "driving";
}
