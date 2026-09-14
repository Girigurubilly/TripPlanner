import { useMemo, useRef, useState } from "react";
import { Download, List, Map as MapIcon, MapPinned, MoreHorizontal, Plus, SlidersHorizontal, Upload } from "lucide-react";
import { toast } from "sonner";
import { AddPlaceDialog } from "@/components/places/add-place-dialog";
import { ImportMapsDialog } from "@/components/places/import-maps-dialog";
import { PlaceCard } from "@/components/places/place-card";
import { EMPTY_FILTERS, PlaceFilters } from "@/components/places/place-filters";
import { TripMap } from "@/components/map/trip-map";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { filterPlaces } from "@/lib/place-filter";
import { downloadText, uid } from "@/lib/utils";
import { tripDates } from "@/lib/datetime";
import { importExportService } from "@/services/import-export";
import { useTripStore } from "@/store/trip-store";
import { useI18n } from "@/i18n";

export function PlacesHub({ tripId }: { tripId?: string }) {
  const places = useTripStore((s) => s.places);
  const trips = useTripStore((s) => s.trips);
  const allItems = useTripStore((s) => s.items);
  const importPlaces = useTripStore((s) => s.importPlaces);
  const assignPlacesToDate = useTripStore((s) => s.assignPlacesToDate);
  const { t } = useI18n();
  const trip = trips.find((x) => x.id === tripId);
  const scoped = trip ? places.filter((p) => trip.placeIds.includes(p.id)) : places;
  const assignedIds = useMemo(() => {
    const ids = allItems
      .filter((i) => !tripId || i.tripId === tripId)
      .map((i) => i.placeId);
    return new Set(ids);
  }, [allItems, tripId]);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [assignDate, setAssignDate] = useState(trip?.startDate ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const kmlRef = useRef<HTMLInputElement>(null);

  const neighbourhoods = [...new Set(scoped.map((p) => p.neighbourhood).filter(Boolean))].sort();
  const tags = [...new Set(scoped.flatMap((p) => p.tags))].sort();
  const visible = filterPlaces(scoped, filters, assignedIds, trip?.timezone);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function onFile(file: File) {
    const text = await file.text();
    try {
      const imported = file.name.endsWith(".json")
        ? importExportService.importPlacesJson(text)
        : importExportService.importPlacesCsv(text);
      importPlaces(
        imported.map((p) => ({ ...p, id: p.id || uid("place") })),
        tripId,
      );
      toast.success(t("places.imported", { n: imported.length }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("places.importFailed"));
    }
  }

  async function onKml(file: File) {
    try {
      const parsed = await importExportService.importMapsFile(file);
      if (!parsed.places.length) {
        toast.error(t("mapsImport.emptyFile"));
        return;
      }
      importPlaces(
        parsed.places.map((p) => ({ ...p, id: p.id || uid("place") })),
        tripId,
      );
      toast.success(t("places.imported", { n: parsed.places.length }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("places.importFailed"));
    }
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="tc-enter flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl">{t("places.title")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("places.shown", {
              shown: visible.length,
              total: scoped.length,
              scope: trip ? trip.name : t("places.libraryScope"),
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" className="min-h-11 sm:min-h-8" onClick={() => setView(view === "list" ? "map" : "list")}>
            {view === "list" ? <MapIcon /> : <List />}
            {view === "list" ? t("places.map") : t("places.list")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="min-h-11 sm:hidden"
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal />
            {showFilters ? t("places.hideFilters") : t("places.showFilters")}
          </Button>
          <div className="flex gap-2 max-sm:hidden">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadText("trip-canvas-places.csv", importExportService.exportPlacesCsv(scoped), "text/csv")
              }
            >
              <Download />
              {t("places.csv")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadText("trip-canvas-places.json", importExportService.exportPlacesJson(scoped), "application/json")
              }
            >
              <Download />
              {t("places.json")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload />
              {t("places.import")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => kmlRef.current?.click()}>
              {t("places.kml")}
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="min-h-11 min-w-11 sm:hidden" aria-label={t("nav.more")}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() =>
                  downloadText("trip-canvas-places.csv", importExportService.exportPlacesCsv(scoped), "text/csv")
                }
              >
                {t("places.csv")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  downloadText("trip-canvas-places.json", importExportService.exportPlacesJson(scoped), "application/json")
                }
              >
                {t("places.json")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => fileRef.current?.click()}>{t("places.import")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => kmlRef.current?.click()}>{t("places.kml")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setMapsOpen(true)}>{t("places.mapsImport")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="secondary" className="min-h-11 sm:min-h-8" onClick={() => setMapsOpen(true)}>
            <MapPinned />
            {t("places.mapsImport")}
          </Button>
          <Button size="sm" className="min-h-11 sm:min-h-8" onClick={() => setAddOpen(true)}>
            <Plus />
            {t("places.add")}
          </Button>
        </div>
      </div>

      <div className={showFilters ? "block" : "hidden sm:block"}>
        <PlaceFilters
          value={filters}
          onChange={setFilters}
          neighbourhoods={neighbourhoods}
          tags={tags}
        />
      </div>

      {selected.length > 0 && trip ? (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <p className="text-sm">{t("common.selected", { count: selected.length })}</p>
          <Select value={assignDate} onChange={(e) => setAssignDate(e.target.value)} className="h-11 w-44 sm:h-9">
            {tripDates(trip.startDate, trip.endDate).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            className="min-h-11 sm:min-h-8"
            onClick={() => {
              void assignPlacesToDate(trip.id, selected, assignDate);
              setSelected([]);
              toast.success(t("places.assignedToast"));
            }}
          >
            {t("places.assign")}
          </Button>
          <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => setSelected([])}>
            {t("common.clear")}
          </Button>
        </Card>
      ) : null}

      {view === "map" ? (
        <Card className="h-[min(70dvh,520px)] overflow-hidden p-0">
          <TripMap
            className="h-full"
            hotel={trip?.hotels[0]}
            stops={visible.map((p) => ({
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              name: p.name,
              kind: "place" as const,
            }))}
            selectedId={selected[0]}
            onSelect={toggle}
          />
        </Card>
      ) : (
        <div className="tc-stagger grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              selected={selected.includes(place.id)}
              onToggle={toggle}
              assigned={assignedIds.has(place.id)}
            />
          ))}
          {!visible.length ? (
            <p className="col-span-full py-12 text-center text-sm text-muted">{t("places.none")}</p>
          ) : null}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.json,text/csv,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={kmlRef}
        type="file"
        accept=".kml,.kmz,application/vnd.google-earth.kml+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onKml(file);
          e.target.value = "";
        }}
      />
      <AddPlaceDialog open={addOpen} onOpenChange={setAddOpen} tripId={tripId} />
      <ImportMapsDialog open={mapsOpen} onOpenChange={setMapsOpen} tripId={tripId} />
    </div>
  );
}
