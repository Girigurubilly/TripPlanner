/** Tiny UI string table. zh-HK is the source of truth; EN is a partial stub
 *  that falls back to zh-HK for any key it does not define. */
export type Locale = "zh-HK" | "en";

const zhHK = {
  "tab.days": "每日",
  "tab.map": "地圖",
  "tab.transport": "交通",
  "tab.eat": "美食手信",
  "tab.more": "更多",
  "tab.overview": "總覽",
  "tab.guides": "指南",
  "tab.costs": "費用",
  "dock.label": "行程分頁",
  "more.trip": "行程",
  "more.overviewHint": "行程總覽、城市同點解咁排",
  "more.guidesHint": "實用資料、注意事項",
  "more.costsHint": "已列價錢 {count} 項，估計總數",
  "more.costsEmpty": "未有列價錢",
  "more.keep": "儲存同備份",
  "more.save": "下載行程檔",
  "more.saveHint": "連打卡、筆記一齊存成 JSON",
  "more.library": "返回行程庫",
  "more.libraryHint": "換行程、上傳新行程、Google Drive 同步",
  "next.title": "下一站",
  "next.allDone": "今日 {total} 個站全部打咗卡",
  "next.progress": "已打卡 {done}/{total}",
  "next.open": "詳情",
  "next.go": "導航",
  "next.checkIn": "打卡",
  "next.via": "點去",
  "kind.spot": "景點",
  "kind.meal": "食飯",
  "kind.hotel": "住宿",
  "lib.deleted": "已刪除「{title}」",
  "lib.undo": "復原",
  "lib.restored": "已復原「{title}」",
  "lib.reupload": "上傳同一個行程檔會更新內容。",
  "fold.more": "其他資料",
} as const;

export type MessageKey = keyof typeof zhHK;

const en: Partial<Record<MessageKey, string>> = {
  "tab.days": "Days",
  "tab.map": "Map",
  "tab.transport": "Transit",
  "tab.eat": "Food & gifts",
  "tab.more": "More",
  "tab.overview": "Overview",
  "tab.guides": "Guides",
  "tab.costs": "Costs",
  "next.title": "Next stop",
  "next.open": "Details",
  "next.go": "Directions",
  "next.checkIn": "Check in",
  "lib.undo": "Undo",
};

const TABLES: Record<Locale, Partial<Record<MessageKey, string>>> = { "zh-HK": zhHK, en };

let current: Locale = "zh-HK";

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

export function t(key: MessageKey, vars?: Record<string, string | number>, locale: Locale = current): string {
  const text = TABLES[locale][key] ?? zhHK[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
