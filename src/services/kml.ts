import { haversineM } from "@/lib/geo";
import { uid } from "@/lib/utils";
import type { Place, PlaceCategory } from "@/types/trip";

export type ParsedMapsImport = {
  listName: string;
  folders: string[];
  places: Place[];
};

function guessCategory(name: string, description: string): PlaceCategory {
  const hay = `${name} ${description}`.toLowerCase();
  if (/hotel|ryokan|hostel|stay/.test(hay)) return "hotel";
  if (/ramen|sushi|izakaya|restaurant|dining|food|market|yokocho/.test(hay)) return "restaurant";
  if (/cafe|coffee|kissaten/.test(hay)) return "cafe";
  if (/bar|nightlife|golden gai/.test(hay)) return "nightlife";
  if (/shop|mall|store|vintage|broadway/.test(hay)) return "shopping";
  if (/park|garden|bamboo|nature/.test(hay)) return "nature";
  if (/photo|viewpoint|crossing|tower|neon/.test(hay)) return "photo";
  if (/station|airport|terminal/.test(hay)) return "transport";
  if (/temple|shrine|museum|castle|tower|attraction/.test(hay)) return "attraction";
  return "other";
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? "").trim();
}

function parseCoordinates(raw: string): { lat: number; lng: number } | null {
  const parts = raw
    .trim()
    .split(/[\s\n]+/)
    .filter(Boolean)[0]
    ?.split(",");
  if (!parts || parts.length < 2) return null;
  const lng = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function folderPath(el: Element): string[] {
  const names: string[] = [];
  let node: Element | null = el.parentElement;
  while (node) {
    const tag = node.localName?.toLowerCase();
    if (tag === "folder" || tag === "document") {
      const name = textOf(node.getElementsByTagName("name")[0] || node.querySelector(":scope > name"));
      if (name) names.unshift(name);
    }
    node = node.parentElement;
  }
  return names;
}

export function parseKmlText(text: string, fileName = "list.kml"): ParsedMapsImport {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("That file is not valid KML.");
  }
  const placemarks = [...doc.getElementsByTagName("Placemark")];
  const documentName =
    textOf(doc.querySelector("Document > name") || doc.querySelector("Folder > name")) ||
    fileName.replace(/\.(kml|kmz|xml)$/i, "");
  const folders = new Set<string>();
  const places: Place[] = [];

  for (const mark of placemarks) {
    const name = textOf(mark.querySelector("name"));
    const description = textOf(mark.querySelector("description")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const address = textOf(mark.querySelector("address"));
    const coordText =
      textOf(mark.querySelector("Point > coordinates") || mark.querySelector("coordinates")) ||
      `${textOf(mark.querySelector("LookAt > longitude"))},${textOf(mark.querySelector("LookAt > latitude"))}`;
    const lngEl = textOf(mark.querySelector("LookAt > longitude") || mark.querySelector("Camera > longitude"));
    const latEl = textOf(mark.querySelector("LookAt > latitude") || mark.querySelector("Camera > latitude"));
    let coords = parseCoordinates(coordText);
    if (!coords && lngEl && latEl) {
      const lat = Number(latEl);
      const lng = Number(lngEl);
      if (Number.isFinite(lat) && Number.isFinite(lng)) coords = { lat, lng };
    }
    if (!name || !coords) continue;
    const path = folderPath(mark).filter((n) => n && n !== name && n !== documentName);
    path.forEach((f) => folders.add(f));
    const placeId =
      textOf(mark.querySelector("Data[name='place_id'] value")) ||
      textOf(mark.querySelector("Data[name='Place ID'] value"));
    places.push({
      id: uid("place"),
      name,
      googlePlaceId: placeId || undefined,
      address: address || description.slice(0, 140),
      lat: coords.lat,
      lng: coords.lng,
      category: guessCategory(name, description),
      tags: ["maps-list", ...path.map((p) => p.toLowerCase())],
      neighbourhood: path[path.length - 1] || "",
      priority: "want",
      notes: description.slice(0, 400),
      source: "maps-list",
      estimatedDurationMin: 60,
      reservationRequired: "unknown",
      indoorOutdoor: "mixed",
      photos: [],
      status: "saved",
      createdAt: new Date().toISOString(),
    });
  }

  return { listName: documentName, folders: [...folders], places };
}

type ZipHit = { method: number; data: Uint8Array };

function scanZip(buffer: ArrayBuffer): ZipHit | null {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  while (offset + 30 < bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const method = view.getUint16(offset + 8, true);
    const compSize = view.getUint32(offset + 18, true);
    const nameLen = view.getUint16(offset + 26, true);
    const extraLen = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLen));
    const dataStart = nameStart + nameLen + extraLen;
    const data = bytes.slice(dataStart, dataStart + compSize);
    if (/\.kml$/i.test(name)) return { method, data };
    offset = dataStart + (compSize || 0);
  }
  return null;
}

export async function parseKmzFile(file: File): Promise<ParsedMapsImport> {
  const buffer = await file.arrayBuffer();
  const hit = scanZip(buffer);
  if (!hit) {
    const asText = await file.text();
    if (asText.includes("<kml") || asText.includes("<Placemark")) {
      return parseKmlText(asText, file.name);
    }
    throw new Error("No KML found inside that KMZ.");
  }
  let text: string;
  if (hit.method === 0) {
    text = new TextDecoder().decode(hit.data);
  } else if (hit.method === 8 && typeof DecompressionStream !== "undefined") {
    const stream = new Blob([hit.data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    text = await new Response(stream).text();
  } else {
    throw new Error("This KMZ uses compression this browser cannot unpack. Re-export as KML.");
  }
  return parseKmlText(text, file.name);
}

export function parseGoogleSavedJson(json: string): ParsedMapsImport {
  const data = JSON.parse(json) as unknown;
  const features = extractFeatures(data);
  const places: Place[] = [];
  for (const feature of features) {
    const place = featureToPlace(feature);
    if (place) places.push(place);
  }
  if (!places.length) throw new Error("No places found in that JSON.");
  return { listName: "Google saved places", folders: [], places };
}

function extractFeatures(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (Array.isArray(rec.features)) return rec.features as Record<string, unknown>[];
    if (Array.isArray(rec.places)) return rec.places as Record<string, unknown>[];
    if (Array.isArray(rec.SavedPlaces)) return rec.SavedPlaces as Record<string, unknown>[];
  }
  return [];
}

function featureToPlace(feature: Record<string, unknown>): Place | null {
  const props = (feature.properties || feature) as Record<string, unknown>;
  const loc = (props.Location || props.location || {}) as Record<string, unknown>;
  const geo = (feature.geometry || {}) as { coordinates?: number[] };
  const coordsArr = Array.isArray(geo.coordinates) ? geo.coordinates : undefined;
  const namedCoords = (loc["Geo Coordinates"] || loc.geo || {}) as Record<string, unknown>;
  const lat = Number(
    feature.lat ?? props.lat ?? loc.lat ?? namedCoords.Latitude ?? namedCoords.lat ?? coordsArr?.[1],
  );
  const lng = Number(
    feature.lng ?? props.lng ?? loc.lng ?? namedCoords.Longitude ?? namedCoords.lng ?? coordsArr?.[0],
  );
  const name = String(
    props.Title || props.title || props.name || loc["Business Name"] || loc.name || "",
  ).trim();
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const address = String(props.address || loc.Address || loc.address || "").trim();
  const mapsUrl = String(props["Google Maps URL"] || props.googleMapsUrl || props.url || "");
  return {
    id: uid("place"),
    name,
    address,
    lat,
    lng,
    category: guessCategory(name, address),
    tags: ["maps-list", "takeout"],
    neighbourhood: "",
    priority: "want",
    notes: mapsUrl,
    source: "maps-list",
    estimatedDurationMin: 60,
    reservationRequired: "unknown",
    indoorOutdoor: "mixed",
    photos: [],
    status: "saved",
    createdAt: new Date().toISOString(),
  };
}

export function dedupePlaces(incoming: Place[], existing: Place[]): Place[] {
  return incoming.filter((place) => {
    return !existing.some((have) => {
      if (have.name.toLowerCase() === place.name.toLowerCase() && haversineM(have, place) < 250) return true;
      if (haversineM(have, place) < 40) return true;
      return false;
    });
  });
}

export async function parseMapsFile(file: File): Promise<ParsedMapsImport> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".kmz")) return parseKmzFile(file);
  const text = await file.text();
  if (name.endsWith(".json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
    return parseGoogleSavedJson(text);
  }
  return parseKmlText(text, file.name);
}
