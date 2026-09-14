import type { TripDestination } from "@/types/trip";

export type DestinationCity = TripDestination & {
  names: {
    en: string;
    zhHant: string;
    zhHans: string;
    ja: string;
  };
  countryNames: {
    en: string;
    zhHant: string;
    zhHans: string;
    ja: string;
  };
  keywords: string[];
  nearby: string[];
  recommended?: boolean;
};

export const DESTINATIONS: DestinationCity[] = [
  city("tokyo", "Tokyo", "東京", "东京", "東京", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 35.6812, 139.7671, "HND", ["東京", "东京", "toky", "tyo", "shinjuku", "shibuya"], ["kyoto", "osaka", "hakone", "nikko", "kamakura", "yokohama"], true),
  city("kyoto", "Kyoto", "京都", "京都", "京都", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 35.0116, 135.7681, "KIX", ["京都", "kyo", "gion", "arashiyama"], ["osaka", "nara", "tokyo", "kanazawa", "hiroshima"], true),
  city("osaka", "Osaka", "大阪", "大阪", "大阪", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 34.6937, 135.5023, "KIX", ["大阪", "osa", "namba", "umeda", "dotonbori"], ["kyoto", "nara", "kobe", "tokyo", "hiroshima"], true),
  city("nara", "Nara", "奈良", "奈良", "奈良", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 34.6851, 135.8048, "KIX", ["奈良"], ["kyoto", "osaka"]),
  city("osaka-kobe", "Kobe", "神戶", "神户", "神戸", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 34.6901, 135.1956, "UKB", ["神戶", "神户", "kobe"], ["osaka", "kyoto"]),
  city("hiroshima", "Hiroshima", "廣島", "广岛", "広島", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 34.3853, 132.4553, "HIJ", ["廣島", "广岛", "hiroshima", "miyajima"], ["osaka", "kyoto", "fukuoka"]),
  city("kanazawa", "Kanazawa", "金澤", "金泽", "金沢", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 36.5613, 136.6562, "KMQ", ["金澤", "金泽", "kanazawa"], ["takayama", "kyoto", "tokyo"]),
  city("takayama", "Takayama", "高山", "高山", "高山", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 36.1461, 137.2517, "NGO", ["高山", "hida"], ["kanazawa", "tokyo"]),
  city("nagoya", "Nagoya", "名古屋", "名古屋", "名古屋", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 35.1815, 136.9066, "NGO", ["名古屋", "nagoya"], ["tokyo", "kyoto", "takayama"]),
  city("yokohama", "Yokohama", "橫濱", "横滨", "横浜", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 35.4437, 139.638, "HND", ["橫濱", "横滨", "yokohama"], ["tokyo", "kamakura"]),
  city("kamakura", "Kamakura", "鎌倉", "镰仓", "鎌倉", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 35.3192, 139.5467, "HND", ["鎌倉", "镰仓", "kamakura"], ["tokyo", "hakone", "yokohama"]),
  city("hakone", "Hakone", "箱根", "箱根", "箱根", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 35.2324, 139.1069, "HND", ["箱根", "hakone", "onsen"], ["tokyo", "kamakura"]),
  city("nikko", "Nikko", "日光", "日光", "日光", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 36.758, 139.599, "NRT", ["日光", "nikko"], ["tokyo"]),
  city("sapporo", "Sapporo", "札幌", "札幌", "札幌", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 43.0618, 141.3545, "CTS", ["札幌", "hokkaido", "北海道"], ["tokyo", "osaka"], true),
  city("fukuoka", "Fukuoka", "福岡", "福冈", "福岡", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 33.5904, 130.4017, "FUK", ["福岡", "福冈", "hakata", "博多"], ["osaka", "hiroshima", "naha"]),
  city("naha", "Naha", "那霸（沖繩）", "那霸（冲绳）", "那覇（沖縄）", "Japan", "日本", "日本", "日本", "Asia/Tokyo", 26.2124, 127.6809, "OKA", ["沖繩", "冲绳", "okinawa", "naha", "那霸"], ["tokyo", "fukuoka", "osaka"], true),
  city("hongkong", "Hong Kong", "香港", "香港", "香港", "China", "中國", "中国", "中国", "Asia/Hong_Kong", 22.3193, 114.1694, "HKG", ["香港", "hk", "kowloon", "tsim sha tsui"], ["taipei", "macau", "tokyo", "seoul", "bangkok"], true),
  city("macau", "Macau", "澳門", "澳门", "マカオ", "China", "中國", "中国", "中国", "Asia/Macau", 22.1987, 113.5439, "MFM", ["澳門", "澳门", "macau", "macao"], ["hongkong", "taipei", "guangzhou"]),
  city("taipei", "Taipei", "台北", "台北", "台北", "Taiwan", "台灣", "台湾", "台湾", "Asia/Taipei", 25.033, 121.5654, "TPE", ["台北", "taiwan", "台灣", "台湾"], ["hongkong", "tokyo", "osaka", "seoul"], true),
  city("seoul", "Seoul", "首爾", "首尔", "ソウル", "South Korea", "韓國", "韩国", "韓国", "Asia/Seoul", 37.5665, 126.978, "ICN", ["首爾", "首尔", "seoul", "korea", "韓國"], ["busan", "tokyo", "taipei", "hongkong"], true),
  city("busan", "Busan", "釜山", "釜山", "釜山", "South Korea", "韓國", "韩国", "韓国", "Asia/Seoul", 35.1796, 129.0756, "PUS", ["釜山", "busan", "pusan"], ["seoul", "fukuoka"]),
  city("singapore", "Singapore", "新加坡", "新加坡", "シンガポール", "Singapore", "新加坡", "新加坡", "シンガポール", "Asia/Singapore", 1.3521, 103.8198, "SIN", ["新加坡", "sg", "sing"], ["bangkok", "kualalumpur", "hongkong"], true),
  city("bangkok", "Bangkok", "曼谷", "曼谷", "バンコク", "Thailand", "泰國", "泰国", "タイ", "Asia/Bangkok", 13.7563, 100.5018, "BKK", ["曼谷", "bangkok", "bkk"], ["chiangmai", "singapore", "hongkong"], true),
  city("chiangmai", "Chiang Mai", "清邁", "清迈", "チェンマイ", "Thailand", "泰國", "泰国", "タイ", "Asia/Bangkok", 18.7883, 98.9853, "CNX", ["清邁", "清迈", "chiang"], ["bangkok"]),
  city("hanoi", "Hanoi", "河內", "河内", "ハノイ", "Vietnam", "越南", "越南", "ベトナム", "Asia/Ho_Chi_Minh", 21.0278, 105.8342, "HAN", ["河內", "河内", "hanoi"], ["saigon", "bangkok"]),
  city("saigon", "Ho Chi Minh City", "胡志明市", "胡志明市", "ホーチミン", "Vietnam", "越南", "越南", "ベトナム", "Asia/Ho_Chi_Minh", 10.8231, 106.6297, "SGN", ["胡志明", "saigon", "ho chi minh"], ["hanoi", "bangkok"]),
  city("kualalumpur", "Kuala Lumpur", "吉隆坡", "吉隆坡", "クアラルンプール", "Malaysia", "馬來西亞", "马来西亚", "マレーシア", "Asia/Kuala_Lumpur", 3.139, 101.6869, "KUL", ["吉隆坡", "kl", "kuala"], ["singapore", "penang", "bangkok"]),
  city("penang", "George Town", "檳城", "槟城", "ペナン", "Malaysia", "馬來西亞", "马来西亚", "マレーシア", "Asia/Kuala_Lumpur", 5.4141, 100.3288, "PEN", ["檳城", "槟城", "penang"], ["kualalumpur", "singapore"]),
  city("bali", "Ubud", "峇里（烏布）", "巴厘（乌布）", "バリ（ウブド）", "Indonesia", "印尼", "印尼", "インドネシア", "Asia/Makassar", -8.5069, 115.2625, "DPS", ["峇里", "巴厘", "bali", "ubud", "denpasar"], ["singapore", "bangkok"]),
  city("manila", "Manila", "馬尼拉", "马尼拉", "マニラ", "Philippines", "菲律賓", "菲律宾", "フィリピン", "Asia/Manila", 14.5995, 120.9842, "MNL", ["馬尼拉", "马尼拉", "manila"], ["hongkong", "singapore"]),
  city("shanghai", "Shanghai", "上海", "上海", "上海", "China", "中國", "中国", "中国", "Asia/Shanghai", 31.2304, 121.4737, "PVG", ["上海", "shanghai"], ["tokyo", "taipei", "hongkong"]),
  city("beijing", "Beijing", "北京", "北京", "北京", "China", "中國", "中国", "中国", "Asia/Shanghai", 39.9042, 116.4074, "PEK", ["北京", "beijing", "peking"], ["shanghai", "seoul", "tokyo"]),
  city("guangzhou", "Guangzhou", "廣州", "广州", "広州", "China", "中國", "中国", "中国", "Asia/Shanghai", 23.1291, 113.2644, "CAN", ["廣州", "广州", "guangzhou", "canton"], ["hongkong", "macau", "shenzhen"]),
  city("shenzhen", "Shenzhen", "深圳", "深圳", "深圳", "China", "中國", "中国", "中国", "Asia/Shanghai", 22.5431, 114.0579, "SZX", ["深圳", "shenzhen"], ["hongkong", "guangzhou", "macau"]),
  city("paris", "Paris", "巴黎", "巴黎", "パリ", "France", "法國", "法国", "フランス", "Europe/Paris", 48.8566, 2.3522, "CDG", ["巴黎", "paris"], ["london", "rome"], true),
  city("london", "London", "倫敦", "伦敦", "ロンドン", "United Kingdom", "英國", "英国", "イギリス", "Europe/London", 51.5074, -0.1278, "LHR", ["倫敦", "伦敦", "london"], ["paris", "amsterdam"], true),
  city("rome", "Rome", "羅馬", "罗马", "ローマ", "Italy", "意大利", "意大利", "イタリア", "Europe/Rome", 41.9028, 12.4964, "FCO", ["羅馬", "罗马", "rome", "roma"], ["paris", "london"]),
  city("amsterdam", "Amsterdam", "阿姆斯特丹", "阿姆斯特丹", "アムステルダム", "Netherlands", "荷蘭", "荷兰", "オランダ", "Europe/Amsterdam", 52.3676, 4.9041, "AMS", ["阿姆斯特丹", "amsterdam"], ["london", "paris"]),
  city("newyork", "New York", "紐約", "纽约", "ニューヨーク", "United States", "美國", "美国", "アメリカ", "America/New_York", 40.7128, -74.006, "JFK", ["紐約", "纽约", "nyc", "new york"], ["london", "tokyo"], true),
  city("losangeles", "Los Angeles", "洛杉磯", "洛杉矶", "ロサンゼルス", "United States", "美國", "美国", "アメリカ", "America/Los_Angeles", 34.0522, -118.2437, "LAX", ["洛杉磯", "洛杉矶", "la", "los angeles"], ["tokyo", "newyork"]),
  city("sydney", "Sydney", "悉尼", "悉尼", "シドニー", "Australia", "澳洲", "澳大利亚", "オーストラリア", "Australia/Sydney", -33.8688, 151.2093, "SYD", ["悉尼", "sydney", "雪梨"], ["tokyo", "singapore"]),
];

function city(
  id: string,
  en: string,
  zhHant: string,
  zhHans: string,
  ja: string,
  countryEn: string,
  countryZhHant: string,
  countryZhHans: string,
  countryJa: string,
  timezone: string,
  lat: number,
  lng: number,
  iata: string,
  keywords: string[],
  nearby: string[],
  recommended = false,
): DestinationCity {
  return {
    id,
    name: en,
    country: countryEn,
    timezone,
    lat,
    lng,
    iata,
    names: { en, zhHant, zhHans, ja },
    countryNames: { en: countryEn, zhHant: countryZhHant, zhHans: countryZhHans, ja: countryJa },
    keywords,
    nearby,
    recommended,
  };
}

export function toTripDestination(city: DestinationCity): TripDestination {
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    timezone: city.timezone,
    lat: city.lat,
    lng: city.lng,
    iata: city.iata,
  };
}

export function findCity(idOrName: string): DestinationCity | undefined {
  const q = idOrName.trim().toLowerCase();
  return DESTINATIONS.find(
    (c) =>
      c.id === q ||
      c.name.toLowerCase() === q ||
      Object.values(c.names).some((n) => n.toLowerCase() === q),
  );
}

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function searchDestinations(query: string, selectedIds: string[] = []): DestinationCity[] {
  const selected = new Set(selectedIds);
  const q = fold(query);
  const pool = DESTINATIONS.filter((c) => !selected.has(c.id));
  if (!q) {
    const nearby = selectedIds.flatMap((id) => DESTINATIONS.find((c) => c.id === id)?.nearby ?? []);
    const nearbySet = new Set(nearby);
    return pool
      .slice()
      .sort((a, b) => {
        const an = nearbySet.has(a.id) ? 0 : a.recommended ? 1 : 2;
        const bn = nearbySet.has(b.id) ? 0 : b.recommended ? 1 : 2;
        return an - bn;
      })
      .slice(0, 8);
  }
  return pool
    .map((c) => ({ c, s: scoreCity(q, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map((x) => x.c);
}

function scoreCity(q: string, c: DestinationCity): number {
  const labels = [...Object.values(c.names), ...Object.values(c.countryNames), c.iata ?? "", ...c.keywords].map(fold);
  let best = 0;
  for (const label of labels) {
    if (!label) continue;
    if (label === q) best = Math.max(best, 100);
    else if (label.startsWith(q)) best = Math.max(best, 80 - q.length);
    else if (label.includes(q)) best = Math.max(best, 50);
  }
  return best;
}

export function joinDestinationNames(destinations: TripDestination[]): string {
  return destinations.map((d) => d.name).join(" · ");
}
