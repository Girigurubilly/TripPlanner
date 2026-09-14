import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, MapPinned, Upload } from "lucide-react";
import { GOOGLE_MAPS_LISTS, catalogByName, placesFromMapsList, searchResultToPlace, type GoogleMapsList } from "@/data/maps-lists";
import { listLabel } from "@/lib/trip-label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlacePhoto } from "@/components/places/place-photo";
import { CategoryChip } from "@/components/ui/badge";
import { placeProvider } from "@/services/place-provider";
import { parseMapsFile, dedupePlaces } from "@/services/kml";
import { useTripStore } from "@/store/trip-store";
import { useI18n } from "@/i18n";
import type { Place } from "@/types/trip";

export function ImportMapsDialog({
  open,
  onOpenChange,
  tripId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId?: string;
}) {
  const importPlaces = useTripStore((s) => s.importPlaces);
  const existing = useTripStore((s) => s.places);
  const { t, locale } = useI18n();
  const [tab, setTab] = useState("lists");
  const [preview, setPreview] = useState<Place[]>([]);
  const [listName, setListName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const uniquePreview = useMemo(() => dedupePlaces(preview, existing), [preview, existing]);

  function showPreview(places: Place[], name: string) {
    setPreview(places);
    setListName(name);
    setSelected(places.map((p) => p.id));
  }

  function pickList(list: GoogleMapsList) {
    const places = placesFromMapsList(list);
    showPreview(places, listLabel(list.names, locale));
  }

  async function onFile(file: File) {
    setBusy(true);
    try {
      const parsed = await parseMapsFile(file);
      if (!parsed.places.length) {
        toast.error(t("mapsImport.emptyFile"));
        return;
      }
      showPreview(parsed.places, parsed.listName);
      toast.success(t("mapsImport.parsed", { n: parsed.places.length, name: parsed.listName }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("mapsImport.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function parsePaste() {
    const lines = paste
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    try {
      const found: Place[] = [];
      for (const line of lines) {
        if (/^https?:\/\//i.test(line)) {
          const hit = await placeProvider.lookupMapsUrl(line);
          if (hit) found.push(searchResultToPlace(hit, { source: "maps-list" }));
          continue;
        }
        const catalog = catalogByName(line) || (await placeProvider.search(line))[0];
        if (catalog) found.push(searchResultToPlace(catalog, { source: "maps-list" }));
      }
      if (!found.length) {
        toast.error(t("mapsImport.noPasteMatch"));
        return;
      }
      showPreview(found, t("mapsImport.pastedList"));
    } finally {
      setBusy(false);
    }
  }

  function commit() {
    const chosen = uniquePreview.filter((p) => selected.includes(p.id));
    if (!chosen.length) {
      toast.error(t("mapsImport.selectSome"));
      return;
    }
    importPlaces(chosen, tripId);
    toast.success(t("places.imported", { n: chosen.length }));
    setPreview([]);
    setSelected([]);
    setPaste("");
    onOpenChange(false);
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(100%-1.5rem,720px)]">
        <DialogHeader>
          <DialogTitle>{t("mapsImport.title")}</DialogTitle>
          <DialogDescription>{t("mapsImport.description")}</DialogDescription>
        </DialogHeader>

        {preview.length ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                {t("mapsImport.preview", { n: uniquePreview.length, name: listName })}
                {preview.length !== uniquePreview.length ? (
                  <span className="text-muted"> · {t("mapsImport.skipped", { n: preview.length - uniquePreview.length })}</span>
                ) : null}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSelected(uniquePreview.map((p) => p.id))}>
                  {t("mapsImport.selectAll")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => { setPreview([]); setSelected([]); }}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
            <ul className="grid max-h-[50vh] gap-2 overflow-y-auto sm:grid-cols-2">
              {uniquePreview.map((place) => {
                const on = selected.includes(place.id);
                return (
                  <li key={place.id}>
                    <button
                      type="button"
                      onClick={() => toggle(place.id)}
                      className={`flex w-full gap-3 overflow-hidden rounded-lg border text-left ${
                        on ? "border-accent bg-accent-soft/40" : "border-line"
                      }`}
                    >
                      <PlacePhoto
                        name={place.name}
                        neighbourhood={place.neighbourhood}
                        photos={place.photos}
                        category={place.category}
                        className="h-20 w-24 shrink-0"
                      />
                      <span className="min-w-0 flex-1 py-2 pr-2">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{place.name}</span>
                          {on ? <Check className="size-3.5 shrink-0 text-accent" /> : null}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5">
                          <CategoryChip category={place.category} />
                          <span className="truncate text-xs text-muted">{place.neighbourhood}</span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button className="min-h-11 w-full" onClick={commit}>
              {t("mapsImport.importN", { n: selected.filter((id) => uniquePreview.some((p) => p.id === id)).length })}
            </Button>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="lists" className="min-h-11 flex-1 sm:min-h-8">{t("mapsImport.savedLists")}</TabsTrigger>
              <TabsTrigger value="file" className="min-h-11 flex-1 sm:min-h-8">{t("mapsImport.upload")}</TabsTrigger>
              <TabsTrigger value="paste" className="min-h-11 flex-1 sm:min-h-8">{t("mapsImport.paste")}</TabsTrigger>
            </TabsList>
            <TabsContent value="lists" className="mt-4 space-y-2">
              <p className="text-xs text-muted">{t("mapsImport.listsHint")}</p>
              <ul className="grid gap-2">
                {GOOGLE_MAPS_LISTS.map((list) => (
                  <li key={list.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 rounded-lg border border-line px-3 py-3 text-left hover:bg-surface-2"
                      onClick={() => pickList(list)}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                        <MapPinned className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{listLabel(list.names, locale)}</span>
                          <span className="text-xs text-muted">{t("mapsImport.placeCount", { n: list.placeNames.length })}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">{listLabel(list.descriptions, locale)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </TabsContent>
            <TabsContent value="file" className="mt-4 space-y-3">
              <p className="text-sm text-ink-soft">{t("mapsImport.fileHint")}</p>
              <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
                <li>{t("mapsImport.step1")}</li>
                <li>{t("mapsImport.step2")}</li>
                <li>{t("mapsImport.step3")}</li>
              </ol>
              <Button className="min-h-11 w-full" variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload />
                {t("mapsImport.chooseFile")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".kml,.kmz,.json,application/vnd.google-earth.kml+xml,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onFile(file);
                  e.target.value = "";
                }}
              />
            </TabsContent>
            <TabsContent value="paste" className="mt-4 space-y-3">
              <p className="text-sm text-ink-soft">{t("mapsImport.pasteHint")}</p>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={7}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
                placeholder={t("mapsImport.pastePh")}
              />
              <Button className="min-h-11 w-full" disabled={busy || !paste.trim()} onClick={() => void parsePaste()}>
                {t("mapsImport.parsePaste")}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
