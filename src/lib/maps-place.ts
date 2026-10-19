export function placeFromMaps(raw: string): { name: string; note: string } | null {
  const text = raw.trim();
  if (!/maps\.app\.goo\.gl|google\.[^/\s]+\/maps|maps\.google\./i.test(text)) return null;
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const url = lines.find((line) => /https?:\/\//i.test(line)) || text;
  let name = "";
  const place = url.match(/\/place\/([^/@?#]+)/i);
  const query = url.match(/[?&](?:query|q)=([^&#]+)/i);
  if (place?.[1]) name = decodeURIComponent(place[1].replace(/\+/g, " "));
  else if (query?.[1]) name = decodeURIComponent(query[1].replace(/\+/g, " "));
  if (!name) {
    const title = lines.find((line) => !/https?:\/\//i.test(line));
    name = title || "";
  }
  name = name.replace(/\/$/, "").replace(/\s+/g, " ").trim().slice(0, 80);
  const note = lines.find((line) => line !== name && !/https?:\/\//i.test(line)) || "";
  return { name, note: note.slice(0, 160) };
}
