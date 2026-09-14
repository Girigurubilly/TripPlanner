import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Meter } from "@/components/ui/meter";
import { countdownParts, tripDates } from "@/lib/datetime";
import { formatDayHeading } from "@/i18n/format";
import { buildInsights } from "@/lib/insights";
import { tripDestinationLabel } from "@/lib/trip-label";
import { downloadText } from "@/lib/utils";
import { importExportService } from "@/services/import-export";
import { useTripStore } from "@/store/trip-store";
import { useI18n, type MessageKey } from "@/i18n";
import type { Trip } from "@/types/trip";

export function TripsDashboard() {
  const trips = useTripStore((s) => s.trips);
  const places = useTripStore((s) => s.places);
  const items = useTripStore((s) => s.items);
  const exportBackup = useTripStore((s) => s.exportBackup);
  const replaceAll = useTripStore((s) => s.replaceAll);
  const loadSeed = useTripStore((s) => s.loadSeed);
  const deleteTrip = useTripStore((s) => s.deleteTrip);
  const { t, locale } = useI18n();
  const restoreRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Trip | null>(null);

  async function onRestore(file: File) {
    try {
      const data = importExportService.importBackup(await file.text());
      replaceAll(data);
      toast.success(t("dashboard.backupRestored"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dashboard.restoreFailed"));
    }
  }

  function confirmDelete() {
    if (!pending) return;
    deleteTrip(pending.id);
    toast.success(t("dashboard.deleted", { name: pending.name }));
    setPending(null);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="tc-enter flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">{t("dashboard.kicker")}</p>
          <h1 className="mt-1 font-display text-4xl tracking-tight">{t("dashboard.title")}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">{t("dashboard.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="min-h-11">
            <Link to="/trips/new">{t("dashboard.newTrip")}</Link>
          </Button>
          <div className="hidden gap-2 sm:flex">
            <Button
              variant="secondary"
              className="min-h-11"
              onClick={() => downloadText("trip-canvas-backup.json", exportBackup(), "application/json")}
            >
              {t("dashboard.backup")}
            </Button>
            <Button variant="secondary" className="min-h-11" onClick={() => restoreRef.current?.click()}>
              {t("dashboard.restore")}
            </Button>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                loadSeed();
                toast.success(t("dashboard.demoRestored"));
              }}
            >
              {t("dashboard.resetDemo")}
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="min-h-11 min-w-11 sm:hidden" aria-label={t("nav.more")}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => downloadText("trip-canvas-backup.json", exportBackup(), "application/json")}>
                {t("dashboard.backup")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => restoreRef.current?.click()}>{t("dashboard.restore")}</DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  loadSeed();
                  toast.success(t("dashboard.demoRestored"));
                }}
              >
                {t("dashboard.resetDemo")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="tc-stagger grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs text-muted">{t("dashboard.tripsStat", { n: trips.length })}</p>
          <p className="mt-1 font-display text-3xl tabular-nums">{trips.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">{t("dashboard.libraryStat", { n: places.length })}</p>
          <p className="mt-1 font-display text-3xl tabular-nums">{places.length}</p>
        </Card>
      </div>

      {trips.length ? (
        <div className="tc-stagger grid gap-4 md:grid-cols-2">
          {trips.map((trip) => {
            const tripItems = items.filter((i) => i.tripId === trip.id);
            const { dayStats, conflicts } = buildInsights(trip, places, tripItems);
            const count = countdownParts(trip.startDate, trip.timezone);
            const overloaded = dayStats.filter((d) => d.load === "overloaded").length;
            const days = tripDates(trip.startDate, trip.endDate).length;
            const linked = places.filter((p) => trip.placeIds.includes(p.id) && p.category !== "hotel");
            const assigned = new Set(tripItems.map((i) => i.placeId));
            const coverage = linked.length ? Math.round((assigned.size / linked.length) * 100) : 0;
            return (
              <Card key={trip.id} className="tc-card-lift relative h-full overflow-hidden p-0">
                <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="absolute inset-0 z-0" aria-label={trip.name} />
                <div className="relative z-10 pointer-events-none">
                  <div className="flex items-center justify-between gap-3 bg-accent-soft px-5 py-3">
                    <p className="truncate text-xs font-medium tracking-wide text-accent uppercase">
                      {tripDestinationLabel(trip, locale)}
                    </p>
                    <div className="flex items-center gap-1">
                      <Badge tone={overloaded ? "warn" : "ok"}>
                        {overloaded ? t("dashboard.heavyDays", { n: overloaded }) : t("dashboard.onTrack")}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="pointer-events-auto min-h-11 min-w-11 text-muted hover:text-danger sm:size-8"
                        aria-label={t("dashboard.deleteTrip")}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPending(trip);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-5">
                    <h2 className="font-display text-2xl">{trip.name}</h2>
                    <p className="mt-2 text-sm text-ink-soft">
                      {formatDayHeading(trip.startDate, locale)} – {formatDayHeading(trip.endDate, locale)} · {days} {t("common.days")}
                    </p>
                    <div className="mt-4 flex items-end justify-between gap-4">
                      <div className="font-display text-3xl tabular-nums">
                        {count.started ? t("common.now") : count.days}
                        {!count.started ? (
                          <span className="ml-1 font-sans text-xs text-muted">{t("common.days")}</span>
                        ) : null}
                      </div>
                      <div className="min-w-28 flex-1">
                        <p className="text-right text-xs text-muted">{t("dashboard.coverage", { n: coverage })}</p>
                        <Meter value={coverage} className="mt-1" />
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted">
                      {t("dashboard.cardMeta", {
                        stops: tripItems.length,
                        flags: conflicts.length,
                        pace: t(`pace.${trip.pace}` as MessageKey),
                      })}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <h2 className="font-display text-2xl">{t("dashboard.emptyTitle")}</h2>
          <p className="mt-2 text-sm text-muted">{t("dashboard.emptyBody")}</p>
        </Card>
      )}

      <input
        ref={restoreRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onRestore(file);
          e.target.value = "";
        }}
      />

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dashboard.deleteTrip")}</DialogTitle>
            <DialogDescription>{t("dashboard.deleteConfirm", { name: pending?.name ?? "" })}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" className="min-h-11" onClick={() => setPending(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" className="min-h-11" onClick={confirmDelete}>
              {t("common.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

