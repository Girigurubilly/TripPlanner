import { PLACES_CATALOG } from "@/data/catalog";
import type { Place, PlaceSearchResult, Priority } from "@/types/trip";
import { uid } from "@/lib/utils";

export type LocalizedText = {
  en: string;
  zhHant: string;
  zhHans: string;
  ja: string;
};

export type GoogleMapsList = {
  id: string;
  names: LocalizedText;
  descriptions: LocalizedText;
  city: string;
  placeCount: number;
  placeNames: string[];
  defaultPriority: Priority;
};

export const GOOGLE_MAPS_LISTS: GoogleMapsList[] = [
  {
    id: "tokyo-must",
    names: { en: "Tokyo must-see", zhHant: "東京必去", zhHans: "东京必去", ja: "東京の定番" },
    descriptions: {
      en: "Temples, scramble crossing, shrine forest — the list you already starred.",
      zhHant: "淺草、澀谷、明治神宮 — 你在地圖上星標的那份。",
      zhHans: "浅草、涩谷、明治神宫 — 你在地图上星标的那份。",
      ja: "浅草・渋谷・明治神宮。マップで星を付けた定番。",
    },
    city: "Tokyo",
    placeCount: 8,
    placeNames: [
      "Senso-ji",
      "Meiji Jingu",
      "Shibuya Crossing",
      "Shibuya Sky",
      "Tokyo Skytree",
      "Ueno Park",
      "Tokyo Tower",
      "teamLab Planets",
    ],
    defaultPriority: "must-do",
  },
  {
    id: "tokyo-food",
    names: { en: "Tokyo eats", zhHant: "東京美食", zhHans: "东京美食", ja: "東京グルメ" },
    descriptions: {
      en: "Ramen counters, yakitori alleys, market breakfasts.",
      zhHant: "拉麵、烤雞串巷、市場早餐。",
      zhHans: "拉面、烤鸡串巷、市场早餐。",
      ja: "ラーメン、焼き鳥横丁、市場の朝ごはん。",
    },
    city: "Tokyo",
    placeCount: 6,
    placeNames: [
      "Ichiran Shibuya",
      "Omoide Yokocho",
      "Tsukiji Outer Market",
      "Maisen Aoyama",
      "Golden Gai",
      "Yanaka Ginza",
    ],
    defaultPriority: "want",
  },
  {
    id: "tokyo-photo",
    names: { en: "Photo spots", zhHant: "拍照清單", zhHans: "拍照清单", ja: "撮影スポット" },
    descriptions: {
      en: "Saved from Maps for golden hour and neon.",
      zhHant: "為了黃金時段和霓虹而收藏的點。",
      zhHans: "为了黄金时段和霓虹而收藏的点。",
      ja: "マジックアワーとネオンのために保存した場所。",
    },
    city: "Tokyo",
    placeCount: 7,
    placeNames: [
      "Shibuya Crossing",
      "Senso-ji",
      "Gotokuji Temple",
      "Kagurazaka",
      "Tokyo Tower",
      "Omoide Yokocho",
      "Nakamise-dori",
    ],
    defaultPriority: "want",
  },
  {
    id: "tokyo-indoor",
    names: { en: "Rainy-day indoor", zhHant: "雨天室內", zhHans: "雨天室内", ja: "雨の日の屋内" },
    descriptions: {
      en: "Museums, books, coffee — the list you open when it pours.",
      zhHant: "博物館、書店、咖啡 — 下雨就打開的清單。",
      zhHans: "博物馆、书店、咖啡 — 下雨就打开的清单。",
      ja: "博物館・本屋・コーヒー。雨の日用。",
    },
    city: "Tokyo",
    placeCount: 6,
    placeNames: [
      "Tokyo National Museum",
      "Ghibli Museum",
      "Nezu Museum",
      "Daikanyama T-Site",
      "Nakano Broadway",
      "Blue Bottle Coffee Kiyosumi",
    ],
    defaultPriority: "want",
  },
  {
    id: "asakusa-ueno",
    names: { en: "Asakusa & Ueno", zhHant: "淺草・上野", zhHans: "浅草・上野", ja: "浅草・上野" },
    descriptions: {
      en: "East-side neighbourhood cluster from a saved Maps list.",
      zhHant: "地圖清單裡的東東京一日圈。",
      zhHans: "地图清单里的东东京一日圈。",
      ja: "保存リストの東東京クラスター。",
    },
    city: "Tokyo",
    placeCount: 6,
    placeNames: [
      "Senso-ji",
      "Nakamise-dori",
      "Tokyo Skytree",
      "Ueno Park",
      "Tokyo National Museum",
      "Yanaka Ginza",
    ],
    defaultPriority: "must-do",
  },
  {
    id: "kyoto-classics",
    names: { en: "Kyoto classics", zhHant: "京都經典", zhHans: "京都经典", ja: "京都の定番" },
    descriptions: {
      en: "A Maps list for a Kyoto day (or two) on a multi-city trip.",
      zhHant: "多目的地行程裡，京都那一兩日的地圖清單。",
      zhHans: "多目的地行程里，京都那一两日的地图清单。",
      ja: "複数都市の旅程に京都を足すときのリスト。",
    },
    city: "Kyoto",
    placeCount: 8,
    placeNames: [
      "Fushimi Inari Taisha",
      "Kiyomizu-dera",
      "Arashiyama Bamboo Grove",
      "Gion",
      "Nishiki Market",
      "Kinkaku-ji",
      "Nijo Castle",
      "Philosopher's Path",
    ],
    defaultPriority: "must-do",
  },
  {
    id: "osaka-eats",
    names: { en: "Osaka food & neon", zhHant: "大阪美食與霓虹", zhHans: "大阪美食与霓虹", ja: "大阪の食いだおれ" },
    descriptions: {
      en: "Dotonbori, castle, covered arcades — starred on Maps.",
      zhHant: "道頓堀、大阪城、心齋橋 — 地圖上星標過的。",
      zhHans: "道顿堀、大阪城、心斋桥 — 地图上星标过的。",
      ja: "道頓堀・大阪城・心斎橋。",
    },
    city: "Osaka",
    placeCount: 6,
    placeNames: ["Dotonbori", "Osaka Castle", "Kuromon Market", "Umeda Sky Building", "Shinsekai", "Shinsaibashi"],
    defaultPriority: "want",
  },
];

export function catalogByName(name: string): PlaceSearchResult | undefined {
  return PLACES_CATALOG.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

export function searchResultToPlace(
  result: PlaceSearchResult,
  extra: Partial<Place> & { source?: Place["source"]; priority?: Priority } = {},
): Place {
  return {
    id: extra.id ?? uid("place"),
    name: result.name,
    googlePlaceId: result.googlePlaceId,
    address: result.address,
    lat: result.lat,
    lng: result.lng,
    category: result.category,
    tags: extra.tags ?? result.tags,
    neighbourhood: result.neighbourhood,
    priority: extra.priority ?? "want",
    notes: extra.notes ?? "",
    source: extra.source ?? "search",
    estimatedDurationMin: result.estimatedDurationMin,
    openingHours: result.openingHours,
    reservationRequired: result.reservationRequired,
    indoorOutdoor: result.indoorOutdoor,
    photos: result.photos?.length ? result.photos : extra.photos ?? [],
    status: extra.status ?? "saved",
    createdAt: extra.createdAt ?? new Date().toISOString(),
  };
}

export function placesFromMapsList(list: GoogleMapsList): Place[] {
  return list.placeNames
    .map((name) => catalogByName(name))
    .filter((p): p is PlaceSearchResult => Boolean(p))
    .map((result) =>
      searchResultToPlace(result, {
        source: "maps-list",
        priority: list.defaultPriority,
        tags: [...new Set([...result.tags, "maps-list", list.city.toLowerCase()])],
        notes: "",
      }),
    );
}
