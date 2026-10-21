export type MapsPlace = { name: string; note: string };

const MAPS_LINK = /https?:\/\/(?:(?:www\.)?google\.[^/\s]+\/maps|maps\.google\.[^/\s]+|maps\.app\.goo\.gl|goo\.gl\/maps)[^\s]*/i;

export function placeFromMaps(raw: string): MapsPlace | null {
  const text = raw.trim();
  if (!MAPS_LINK.test(text) && !/[?&](?:q|query)=/i.test(text)) return null;
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const url = lines.find((line) => /https?:\/\//i.test(line)) || text;
  const place = url.match(/\/place\/([^/@?#]+)/i);
  const query = url.match(/[?&](?:query|q)=([^&#]+)/i);
  let name = "";
  let address = "";
  if (place?.[1]) name = cleanToken(place[1]);
  else if (query?.[1]) {
    const parsed = nameFromQuery(cleanToken(query[1]));
    name = parsed.name;
    address = parsed.note;
  }
  if (!name) {
    const title = lines.find((line) => !/https?:\/\//i.test(line));
    name = title || "";
  }
  name = tidyName(name);
  if (!name) return null;
  const note = address || lines.find((line) => line !== name && !/https?:\/\//i.test(line)) || "";
  return { name, note: note.slice(0, 160) };
}

export function shortMapsLink(raw: string): string {
  const match = raw.match(/https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)\/[^\s]+/i);
  return match ? match[0].replace(/[),.]+$/, "") : "";
}

export async function resolveMapsPlace(raw: string): Promise<MapsPlace | null> {
  const direct = placeFromMaps(raw);
  if (direct?.name) return direct;
  const short = shortMapsLink(raw);
  if (!short) return null;
  const landed = await expandShortLink(short);
  if (!landed) return null;
  return placeFromMaps(landed) || titlePlace(landed);
}

async function expandShortLink(url: string): Promise<string> {
  try {
    const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(url)}&filter=url,title`;
    const res = await fetch(endpoint);
    if (!res.ok) return "";
    const json = (await res.json()) as { data?: { url?: string; title?: string } };
    const finalUrl = json.data?.url || "";
    const title = tidyName(json.data?.title || "");
    if (/\/place\/|[?&](?:q|query)=/i.test(finalUrl)) return finalUrl;
    if (title && !/^google maps$/i.test(title) && !/^https?:/i.test(title)) return title;
    return "";
  } catch {
    return "";
  }
}

function titlePlace(value: string): MapsPlace | null {
  const name = tidyName(value);
  return name ? { name, note: "" } : null;
}

function nameFromQuery(text: string): MapsPlace {
  const floor = text.match(/^(.*?)(?:\d+\s*階|\d+\s*F)\s+(.+)$/i);
  if (floor?.[2] && tidyName(floor[2])) return { name: tidyName(floor[2]), note: floor[1].trim() };
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && !/\d|〒|ward|chome|市|區|区|町/.test(parts[0])) {
    return { name: tidyName(parts[0]), note: parts.slice(1).join(", ") };
  }
  return { name: tidyName(text), note: "" };
}

function cleanToken(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value.replace(/\+/g, " ");
  }
}

function tidyName(value: string): string {
  return value
    .replace(/\s+[-–—|]\s+Google\s*(?:Maps|地圖|地图)\s*$/i, "")
    .replace(/\/$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
