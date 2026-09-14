import { parseCsv, toCsv } from "@/lib/csv";
import { uid } from "@/lib/utils";
import { parseKmlText, parseMapsFile, type ParsedMapsImport } from "@/services/kml";
import type {
  AppBackup,
  IndoorOutdoor,
  Place,
  PlaceCategory,
  Priority,
  ReservationNeed,
} from "@/types/trip";

export type KmlPreview = {
  fileName: string;
  sizeBytes: number;
  layerHint: string;
  status: "ready" | "empty" | "unsupported";
  message: string;
  listName?: string;
  places?: Place[];
};

export interface ImportExportService {
  exportPlacesCsv(places: Place[]): string;
  importPlacesCsv(csv: string): Place[];
  exportPlacesJson(places: Place[]): string;
  importPlacesJson(json: string): Place[];
  exportBackup(data: AppBackup): string;
  importBackup(json: string): AppBackup;
  inspectKml(file: File): Promise<KmlPreview>;
  importMapsFile(file: File): Promise<ParsedMapsImport>;
}

const PLACE_HEADERS = [
  "name",
  "address",
  "lat",
  "lng",
  "category",
  "neighbourhood",
  "priority",
  "tags",
  "notes",
  "estimatedDurationMin",
  "indoorOutdoor",
  "reservationRequired",
  "googlePlaceId",
] as const;

function asCategory(v: string): PlaceCategory {
  const allowed: PlaceCategory[] = [
    "attraction",
    "restaurant",
    "cafe",
    "hotel",
    "photo",
    "shopping",
    "nature",
    "nightlife",
    "transport",
    "other",
  ];
  return allowed.includes(v as PlaceCategory) ? (v as PlaceCategory) : "other";
}

function asPriority(v: string): Priority {
  const allowed: Priority[] = ["must-do", "want", "if-time", "skip"];
  return allowed.includes(v as Priority) ? (v as Priority) : "want";
}

function asIndoor(v: string): IndoorOutdoor {
  if (v === "indoor" || v === "outdoor" || v === "mixed") return v;
  return "mixed";
}

function asRes(v: string): ReservationNeed {
  if (v === "yes" || v === "no" || v === "unknown") return v;
  return "unknown";
}

function rowToPlace(row: Record<string, string>): Place | null {
  const name = row.name?.trim();
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: uid("place"),
    name,
    address: row.address?.trim() || "",
    lat,
    lng,
    category: asCategory(row.category || "other"),
    neighbourhood: row.neighbourhood?.trim() || "",
    priority: asPriority(row.priority || "want"),
    tags: (row.tags || "")
      .split("|")
      .map((t) => t.trim())
      .filter(Boolean),
    notes: row.notes || "",
    source: "import",
    estimatedDurationMin: Number(row.estimatedDurationMin) || 60,
    reservationRequired: asRes(row.reservationRequired || "unknown"),
    indoorOutdoor: asIndoor(row.indoorOutdoor || "mixed"),
    photos: [],
    status: "saved",
    googlePlaceId: row.googlePlaceId || undefined,
    createdAt: new Date().toISOString(),
  };
}

export class LocalImportExportService implements ImportExportService {
  exportPlacesCsv(places: Place[]): string {
    const rows = [
      [...PLACE_HEADERS],
      ...places.map((p) =>
        PLACE_HEADERS.map((h) => {
          if (h === "tags") return p.tags.join("|");
          const value = p[h];
          return value == null ? "" : String(value);
        }),
      ),
    ];
    return toCsv(rows);
  }

  importPlacesCsv(csv: string): Place[] {
    const table = parseCsv(csv);
    if (table.length < 2) return [];
    const header = table[0].map((h) => h.trim());
    const places: Place[] = [];
    for (const cells of table.slice(1)) {
      const row: Record<string, string> = {};
      header.forEach((h, i) => {
        row[h] = cells[i] ?? "";
      });
      const place = rowToPlace(row);
      if (place) places.push(place);
    }
    return places;
  }

  exportPlacesJson(places: Place[]): string {
    return JSON.stringify({ version: 1, places }, null, 2);
  }

  importPlacesJson(json: string): Place[] {
    const data = JSON.parse(json) as { places?: Place[] } | Place[];
    const list = Array.isArray(data) ? data : data.places;
    if (!Array.isArray(list)) throw new Error("JSON does not contain a places array");
    return list.map((p) => ({
      ...p,
      id: p.id || uid("place"),
      tags: p.tags || [],
      photos: p.photos || [],
      source: "import" as const,
      status: p.status || "saved",
      createdAt: p.createdAt || new Date().toISOString(),
    }));
  }

  exportBackup(data: AppBackup): string {
    return JSON.stringify(data, null, 2);
  }

  importBackup(json: string): AppBackup {
    const data = JSON.parse(json) as AppBackup;
    if (!data || data.version !== 1) throw new Error("Unsupported backup version");
    if (!Array.isArray(data.places) || !Array.isArray(data.trips)) {
      throw new Error("Backup is missing trips or places");
    }
    return {
      version: 1,
      exportedAt: data.exportedAt || new Date().toISOString(),
      places: data.places,
      trips: data.trips.map((trip) => ({
        ...trip,
        destinations: trip.destinations?.length
          ? trip.destinations
          : trip.destination
            ? [
                {
                  id: uid("dest"),
                  name: trip.destination,
                  country: "",
                  timezone: trip.timezone,
                  lat: trip.hotels[0]?.lat ?? 35.68,
                  lng: trip.hotels[0]?.lng ?? 139.76,
                  iata: trip.arrivalAirport,
                },
              ]
            : [],
      })),
      items: data.items || [],
      bookings: data.bookings || [],
      alternatePlans: data.alternatePlans || [],
    };
  }

  async inspectKml(file: File): Promise<KmlPreview> {
    try {
      const parsed = await parseMapsFile(file);
      return {
        fileName: file.name,
        sizeBytes: file.size,
        layerHint: parsed.folders.length ? parsed.folders.join(" · ") : parsed.listName,
        status: parsed.places.length ? "ready" : "empty",
        message: parsed.places.length
          ? `${parsed.places.length} places in “${parsed.listName}”`
          : "No placemarks found in that file.",
        listName: parsed.listName,
        places: parsed.places,
      };
    } catch (err) {
      return {
        fileName: file.name,
        sizeBytes: file.size,
        layerHint: "",
        status: "unsupported",
        message: err instanceof Error ? err.message : "Could not read that Maps export.",
      };
    }
  }

  async importMapsFile(file: File): Promise<ParsedMapsImport> {
    return parseMapsFile(file);
  }
}

export const importExportService: ImportExportService = new LocalImportExportService();

export { parseKmlText };
