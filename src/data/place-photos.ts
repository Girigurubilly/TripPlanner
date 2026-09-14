/** Wikimedia Commons filenames that resolve through thumb.php (no API key). */
const COMMONS_FILE: Record<string, string> = {
  "Senso-ji": "Sensoji_2023.jpg",
  "Nakamise-dori": "Nakamise.jpg",
  "Tokyo Skytree": "Tokyo_Sky_Tree.jpg",
  "Ueno Park": "Ueno_Park.jpg",
  "Tokyo National Museum": "Ueno_Park.jpg",
  "Akihabara Electric Town": "Akihabara_Electric_Town.jpg",
  Akihabara: "Akihabara_Electric_Town.jpg",
  "Meiji Jingu": "Meiji_Shrine.jpg",
  "Takeshita Street": "Takeshita.jpg",
  "Shibuya Crossing": "Shibuya_Crossing.jpg",
  "Shibuya Sky": "Shibuya_Scramble_Square.jpg",
  "Tsukiji Outer Market": "Tsukiji_fish_market.jpg",
  "Tokyo Tower": "Tokyo_Tower.jpg",
  "Roppongi Hills Mori Garden": "Roppongi_Hills.jpg",
  "Tokyo Metropolitan Government Building": "Tokyo_Metropolitan_Government.jpg",
  "Golden Gai": "Golden_Gai.jpg",
  "Ghibli Museum": "Ghibli_Museum.jpg",
  "Gotokuji Temple": "Gotokuji.jpg",
  Shimokitazawa: "Shimokitazawa.jpg",
  "Nezu Museum": "Nezu.jpg",
  "Kiyosumi Gardens": "Kiyosumi.jpg",
  "Blue Bottle Coffee Kiyosumi": "Blue_Bottle_Coffee.jpg",
  "Fushimi Inari Taisha": "Fushimi_Inari_Shrine.jpg",
  "Kiyomizu-dera": "Kiyomizu-dera.jpg",
  "Arashiyama Bamboo Grove": "Arashiyama_Bamboo_Grove.jpg",
  Gion: "Gion.jpg",
  "Kinkaku-ji": "Kinkaku-ji.jpg",
  "Nijo Castle": "Nijo_Castle.jpg",
  Dotonbori: "Glico.jpg",
  "Osaka Castle": "Osaka_Castle.jpg",
  "Kuromon Market": "Kuromon.jpg",
  "Umeda Sky Building": "Umeda_Sky_Building.jpg",
  Shinsekai: "Tsutenkaku.jpg",
  Shinsaibashi: "Shinsaibashi.jpg",
  "Yasaka Shrine": "Yasaka_Shrine.jpg",
};

export function commonsPhotoUrl(filename: string, width = 800): string {
  return `https://commons.wikimedia.org/w/thumb.php?f=${encodeURIComponent(filename)}&w=${width}`;
}

export function bakedPhotoFor(name: string): string | undefined {
  const file = COMMONS_FILE[name];
  return file ? commonsPhotoUrl(file) : undefined;
}

const memory = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

export async function resolvePlacePhoto(name: string, neighbourhood = ""): Promise<string | null> {
  const baked = bakedPhotoFor(name);
  if (baked) return baked;
  const key = `${name}|${neighbourhood}`.toLowerCase();
  if (memory.has(key)) return memory.get(key) ?? null;
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = fetchWikipediaThumb(`${name} ${neighbourhood}`.trim())
    .then((url) => {
      memory.set(key, url);
      inflight.delete(key);
      return url;
    })
    .catch(() => {
      memory.set(key, null);
      inflight.delete(key);
      return null;
    });
  inflight.set(key, job);
  return job;
}

async function fetchWikipediaThumb(query: string): Promise<string | null> {
  if (typeof fetch === "undefined" || !query.trim()) return null;
  const url =
    "https://en.wikipedia.org/w/api.php?origin=*&action=query&generator=search&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=640&format=json&gsrsearch=" +
    encodeURIComponent(query);
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
  };
  const pages = data.query?.pages;
  if (!pages) return null;
  const first = Object.values(pages)[0];
  return first?.thumbnail?.source ?? null;
}

export function photosForCatalog(name: string): string[] {
  const url = bakedPhotoFor(name);
  return url ? [url] : [];
}
