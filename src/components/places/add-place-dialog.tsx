import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { placeProvider } from "@/services/place-provider";
import { useTripStore } from "@/store/trip-store";
import { uid } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { PlacePhoto } from "@/components/places/place-photo";
import type {
  IndoorOutdoor,
  Place,
  PlaceCategory,
  PlaceSearchResult,
  Priority,
  ReservationNeed,
} from "@/types/trip";

const EMPTY: Omit<Place, "id" | "createdAt"> = {
  name: "",
  address: "",
  lat: 35.68,
  lng: 139.76,
  category: "attraction",
  tags: [],
  neighbourhood: "",
  priority: "want",
  notes: "",
  source: "manual",
  estimatedDurationMin: 60,
  reservationRequired: "unknown",
  indoorOutdoor: "mixed",
  photos: [],
  status: "saved",
};

export function AddPlaceDialog({
  open,
  onOpenChange,
  tripId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId?: string;
}) {
  const upsertPlace = useTripStore((s) => s.upsertPlace);
  const { t } = useI18n();
  const [tab, setTab] = useState("search");
  const [query, setQuery] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [hits, setHits] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [form, setForm] = useState(EMPTY);

  async function runSearch() {
    setSearching(true);
    try {
      const results = await placeProvider.search(query);
      setHits(results);
      if (!results.length) toast.message(t("addPlace.noMatches"));
    } finally {
      setSearching(false);
    }
  }

  async function fromUrl() {
    setSearching(true);
    try {
      const result = await placeProvider.lookupMapsUrl(mapsUrl);
      if (!result) {
        toast.error(t("addPlace.urlError"));
        return;
      }
      applyResult(result, "maps-url");
      setTab("manual");
      toast.message(t("addPlace.filled"));
    } finally {
      setSearching(false);
    }
  }

  function applyResult(result: PlaceSearchResult, source: Place["source"]) {
    setForm({
      ...EMPTY,
      name: result.name,
      address: result.address,
      lat: result.lat,
      lng: result.lng,
      category: result.category,
      neighbourhood: result.neighbourhood,
      tags: result.tags,
      estimatedDurationMin: result.estimatedDurationMin,
      openingHours: result.openingHours,
      indoorOutdoor: result.indoorOutdoor,
      reservationRequired: result.reservationRequired,
      googlePlaceId: result.googlePlaceId,
      source,
      photos: result.photos ?? [],
    });
  }

  function save() {
    if (!form.name.trim()) {
      toast.error(t("addPlace.nameRequired"));
      return;
    }
    upsertPlace(
      {
        ...form,
        id: uid("place"),
        createdAt: new Date().toISOString(),
        tags: form.tags,
      },
      tripId,
    );
    toast.success(t("addPlace.saved"));
    setForm(EMPTY);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addPlace.title")}</DialogTitle>
          <DialogDescription>{t("addPlace.description")}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="search" className="min-h-11 flex-1 sm:min-h-8">{t("addPlace.search")}</TabsTrigger>
            <TabsTrigger value="url" className="min-h-11 flex-1 sm:min-h-8">{t("addPlace.mapsUrl")}</TabsTrigger>
            <TabsTrigger value="manual" className="min-h-11 flex-1 sm:min-h-8">{t("addPlace.manual")}</TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("addPlace.searchPlaceholder")}
                className="h-11 sm:h-10"
                onKeyDown={(e) => e.key === "Enter" && void runSearch()}
              />
              <Button className="min-h-11 sm:min-h-10" onClick={() => void runSearch()} disabled={searching}>
                {t("addPlace.search")}
              </Button>
            </div>
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {hits.map((hit) => (
                <li key={`${hit.name}-${hit.lat}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md border border-line px-3 py-2 text-left transition-colors duration-150 hover:bg-surface-2"
                    onClick={() => {
                      applyResult(hit, "search");
                      setTab("manual");
                    }}
                  >
                    <PlacePhoto
                      name={hit.name}
                      neighbourhood={hit.neighbourhood}
                      photos={hit.photos}
                      category={hit.category}
                      className="size-14 shrink-0 rounded-md"
                    />
                    <span className="min-w-0">
                      <p className="text-sm font-medium">{hit.name}</p>
                      <p className="text-xs text-muted">
                        {hit.neighbourhood} · {hit.address}
                      </p>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="url" className="mt-4 space-y-3">
            <Label htmlFor="maps-url">{t("addPlace.urlLabel")}</Label>
            <Input
              id="maps-url"
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              placeholder="https://www.google.com/maps/place/…/@35.71,139.79,17z"
              className="h-11 sm:h-10"
            />
            <Button className="min-h-11" onClick={() => void fromUrl()} disabled={searching || !mapsUrl.trim()}>
              {t("addPlace.parseUrl")}
            </Button>
            <p className="text-xs text-muted">{t("addPlace.urlHint")}</p>
          </TabsContent>
          <TabsContent value="manual" className="mt-4 grid gap-3">
            <Field label={t("addPlace.name")}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 sm:h-10" />
            </Field>
            <Field label={t("addPlace.address")}>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="h-11 sm:h-10" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("addPlace.latitude")}>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.lat}
                  className="h-11 sm:h-10"
                  onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })}
                />
              </Field>
              <Field label={t("addPlace.longitude")}>
                <Input
                  type="number"
                  step="0.0001"
                  value={form.lng}
                  className="h-11 sm:h-10"
                  onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("addPlace.category")}>
                <Select
                  value={form.category}
                  className="h-11 sm:h-10"
                  onChange={(e) => setForm({ ...form, category: e.target.value as PlaceCategory })}
                >
                  <option value="attraction">{t("category.attraction")}</option>
                  <option value="restaurant">{t("category.restaurant")}</option>
                  <option value="cafe">{t("category.cafe")}</option>
                  <option value="photo">{t("category.photo")}</option>
                  <option value="shopping">{t("category.shopping")}</option>
                  <option value="nature">{t("category.nature")}</option>
                  <option value="nightlife">{t("category.nightlife")}</option>
                  <option value="hotel">{t("category.hotel")}</option>
                  <option value="other">{t("category.other")}</option>
                </Select>
              </Field>
              <Field label={t("addPlace.priority")}>
                <Select
                  value={form.priority}
                  className="h-11 sm:h-10"
                  onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                >
                  <option value="must-do">{t("priority.must-do")}</option>
                  <option value="want">{t("priority.want")}</option>
                  <option value="if-time">{t("priority.if-time")}</option>
                  <option value="skip">{t("priority.skip")}</option>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("addPlace.neighbourhood")}>
                <Input
                  value={form.neighbourhood}
                  className="h-11 sm:h-10"
                  onChange={(e) => setForm({ ...form, neighbourhood: e.target.value })}
                />
              </Field>
              <Field label={t("addPlace.duration")}>
                <Input
                  type="number"
                  value={form.estimatedDurationMin}
                  className="h-11 sm:h-10"
                  onChange={(e) => setForm({ ...form, estimatedDurationMin: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("addPlace.indoor")}>
                <Select
                  value={form.indoorOutdoor}
                  className="h-11 sm:h-10"
                  onChange={(e) => setForm({ ...form, indoorOutdoor: e.target.value as IndoorOutdoor })}
                >
                  <option value="indoor">{t("indoor.indoor")}</option>
                  <option value="outdoor">{t("indoor.outdoor")}</option>
                  <option value="mixed">{t("indoor.mixed")}</option>
                </Select>
              </Field>
              <Field label={t("addPlace.reservation")}>
                <Select
                  value={form.reservationRequired}
                  className="h-11 sm:h-10"
                  onChange={(e) => setForm({ ...form, reservationRequired: e.target.value as ReservationNeed })}
                >
                  <option value="yes">{t("reservation.yes")}</option>
                  <option value="no">{t("reservation.no")}</option>
                  <option value="unknown">{t("reservation.unknown")}</option>
                </Select>
              </Field>
            </div>
            <Field label={t("addPlace.tags")}>
              <Input
                value={form.tags.join(", ")}
                className="h-11 sm:h-10"
                onChange={(e) =>
                  setForm({
                    ...form,
                    tags: e.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
              />
            </Field>
            <Field label={t("addPlace.notes")}>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Button className="min-h-11" onClick={save}>{t("addPlace.save")}</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
