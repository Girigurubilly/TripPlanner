import { Link, useNavigate } from "@tanstack/react-router";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { Badge, LoadChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Meter } from "@/components/ui/meter";
import { countdownParts, tripDates } from "@/lib/datetime";
import { formatDayHeading, formatDurationI18n } from "@/i18n/format";
import { buildInsights } from "@/lib/insights";
import { useTripStore } from "@/store/trip-store";
import { useI18n, type MessageKey } from "@/i18n";
import { tripDestinationLabel } from "@/lib/trip-label";

export function TripOverview({ tripId }: { tripId: string }) {
  const trip = useTripStore((s) => s.trips.find((t) => t.id === tripId));
  const places = useTripStore((s) => s.places);
  const allItems = useTripStore((s) => s.items);
  const allBookings = useTripStore((s) => s.bookings);
  const deleteTrip = useTripStore((s) => s.deleteTrip);
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const items = allItems.filter((i) => i.tripId === tripId);
  const bookings = allBookings.filter((b) => b.tripId === tripId);
  if (!trip) return null;

  const { insights, dayStats, conflicts } = buildInsights(trip, places, items);
  const assigned = new Set(items.map((i) => i.placeId));
  const linked = places.filter((p) => trip.placeIds.includes(p.id) && p.category !== "hotel");
  const coverage = linked.length ? Math.round((assigned.size / linked.length) * 100) : 0;
  const count = countdownParts(trip.startDate, trip.timezone);
  const nights = Math.max(0, differenceInCalendarDays(parseISO(trip.endDate), parseISO(trip.startDate)));
  const bookingTypes = new Set(bookings.map((b) => b.type));
  const bookingHealth = ["flight", "hotel"].every((x) => bookingTypes.has(x as never))
    ? t("overview.coreIn")
    : t("overview.missingCore");

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="tc-enter flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-muted uppercase">{tripDestinationLabel(trip, locale)}</p>
          <h1 className="font-display text-4xl">{trip.name}</h1>
          <p className="mt-2 text-sm text-muted">
            {formatDayHeading(trip.startDate, locale)} – {formatDayHeading(trip.endDate, locale)} · {nights} {t("common.nights")} · {trip.timezone}
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button asChild className="min-h-11 flex-1 sm:flex-none">
            <Link to="/trips/$tripId/plan" params={{ tripId: trip.id }}>
              {t("overview.openPlan")}
            </Link>
          </Button>
          <Button variant="secondary" asChild className="min-h-11 flex-1 sm:flex-none">
            <Link to="/trips/$tripId/map" params={{ tripId: trip.id }}>
              {t("overview.dailyMap")}
            </Link>
          </Button>
          <Button variant="danger" className="min-h-11 w-full sm:w-auto" onClick={() => setConfirmOpen(true)}>
            {t("overview.deleteTrip")}
          </Button>
        </div>
      </div>

      <div className="tc-stagger grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted">{count.started ? t("overview.underway") : t("overview.countdown")}</p>
          <div className="mt-2 flex gap-4 font-display text-3xl tabular-nums">
            <Unit n={count.days} l={t("common.days")} />
            <Unit n={count.hours} l={t("common.hrs")} />
            <Unit n={count.minutes} l={t("common.min")} />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("overview.health")}</p>
          <p className="mt-2 font-display text-3xl tabular-nums">{coverage}%</p>
          <Meter value={coverage} className="mt-2" />
          <p className="mt-2 text-sm text-muted">{t("overview.coverageDetail", { assigned: assigned.size, total: linked.length })}</p>
          <p className="mt-2 text-sm">
            {conflicts.length ? (
              <span className="text-warn">{t("overview.flags", { n: conflicts.length })}</span>
            ) : (
              <span className="text-ok">{t("overview.noConflicts")}</span>
            )}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("overview.bookings")}</p>
          <p className="mt-2 font-display text-3xl tabular-nums">{bookings.length}</p>
          <p className="text-sm text-muted">{bookingHealth}</p>
          <p className="mt-2 text-xs text-muted">
            {t("overview.airports", {
              arrive: trip.arrivalAirport ?? "",
              at: trip.arrivalTime,
              depart: trip.departureAirport ?? "",
              dt: trip.departureTime,
            })}
          </p>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-4">
          <h2 className="font-display text-xl">{t("overview.days")}</h2>
          <ul className="mt-3 divide-y divide-line">
            {dayStats.map((d) => (
              <li key={d.date} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatDayHeading(d.date, locale)}</p>
                  <p className="text-xs text-muted">
                    {t("overview.dayMeta", {
                      stops: d.itemCount,
                      activity: formatDurationI18n(d.activityMin, t),
                      travel: formatDurationI18n(d.travelMin, t),
                    })}
                  </p>
                </div>
                <LoadChip load={d.load} />
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-4">
          <h2 className="font-display text-xl">{t("overview.stayPace")}</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {trip.hotels.map((h) => (
              <li key={h.id}>
                <p className="font-medium">{h.name}</p>
                <p className="text-xs text-muted">
                  {h.checkInDate} {h.checkInTime} → {h.checkOutDate} {h.checkOutTime}
                </p>
              </li>
            ))}
            <li className="flex flex-wrap gap-2">
              <Badge>{t("overview.paceChip", { pace: t(`pace.${trip.pace}` as MessageKey) })}</Badge>
              <Badge>{t(`transport.${trip.preferredTransport}`)}</Badge>
            </li>
          </ul>
          <div className="mt-4 space-y-2">
            {insights.slice(0, 4).map((ins) => (
              <p key={ins.id} className="text-sm text-ink-soft">
                {t(ins.titleKey, localizeDateParams(ins.params, locale))}
              </p>
            ))}
          </div>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("overview.deleteTrip")}</DialogTitle>
            <DialogDescription>{t("dashboard.deleteConfirm", { name: trip.name })}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" className="min-h-11" onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              className="min-h-11"
              onClick={() => {
                deleteTrip(trip.id);
                toast.success(t("dashboard.deleted", { name: trip.name }));
                void navigate({ to: "/" });
              }}
            >
              {t("common.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Unit({ n, l }: { n: number; l: string }) {
  return (
    <div>
      <div>{n}</div>
      <div className="text-xs font-sans tracking-wide text-muted uppercase">{l}</div>
    </div>
  );
}

function localizeDateParams(params: Record<string, string | number>, locale: Parameters<typeof formatDayHeading>[1]) {
  const next = { ...params };
  if (typeof next.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(next.date)) {
    next.date = formatDayHeading(next.date, locale);
  }
  return next;
}
