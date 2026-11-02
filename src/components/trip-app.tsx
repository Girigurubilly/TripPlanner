import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { TripMap } from "./trip-map";
import {
  BookOpen,
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Copy,
  Download,
  Gift,
  Info,
  MapPin,
  MoreHorizontal,
  Wallet,
  TrainFront,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Upload,
  Navigation,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  cityLabel,
  dayDates,
  nextStop,
  restoreTrip,
  snapshotTrip,
  sortTrips,
  cleanCredit,
  dayChipParts,
  dayKey,
  dayMenu,
  daySouvenirs,
  diningForSpot,
  sunLine,
  tidyRoot,
  absorbSaved,
  deleteTrip,
  downloadTrip,
  loadNote,
  loadChecks,
  loadTrips,
  loadUi,
  loadVisits,
  mapLink,
  parseTripFile,
  saveNote,
  saveUi,
  timingLabel,
  todayDay,
  tripStats,
  tripTiming,
  upsertTrips,
  visitKey,
  mealVisitKey,
  hotelVisitKey,
  writeCheck,
  writeVisit,
  addExtra,
  addWish,
  loadExtras,
  loadWishes,
  planItems,
  removeExtra,
  removeWish,
  addDayPlace,
  dayDwellStats,
  findDayEntry,
  formatDwell,
  moveDayEntry,
  planEntries,
  promoteWishToDay,
  removeDayEntry,
  reorderDayTimeline,
  saveTrips,
  setEntryDwell,
  shiftVisitsOnRemove,
  writeTripVisits,
  type PlanEntry,
  type DayEntry,
  type ExtraStop,
  type WishKind,
  type TripBook,
  type TripSpot,
  type TripDay,
  type TripGuide,
  type Ride,
  type TripSnapshot,
} from "@/lib/trip";
import { t } from "@/lib/i18n";
import { DrivePanel } from "@/components/drive-panel";
import { syncTripDriveIfDue } from "@/lib/drive-sync";
import { AI_TRIP_PROMPT, planningPackPrompt, wishUpdatePrompt, type PlanPackDay } from "@/lib/ai-prompt";
import { LOGGED_KEY, MONEY_WINDOW, openMoney, plainClick, dayCostItems, dayIdForDate, formatSpend, moneyEstimateUrl, rideRef, rideSpendLabel, tripCosts, tripEstimate, type SpendItem, type TripCosts, loadLoggedKeys, loadMoneyLinks, loadSentKeys, markSent, moneyLinkBackUrl, moneySpendUrl, moneyTripIdForBook, rankTripBooks, readMoneyRef, rememberMoneyRef, saveMoneyLink, spendItem, spendTimeHint, type MoneyTripRef, type SpendCategory } from "@/lib/money-link";
import { placeFromMaps, resolveMapsPlace, shortMapsLink } from "@/lib/maps-place";
import { startLocate, type PlaceFix } from "@/lib/geo";

const TAB_ICON: Record<string, LucideIcon> = {
  overview: BookOpen,
  days: CalendarDays,
  transport: TrainFront,
  map: MapPin,
  eat: Coffee,
  more: MoreHorizontal,
  costs: Wallet,
  photo: Camera,
  food: Coffee,
  souvenir: Gift,
  practical: Info,
};

/** Bottom dock: five fixed slots. 總覽 / 指南 / 費用 live under 更多. */
const DOCK_TABS = ["days", "map", "transport", "eat", "more"] as const;
type DockTab = (typeof DOCK_TABS)[number];
const DOCK_LABEL: Record<DockTab, Parameters<typeof t>[0]> = {
  days: "tab.days",
  map: "tab.map",
  transport: "tab.transport",
  eat: "tab.eat",
  more: "tab.more",
};

function coverOf(trip: TripBook): string {
  for (const day of trip.days) {
    const image = day.images.find((item) => item.src);
    if (image) return image.src;
  }
  return "";
}

function dayChip(day: TripDay, names?: Record<string, string>): { num: string; hint: string } {
  return dayChipParts(day, names);
}

function tripSpan(trip: TripBook): string {
  const dates = dayDates(trip).filter((date): date is Date => date instanceof Date);
  if (!dates.length) return "";
  const fmt = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;
  const first = dates[0];
  const last = dates[dates.length - 1];
  return first.getTime() === last.getTime() ? `${first.getFullYear()} · ${fmt(first)}` : `${first.getFullYear()} · ${fmt(first)} – ${fmt(last)}`;
}

function labelTables(root: ParentNode) {
  root.querySelectorAll("table").forEach((table) => {
    const headers = [...table.querySelectorAll("thead th")].map((th) => (th.textContent || "").trim());
    table.classList.add("stackable");
    table.querySelectorAll("tbody tr").forEach((tr) => {
      const cells = [...tr.children].filter((cell): cell is HTMLElement => cell instanceof HTMLElement);
      const dataCells = cells.filter((cell) => !cell.classList.contains("book-cell"));
      // Align thead labels with body cells (book-cell may be prepended on both).
      const headLabels = headers.filter((_, index) => {
        const th = table.querySelectorAll("thead th")[index];
        return !(th instanceof HTMLElement && th.classList.contains("book-cell"));
      });
      dataCells.forEach((cell, index) => {
        cell.classList.remove("row-title", "row-meta");
        delete cell.dataset.label;
        const header = headLabels[index] || "";
        if (header && header !== "已訂") {
          cell.dataset.label = header;
          return;
        }
        if (dataCells.length === 2 && !headLabels.some(Boolean)) {
          cell.dataset.label = index === 0 ? "項目" : "詳情";
          return;
        }
        // Headerless multi-col: first cell is the row title; rest are plain meta. Never 「欄 N」.
        if (index === 0) cell.classList.add("row-title");
        else cell.classList.add("row-meta");
      });
    });
  });
}

function isBookingRow(text: string): boolean {
  return /預約|已訂|已book|航班|住宿|酒店|起飛/i.test(text) || /→|->/.test(text);
}

function isBookingLine(text: string): boolean {
  if (/^(航班|酒店|住宿)/.test(text)) return true;
  if (text.length > 80) return false;
  return /要預約|已預約|建議預約|必預約|強制.{0,8}預約/.test(text);
}

function bookingBox(tripId: string, key: string, on: boolean, mark: Element): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = "book-check";
  input.checked = on;
  input.setAttribute("aria-label", "已預訂");
  mark.classList.toggle("is-booked", on);
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("change", () => {
    writeCheck(tripId, key, input.checked);
    mark.classList.toggle("is-booked", input.checked);
    window.dispatchEvent(new Event("trip-checks"));
  });
  return input;
}

function mountBookingChecks(root: HTMLElement, tripId: string, allRows: boolean) {
  const checks = loadChecks(tripId);
  root.querySelectorAll("table").forEach((table) => {
    let any = false;
    table.querySelectorAll("tbody tr").forEach((row) => {
      if (row.querySelector(".book-check")) return;
      const name = (row.querySelector("td")?.textContent || "").replace(/\s+/g, " ").trim();
      const blob = (row.textContent || "").replace(/\s+/g, " ").trim();
      if (!name) return;
      if (!allRows && !isBookingRow(blob)) return;
      any = true;
      const cell = document.createElement("td");
      cell.className = "book-cell";
      cell.append(bookingBox(tripId, name.slice(0, 96), Boolean(checks[name.slice(0, 96)]), row));
      row.prepend(cell);
    });
    if (!any) return;
    const head = table.querySelector("thead tr");
    if (head && !head.querySelector(".book-cell")) {
      const th = document.createElement("th");
      th.className = "book-cell";
      th.textContent = "已訂";
      head.prepend(th);
    }
  });
  root.querySelectorAll("p, li").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.closest("table") || el.querySelector(".book-check") || el.querySelector("p, li, table")) return;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length < 4 || text.length > 280 || !isBookingLine(text)) return;
    const key = text.slice(0, 96);
    const label = document.createElement("label");
    label.className = "book-inline";
    label.append(bookingBox(tripId, key, Boolean(checks[key]), el));
    el.prepend(label);
  });
  labelTables(root);
}

function collectBookingKeys(root: ParentNode, allRows: boolean, into: Set<string>) {
  root.querySelectorAll("table").forEach((table) => {
    table.querySelectorAll("tbody tr").forEach((row) => {
      const name = (row.querySelector("td")?.textContent || "").replace(/\s+/g, " ").trim();
      const blob = (row.textContent || "").replace(/\s+/g, " ").trim();
      if (!name) return;
      if (!allRows && !isBookingRow(blob)) return;
      into.add(name.slice(0, 96));
    });
  });
  root.querySelectorAll("p, li").forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.closest("table") || el.querySelector("p, li, table")) return;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length < 4 || text.length > 280 || !isBookingLine(text)) return;
    into.add(text.slice(0, 96));
  });
}

function htmlRoot(html: string): HTMLElement | null {
  const doc = new DOMParser().parseFromString(`<div id="keys">${html}</div>`, "text/html");
  return doc.getElementById("keys");
}

function bookingKeys(trip: TripBook): string[] {
  if (typeof DOMParser === "undefined") return [];
  const keys = new Set<string>();
  const html = shownHtml(trip.overviewHtml);
  const parts = splitOverview(html);
  if (!parts.rest.length) {
    const root = htmlRoot(html);
    if (root) collectBookingKeys(root, sectionIsBooking(html), keys);
  } else {
    const lead = htmlRoot(parts.lead);
    const first = htmlRoot(parts.first);
    if (lead) collectBookingKeys(lead, false, keys);
    if (first) collectBookingKeys(first, sectionIsBooking(parts.first), keys);
    for (const section of parts.rest) {
      const root = htmlRoot(section.html);
      if (root) collectBookingKeys(root, /預訂|預約/.test(section.title), keys);
    }
  }
  for (const day of trip.days) {
    const root = htmlRoot(`${day.leadHtml}${day.walkHtml}${day.foodHtml}${day.noteHtml}`);
    if (root) collectBookingKeys(root, false, keys);
  }
  return [...keys];
}

function bookingProgress(trip: TripBook): { done: number; total: number } {
  const keys = bookingKeys(trip);
  const checks = loadChecks(trip.id);
  return { done: keys.filter((key) => checks[key]).length, total: keys.length };
}

function plainText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type SearchHit = {
  dayId: string;
  kind: "day" | "spot" | "meal" | "hotel" | "guide" | "note" | "wish";
  index: number;
  title: string;
  meta: string;
  guideId?: string;
};

function searchTrip(trip: TripBook, query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 1) return [];
  const hits: SearchHit[] = [];
  for (const day of trip.days) {
    if (`${day.label} ${day.title}`.toLowerCase().includes(needle)) {
      hits.push({ dayId: day.id, kind: "day", index: -1, title: day.title || day.label, meta: day.label });
    }
    const note = loadNote(trip.id, day.id);
    if (note && note.toLowerCase().includes(needle)) {
      hits.push({ dayId: day.id, kind: "note", index: -1, title: note.slice(0, 40), meta: `${day.label} · 筆記` });
    }
    day.spots.forEach((spot, index) => {
      const blob = `${spot.name} ${spot.badge} ${spot.hours} ${spot.address} ${spot.price} ${plainText(spot.html)}`.toLowerCase();
      if (!blob.includes(needle)) return;
      hits.push({ dayId: day.id, kind: "spot", index, title: spot.name, meta: `${day.label}${spot.badge ? ` · ${spot.badge}` : ""}` });
    });
    day.meals.forEach((meal, index) => {
      const blob = `${meal.name} ${meal.place} ${meal.slot} ${meal.note} ${meal.hours} ${meal.address} ${meal.price} ${plainText(meal.html)}`.toLowerCase();
      if (!blob.includes(needle)) return;
      hits.push({ dayId: day.id, kind: "meal", index, title: meal.name, meta: `${day.label}${meal.slot ? ` · ${meal.slot}` : ""} · 🍽️ 用餐` });
    });
    day.hotels.forEach((hotel, index) => {
      const blob = `${hotel.name} ${hotel.badge} ${hotel.hours} ${hotel.address} ${hotel.price} ${plainText(hotel.html)}`.toLowerCase();
      if (!blob.includes(needle)) return;
      hits.push({ dayId: day.id, kind: "hotel", index, title: hotel.name, meta: `${day.label} · 🛏️ 住宿` });
    });
  }
  for (const wish of loadWishes(trip.id)) {
    const blob = `${wish.name} ${wish.note} ${wish.kind}`.toLowerCase();
    if (!blob.includes(needle)) continue;
    const day = trip.days.find((item) => item.id === wish.dayId);
    hits.push({
      dayId: wish.dayId || trip.days[0]?.id || "",
      kind: "wish",
      index: -1,
      title: wish.name,
      meta: `${day?.label || "願望"} · 想去`,
    });
  }
  trip.guides.forEach((guide) => {
    const blob = `${guide.label} ${plainText(guide.html)}`.toLowerCase();
    if (!blob.includes(needle)) return;
    hits.push({
      dayId: trip.days[0]?.id || "",
      kind: "guide",
      index: -1,
      title: chipTitle(guide.label) || guide.label,
      meta: "指南",
      guideId: guide.id,
    });
  });
  hits.sort((a, b) => Number(!(a.kind !== "day" && a.title.toLowerCase().includes(needle))) - Number(!(b.kind !== "day" && b.title.toLowerCase().includes(needle))));
  return hits.slice(0, 40);
}

function focusDay(trip: TripBook, iso: string): { tab: string; dayId: string } {
  const dayId = dayIdForDate(trip, iso) || todayDay(trip)?.id || trip.days[0]?.id || "";
  return { tab: dayId ? "days" : "", dayId };
}

function stopNames(day: TripDay): string[] {
  return [
    ...day.spots.map((spot) => spot.name),
    ...day.meals.map((meal) => meal.name),
    ...day.hotels.map((hotel) => hotel.name),
  ];
}

function tripReplacePreview(prev: TripBook | undefined, next: TripBook): string[] {
  if (!prev) return [`新行程「${next.title}」：${next.days.length} 日`];
  const lines: string[] = [];
  if (prev.title !== next.title) lines.push(`標題：${prev.title} → ${next.title}`);
  const prevIds = new Set(prev.days.map((day) => day.id));
  const nextIds = new Set(next.days.map((day) => day.id));
  for (const day of next.days) {
    const old = prev.days.find((item) => item.id === day.id);
    if (!old) {
      lines.push(`＋ ${day.label || day.id}（新日子，${stopNames(day).length} 站）`);
      continue;
    }
    const before = new Set(stopNames(old));
    const after = stopNames(day);
    const added = after.filter((name) => !before.has(name));
    const removed = [...before].filter((name) => !after.includes(name));
    if (old.label !== day.label || old.title !== day.title) {
      lines.push(`～ ${old.label} → ${day.label}${day.title && day.title !== old.title ? `（${day.title}）` : ""}`);
    }
    if (added.length || removed.length) {
      const bits = [];
      if (added.length) bits.push(`加 ${added.slice(0, 4).join("、")}${added.length > 4 ? "…" : ""}`);
      if (removed.length) bits.push(`減 ${removed.slice(0, 4).join("、")}${removed.length > 4 ? "…" : ""}`);
      lines.push(`· ${day.label || day.id}：${bits.join("；")}`);
    }
  }
  for (const day of prev.days) {
    if (!nextIds.has(day.id)) lines.push(`－ ${day.label || day.id}（會移除日子）`);
  }
  if (!lines.length) lines.push("日子同站點大致相同；筆記／打卡／願望會喺同 id 保留。");
  else lines.push("筆記、打卡、願望會喺相同 id 保留。");
  return lines.slice(0, 12);
}

export function TripApp() {
  const [ready, setReady] = useState(false);
  const [trips, setTrips] = useState<TripBook[]>([]);
  const [openId, setOpenId] = useState("");
  const [tab, setTab] = useState("");
  const [dayId, setDayId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [promptFallback, setPromptFallback] = useState(false);
  const [rev, setRev] = useState(0);
  const [moneyAsk, setMoneyAsk] = useState<MoneyTripRef | null>(null);
  const [pendingImport, setPendingImport] = useState<{ books: TripBook[]; source: string; lines: string[]; raw: string } | null>(null);
  const [undo, setUndo] = useState<TripSnapshot | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const undoTimer = useRef<number | undefined>(undefined);
  const ordered = useMemo(() => sortTrips(trips), [trips]);

  useEffect(() => () => window.clearTimeout(undoTimer.current), []);

  useEffect(() => {
    window.name = "trip-planner";
    const stored = loadTrips();
    const ui = loadUi();
    setTrips(stored);
    const returning =
      window.location.hash.includes("access_token") || window.location.hash.includes("error=");
    const money = returning ? null : readMoneyRef(window.location.search);
    const live = stored.find((trip) => todayDay(trip));
    if (money?.pick) {
      rememberMoneyRef(money);
      setMoneyAsk(money);
      setStatus("揀邊一個行程書係呢趟。揀完會寫返理財 App。");
      const url = new URL(window.location.href);
      for (const key of ["money", "start", "end", "name", "dest", "book", "pick", "day"]) url.searchParams.delete(key);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    } else if (money) {
      rememberMoneyRef(money);
      const ranked = rankTripBooks(stored, money, loadMoneyLinks());
      if (ranked.best) {
        saveMoneyLink(money.id, ranked.best.id);
        rememberMoneyRef({ ...money, book: ranked.best.id });
        const opened = focusDay(ranked.best, money.day);
        setOpenId(ranked.best.id);
        setTab(opened.tab);
        setDayId(opened.dayId);
        setStatus(`已打開同「${money.name || money.dest || "呢趟"}」同一趟。`);
      } else {
        setMoneyAsk(money);
        setStatus(stored.length ? "揀邊一個行程書係呢趟。" : "呢部機未有行程。上傳之後再配對。");
      }
      const url = new URL(window.location.href);
      for (const key of ["money", "start", "end", "name", "dest", "book", "pick", "day"]) url.searchParams.delete(key);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    } else if (!returning && live) {
      setOpenId(live.id);
      setTab("days");
      setDayId(todayDay(live)?.id || "");
    } else if (!returning && ui.openId && stored.some((trip) => trip.id === ui.openId)) {
      setOpenId(ui.openId);
      setTab(ui.tab);
      setDayId(ui.dayId);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (window.location.hash.includes("access_token") || window.location.hash.includes("error=")) return;
    let cancel = false;
    void syncTripDriveIfDue().then((result) => {
      if (cancel || (result !== "pulled" && result !== "pushed")) return;
      if (result === "pulled") {
        const next = loadTrips();
        setTrips(next);
        setOpenId((id) => (next.some((trip) => trip.id === id) ? id : ""));
        setRev((value) => value + 1);
      }
      setStatus(result === "pulled" ? "已從 Google Drive 更新今日行程。" : "已將行程同步上 Google Drive。");
    });
    return () => {
      cancel = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    saveUi({ openId, tab, dayId });
  }, [ready, openId, tab, dayId]);

  const openTrip = trips.find((trip) => trip.id === openId) || null;

  function importBooks(incoming: TripBook[], source: string) {
    const result = upsertTrips(trips, incoming);
    setTrips(result.trips);
    setError("");
    const parts = [];
    if (result.added) parts.push(`加入 ${result.added} 個行程`);
    if (result.updated) parts.push(`更新 ${result.updated} 個行程（筆記保留）`);
    setStatus(`${source}：${parts.join("，") || "沒有變更"}`);
    if (incoming.length === 1) {
      const trip = incoming[0];
      if (!trip) return;
      setOpenId(trip.id);
      setTab("");
      setDayId(trip.days[0]?.id || "");
    }
  }

  async function onFile(file: File) {
    try {
      const raw = await file.text();
      const books = parseTripFile(raw);
      const replacing = books.filter((book) => trips.some((trip) => trip.id === book.id));
      if (replacing.length) {
        const lines = replacing.flatMap((book) => {
          const prev = trips.find((trip) => trip.id === book.id);
          return [`【${book.title || book.id}】`, ...tripReplacePreview(prev, book)];
        });
        setPendingImport({ books, source: file.name, lines, raw });
        setError("");
        setStatus("上傳會更新現有行程，請確認變更。");
        return;
      }
      absorbSaved(raw);
      importBooks(books, file.name);
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : "無法讀取行程檔");
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_TRIP_PROMPT);
      setError("");
      setStatus("已複製提示詞。貼去 AI 後，佢會先問你，再用繁體中文出 JSON。");
    } catch {
      setStatus("");
      setError("複製失敗，請長按下面文字再複製。");
      setPromptFallback(true);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) void onFile(file);
  }

  if (!ready) {
    return (
      <main className="shell">
        <p className="muted">載入緊呢部機嘅行程…</p>
      </main>
    );
  }

  if (!openTrip) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <strong>行程</strong>
            <span>只存在呢部手機</span>
          </div>
          <button className="btn primary" type="button" onClick={() => fileRef.current?.click()}>
            <Upload size={18} aria-hidden="true" />
            上傳
          </button>
        </header>
        <main className="shell">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = "";
            }}
          />
          {pendingImport ? (
            <section className="import-preview">
              <h2>確認更新行程</h2>
              <p className="muted">{pendingImport.source}</p>
              <ul>
                {pendingImport.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="here-actions">
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => {
                    const payload = pendingImport;
                    if (!payload) return;
                    setPendingImport(null);
                    absorbSaved(payload.raw);
                    importBooks(payload.books, payload.source);
                  }}
                >
                  確認更新
                </button>
                <button className="btn ghost" type="button" onClick={() => setPendingImport(null)}>
                  取消
                </button>
              </div>
            </section>
          ) : null}
          {trips.length === 0 ? (
            <section className="empty">
              <p className="empty-lead">平常做法：撳「用 AI 寫行程」，問完之後下載 JSON，再上傳呢度睇。</p>
              <button
                className={dragOver ? "dropzone over" : "dropzone"}
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                <Upload size={28} aria-hidden="true" />
                <strong>上傳 AI 產出嘅行程</strong>
                <span>唔使手寫 JSON。檔案只存在呢部手機，亦可選同步 Google Drive</span>
              </button>
            </section>
          ) : (
            <section>
              <div className="lib-head">
                <h1>我的行程</h1>
                <p className="muted">撳一張卡打開。{t("lib.reupload")}筆記保留。</p>
              </div>
              <div className="trip-grid">
                {ordered.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onOpen={() => {
                      const today = todayDay(trip);
                      setOpenId(trip.id);
                      setTab(today ? "days" : "");
                      setDayId(today?.id || trip.days[0]?.id || "");
                      setStatus("");
                      setError("");
                    }}
                    onDelete={() => {
                      const snap = snapshotTrip(trips, trip.id);
                      setTrips(deleteTrip(trips, trip.id));
                      setStatus("");
                      window.clearTimeout(undoTimer.current);
                      setUndo(snap);
                      undoTimer.current = window.setTimeout(() => setUndo(null), 7000);
                    }}
                    onPick={
                      moneyAsk
                        ? () => {
                            saveMoneyLink(moneyAsk.id, trip.id);
                            rememberMoneyRef({ ...moneyAsk, book: trip.id });
                            if (moneyAsk.pick) {
                              // Reuse the MoneyTracker tab (window name "money-tracker") instead of replacing this one.
                              const back = moneyLinkBackUrl(moneyAsk, trip.id, trip.title);
                              if (openMoney(back) === "here") return;
                            }
                            setMoneyAsk(null);
                            const opened = focusDay(trip, moneyAsk.day);
                            setOpenId(trip.id);
                            setTab(opened.tab);
                            setDayId(opened.dayId);
                            setStatus(`已配對「${trip.title}」。`);
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          )}
          {status ? <p className="status">{status}</p> : null}
          {undo ? (
            <div className="undo-toast" role="status">
              <span>{t("lib.deleted", { title: undo.trip.title })}</span>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  window.clearTimeout(undoTimer.current);
                  setTrips((current) => restoreTrip(current, undo));
                  setStatus(t("lib.restored", { title: undo.trip.title }));
                  setUndo(null);
                }}
              >
                {t("lib.undo")}
              </button>
            </div>
          ) : null}
          {moneyAsk ? (
            <p className="status">
              理財 App 想打開「{moneyAsk.name || moneyAsk.dest || "呢趟"}」
              {moneyAsk.start ? ` · ${moneyAsk.start} → ${moneyAsk.end}` : ""}。撳「呢個就係」先配對。
            </p>
          ) : null}
          {error ? <p className="status error">{error}</p> : null}
          <p className="prompt-row">
            <button className="prompt-link" type="button" onClick={() => void copyPrompt()}>
              <Copy size={16} aria-hidden="true" />
              用 AI 寫行程
            </button>
          </p>
          {promptFallback ? (
            <textarea className="prompt-box" readOnly value={AI_TRIP_PROMPT} />
          ) : null}
          <DrivePanel onLibraryChange={() => setTrips(loadTrips())} />
        </main>
      </div>
    );
  }

  return (
    <Book
      key={`${openTrip.id}-${rev}`}
      trip={openTrip}
      tab={tab}
      dayId={dayId}
      onTab={setTab}
      onDay={setDayId}
      onBack={() => setOpenId("")}
      onTrip={(next) => {
        const list = trips.map((item) => (item.id === next.id ? next : item));
        saveTrips(list);
        setTrips(list);
      }}
    />
  );
}

function TripCard({
  trip,
  onOpen,
  onDelete,
  onPick,
}: {
  trip: TripBook;
  onOpen: () => void;
  onDelete: () => void;
  onPick?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const cover = coverOf(trip);
  const cities = [...new Set(trip.days.map((day) => day.city).filter(Boolean))];
  const progress = bookingProgress(trip);
  return (
    <article className="trip-tile">
      <button className="trip-open" type="button" onClick={onOpen}>
        {cover ? <img className="trip-cover" src={cover} alt="" /> : <span className="trip-cover empty-cover" />}
        <span className="trip-copy">
          <strong>{trip.title}</strong>
          {trip.subtitle ? <span className="muted">{trip.subtitle}</span> : null}
          {cities.length ? (
            <span className="chips">
              {cities.map((city) => (
                <span className={`chip city-${city}`} key={city}>
                  {cityLabel(city, trip.cityNames)}
                </span>
              ))}
            </span>
          ) : null}
          <span className="muted">{tripStats(trip)}</span>
          {onPick && tripSpan(trip) ? <span className="muted">{tripSpan(trip)}</span> : null}
          {timingLabel(tripTiming(trip)) ? <span className="when">{timingLabel(tripTiming(trip))}</span> : null}
          {progress.total ? <span className="muted">已訂 {progress.done}／{progress.total}</span> : null}
        </span>
      </button>
      <div className="tile-actions">
        {onPick ? (
          <button className="btn primary" type="button" onClick={onPick}>
            呢個就係
          </button>
        ) : null}
        <button className="icon-btn" type="button" aria-label="儲存行程" onClick={() => void downloadTrip(trip)}>
          <Download size={18} aria-hidden="true" />
        </button>
        <button className="icon-btn" type="button" aria-label="刪除行程" onClick={() => setConfirm(true)}>
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
      {confirm ? (
        <div className="confirm-row">
          <span>刪除呢個行程？</span>
          <button className="btn danger" type="button" onClick={onDelete}>
            刪除
          </button>
          <button className="btn ghost" type="button" onClick={() => setConfirm(false)}>
            取消
          </button>
        </div>
      ) : null}
    </article>
  );
}

function Book({
  trip,
  tab,
  dayId,
  onTab,
  onDay,
  onBack,
  onTrip,
}: {
  trip: TripBook;
  tab: string;
  dayId: string;
  onTab: (id: string) => void;
  onDay: (id: string) => void;
  onBack: () => void;
  onTrip: (next: TripBook) => void;
}) {
  const activeTab = tab || (trip.days.length ? "days" : "overview");
  const activeDay = trip.days.find((day) => day.id === dayId) || trip.days[0];
  const [lightbox, setLightbox] = useState("");
  const [entryAt, setEntryAt] = useState<DayEntry | null>(null);
  const [topicAt, setTopicAt] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [checkTick, setCheckTick] = useState(0);
  const [visitTick, setVisitTick] = useState(0);
  const scrollDay = useRef("");
  const pendingEntry = useRef<DayEntry | undefined>(undefined);
  const pendingTopic = useRef<number | undefined>(undefined);
  const scrollPlace = useRef("");
  const mainRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const costsFrom = useRef("more");

  useEffect(() => {
    if (!lightbox) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox("");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox]);

  useEffect(() => {
    if (mainRef.current) labelTables(mainRef.current);
  }, [activeTab, activeDay?.id, trip.id, topicAt, entryAt]);

  useEffect(() => {
    if (activeTab !== "transport" || !scrollDay.current) return;
    const target = document.getElementById(`leg-${scrollDay.current}`);
    scrollDay.current = "";
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeTab]);

  useEffect(() => {
    if (!scrollPlace.current) return;
    const label = scrollPlace.current;
    scrollPlace.current = "";
    const head = [...document.querySelectorAll("main h2, main h3")].find((el) => (el.textContent || "").includes(label));
    head?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeTab]);

  function onContentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const image = target.closest("figure.refimg img");
    if (image instanceof HTMLImageElement) {
      event.preventDefault();
      setLightbox(image.currentSrc || image.src);
      return;
    }
    const jump = target.closest("[data-goto]");
    if (jump instanceof HTMLElement && jump.dataset.goto) {
      event.preventDefault();
      if (jump.dataset.goto === "transport" && activeDay) scrollDay.current = activeDay.id;
      if (jump.dataset.goto === "food") {
        const food = eatGuides.find((guide) => guide.id === "food" || /美食/.test(guide.label)) || eatGuides[0];
        if (activeDay) scrollPlace.current = cityLabel(activeDay.city, trip.cityNames);
        onTab(food?.id || "food");
        window.scrollTo({ top: 0 });
        return;
      }
      onTab(jump.dataset.goto);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const eatGuides = trip.guides.filter((guide) => guide.id === "food" || guide.id === "souvenir" || /美食|手信/.test(guide.label));
  const eatIds = new Set(eatGuides.map((guide) => guide.id));
  const guideIds = new Set(trip.guides.map((guide) => guide.id));
  const rootTab = eatIds.has(activeTab) || activeTab === "food" || activeTab === "eat"
    ? "eat"
    : guideIds.has(activeTab) || activeTab === "guides"
      ? "guides"
      : activeTab === "days" || activeTab === "transport" || activeTab === "map" || activeTab === "more"
        ? activeTab
        : "overview";
  // Dock highlight: 總覽 / 指南 / 費用 are reached through 更多.
  const dockTab: DockTab = rootTab === "overview" || rootTab === "guides" ? "more" : (rootTab as DockTab);

  const costs = useMemo(() => tripCosts(trip), [trip]);

  useEffect(() => {
    if (pendingEntry.current === undefined) {
      setEntryAt(null);
      return;
    }
    setEntryAt(pendingEntry.current);
    pendingEntry.current = undefined;
  }, [activeDay?.id]);

  useEffect(() => {
    if (pendingTopic.current === undefined) {
      setTopicAt(null);
      return;
    }
    setTopicAt(pendingTopic.current);
    pendingTopic.current = undefined;
  }, [activeTab, trip.id]);

  useEffect(() => {
    const refresh = () => setCheckTick((value) => value + 1);
    window.addEventListener("trip-checks", refresh);
    return () => window.removeEventListener("trip-checks", refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setVisitTick((value) => value + 1);
    window.addEventListener("trip-visits", refresh);
    return () => window.removeEventListener("trip-visits", refresh);
  }, []);

  useEffect(() => {
    if (searching) searchRef.current?.focus();
  }, [searching]);

  const openGuide = guideIds.has(activeTab) && !eatIds.has(activeTab) ? trip.guides.find((guide) => guide.id === activeTab) : undefined;
  const openEat = eatIds.has(activeTab) ? trip.guides.find((guide) => guide.id === activeTab) || eatGuides[0] : undefined;
  const places = useMemo(() => {
    const names: string[] = [];
    for (const day of trip.days) {
      const label = cityLabel(day.city, trip.cityNames);
      if (label && !names.includes(label)) names.push(label);
    }
    for (const guide of trip.guides) {
      if (!(guide.id === "food" || guide.id === "souvenir" || /美食|手信/.test(guide.label))) continue;
      for (const place of guide.places || []) {
        if (place.name && !names.includes(place.name)) names.push(place.name);
      }
    }
    return names;
  }, [trip]);
  const anchored = useMemo(() => placeAnchors(shownHtml(openEat?.html || ""), places), [openEat, places]);
  const guideMenus = useMemo(() => {
    const skip = new Set(
      trip.guides
        .filter((guide) => guide.id === "food" || guide.id === "souvenir" || /美食|手信/.test(guide.label))
        .map((guide) => guide.id),
    );
    return trip.guides
      .filter((guide) => !skip.has(guide.id))
      .map((guide) => {
        const all = guideSlices(guide.html).slices;
        const slices = all.flatMap((slice, index) => {
          const title = chipTitle(slice.title);
          if (!title || title === "內容" || title === chipTitle(guide.label) || /相片|Wikimedia|commons/i.test(title)) return [];
          return [{ title, index }];
        });
        const shown = slices.length
          ? slices
          : all.flatMap((slice, index) => {
              // A one-section guide comes back as a single "內容" slice: list
              // it under the guide's own name instead of hiding it.
              const own = chipTitle(slice.title);
              const title = own && own !== "內容" ? own : chipTitle(guide.label);
              if (!title) return [];
              return [{ title, index }];
            });
        return { guide, slices: shown };
      })
      .filter((menu) => menu.slices.length);
  }, [trip]);
  const guideParsed = useMemo(() => (openGuide ? guideSlices(openGuide.html) : null), [openGuide]);
  const topic = guideParsed && topicAt !== null ? guideParsed.slices[topicAt] : undefined;
  const topicHtml = useMemo(() => (topic ? presentSlice(topic.html) : ""), [topic]);
  const progress = useMemo(() => bookingProgress(trip), [trip, checkTick]);
  const visits = useMemo(() => loadVisits(trip.id), [trip.id, visitTick]);
  const hits = useMemo(() => (searching ? searchTrip(trip, query) : []), [searching, trip, query]);
  const entrySpot = activeDay && entryAt?.kind === "spot" ? activeDay.spots[entryAt.index] : undefined;
  const entryMeal = activeDay && entryAt?.kind === "meal" ? activeDay.meals[entryAt.index] : undefined;
  const entryHotel = activeDay && entryAt?.kind === "hotel" ? activeDay.hotels[entryAt.index] : undefined;
  const detailItem = entrySpot || entryMeal || entryHotel;
  const detailKey =
    activeDay && entryAt
      ? entryAt.kind === "meal"
        ? mealVisitKey(activeDay.id, entryAt.index)
        : entryAt.kind === "hotel"
          ? hotelVisitKey(activeDay.id, entryAt.index)
          : visitKey(activeDay.id, entryAt.index)
      : "";
  const spotView = useMemo(() => (detailItem ? presentSpot(detailItem) : null), [detailItem]);
  let screenTitle = trip.title;
  if (detailItem) screenTitle = detailItem.name;
  else if (rootTab === "days" && activeDay) screenTitle = activeDay.label || activeDay.title;
  else if (rootTab === "transport") screenTitle = t("tab.transport");
  else if (rootTab === "map") screenTitle = t("tab.map");
  else if (rootTab === "more") screenTitle = t("tab.more");
  else if (activeTab === "costs") screenTitle = t("tab.costs");
  else if (rootTab === "eat") screenTitle = t("tab.eat");
  else if (topic) screenTitle = topic.title === "內容" && openGuide ? openGuide.label : topic.title;
  else if (openGuide) screenTitle = openGuide.label;
  else if (rootTab === "guides") screenTitle = t("tab.guides");
  else screenTitle = t("tab.overview");
  const subScreen = Boolean(searching || detailItem || topic || openGuide || activeTab === "costs" || rootTab === "guides" || (rootTab === "overview" && activeTab !== "costs" && trip.days.length));

  function openCosts() {
    costsFrom.current = rootTab === "overview" ? "overview" : "more";
    onTab("costs");
    window.scrollTo({ top: 0 });
  }

  function openHit(hit: SearchHit) {
    setSearching(false);
    setQuery("");
    if (hit.kind === "guide" && hit.guideId) {
      pendingEntry.current = undefined;
      setEntryAt(null);
      onTab(hit.guideId);
      window.scrollTo({ top: 0 });
      return;
    }
    if (hit.kind === "wish" || hit.kind === "note") {
      pendingEntry.current = undefined;
      setEntryAt(null);
      onTab("days");
      if (hit.dayId && hit.dayId !== activeDay?.id) onDay(hit.dayId);
      window.scrollTo({ top: 0 });
      return;
    }
    const entry =
      hit.kind === "spot" || hit.kind === "meal" || hit.kind === "hotel"
        ? { kind: hit.kind, index: hit.index }
        : null;
    pendingEntry.current = entry || undefined;
    onTab("days");
    if (hit.dayId === activeDay?.id) {
      setEntryAt(entry);
      pendingEntry.current = undefined;
    } else {
      onDay(hit.dayId);
    }
    window.scrollTo({ top: 0 });
  }

  function goBack() {
    if (searching) {
      setSearching(false);
      setQuery("");
      return;
    }
    if (entryAt !== null) {
      setEntryAt(null);
      return;
    }
    if (topicAt !== null) {
      pendingTopic.current = undefined;
      setTopicAt(null);
      onTab("guides");
      return;
    }
    if (rootTab === "guides" && openGuide) {
      onTab("guides");
      return;
    }
    if (activeTab === "costs") {
      onTab(costsFrom.current);
      window.scrollTo({ top: 0 });
      return;
    }
    if (subScreen) {
      onTab("more");
      window.scrollTo({ top: 0 });
      return;
    }
    onBack();
  }

  function openDock(id: string) {
    setSearching(false);
    setQuery("");
    setEntryAt(null);
    setTopicAt(null);
    onTab(id);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="app book app-shell" onClick={onContentClick}>
      <header className="topbar">
        <button className="icon-btn" type="button" aria-label={subScreen ? "返回" : "返回行程庫"} onClick={goBack}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        {searching ? (
          <input
            ref={searchRef}
            className="search-input"
            value={query}
            placeholder="搵景點、日子、預約"
            onChange={(event) => setQuery(event.target.value)}
          />
        ) : (
          <p className="top-title">{screenTitle}</p>
        )}
        {searching ? null : (
          <button className="icon-btn" type="button" aria-label="搜尋" onClick={() => setSearching(true)}>
            <Search size={18} aria-hidden="true" />
          </button>
        )}
      </header>
      <main ref={mainRef}>
        {searching ? (
          <section className="screen">
            {!query.trim() ? <p className="muted search-hint">輸入景點、餐廳或者日期</p> : null}
            {query.trim() && !hits.length ? <p className="muted search-hint">冇搵到「{query.trim()}」</p> : null}
            <div className="sheet">
              {hits.map((hit) => (
                <button className="navrow" type="button" key={`${hit.dayId}-${hit.kind}-${hit.index}-${hit.title}`} onClick={() => openHit(hit)}>
                  <span className="navrow-main">
                    <strong>{hit.title}</strong>
                    <span className="pill-hint">{hit.meta}</span>
                  </span>
                  <span className="navrow-go" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {!searching && detailItem && activeDay ? (
          <article className="screen reading">
            {entryMeal ? <p className="spot-badge-row"><span className="badge meal">🍽️ 用餐{entryMeal.slot ? ` · ${entryMeal.slot}` : ""}</span></p> : null}
            {entryHotel ? <p className="spot-badge-row"><span className="badge hotel">🛏️ 住宿</span></p> : null}
            {detailItem.badge ? <p className="spot-badge-row"><span className={`badge ${detailItem.tone}`}>{detailItem.badge}</span></p> : null}
            {mapLink(detailItem) ? (
              <a className="btn primary nav-go" href={mapLink(detailItem)} target="_blank" rel="noopener">
                <Navigation size={18} aria-hidden="true" />
                導航
              </a>
            ) : null}
            {activeDay && detailKey ? (
              <CheckIn
                at={visits[detailKey] || ""}
                onToggle={() => toggleVisit(trip.id, detailKey, visits[detailKey] || "")}
              />
            ) : null}
            {spotView && (spotView.hours || spotView.address || spotView.price) ? (
              <dl className="facts">
                {spotView.hours ? <div><dt>時間</dt><dd>{spotView.hours}</dd></div> : null}
                {spotView.address ? <div><dt>地點</dt><dd>{spotView.address}</dd></div> : null}
                {spotView.price ? <div><dt>費用</dt><dd>{spotView.price}</dd></div> : null}
              </dl>
            ) : null}
            {activeDay && detailItem ? (
              <SpotMoney trip={trip} day={activeDay} itemRef={detailItem.id} label={detailItem.name} price={spotView?.price || detailItem.price} blank category={entryMeal ? "meal" : entryHotel ? "hotel" : "sight"} slot={entryMeal?.slot} hours={entryMeal?.hours || spotView?.hours || detailItem.hours} />
            ) : null}
            {detailItem.image ? (
              <figure className="spot-figure">
                <a href={detailItem.image} target="_blank" rel="noopener">
                  <img src={detailItem.image} alt={detailItem.name} loading="lazy" />
                </a>
              </figure>
            ) : null}
            {spotView ? <SpotBody brief={spotView.brief} deep={spotView.deep} /> : null}
            {detailItem.refLink ? (
              <p className="spot-ref">
                <a href={detailItem.refLink} target="_blank" rel="noreferrer">
                  📖 {detailItem.refLabel || "參考遊記"}
                </a>
              </p>
            ) : null}
            {entrySpot ? <SpotDining day={activeDay} spot={entrySpot} guide={trip.guides.find((item) => item.id === "food" || /美食/.test(item.label))} /> : null}
          </article>
        ) : null}

        {!searching && !detailItem && activeTab === "costs" ? (
          <CostsScreen
            trip={trip}
            costs={costs}
            onDay={(id) => {
              onDay(id);
              onTab("days");
              window.scrollTo({ top: 0 });
            }}
          />
        ) : null}

        {!searching && !detailItem && rootTab === "overview" && activeTab !== "costs" ? (
          <article className="screen reading">
            <h1 className="screen-title">{trip.title}</h1>
            {trip.subtitle ? <p className="lede">{trip.subtitle}</p> : null}
            {trip.tagline ? <p className="lede">{trip.tagline}</p> : null}
            {[...new Set(trip.days.map((day) => day.city).filter(Boolean))].length ? (
              <div className="dayfacts">
                {[...new Set(trip.days.map((day) => day.city).filter(Boolean))].map((city) => (
                  <button
                    className="dayfact"
                    type="button"
                    key={city}
                    onClick={() => {
                      const day = trip.days.find((item) => item.city === city);
                      if (!day) return;
                      onDay(day.id);
                      onTab("days");
                    }}
                  >
                    {cityLabel(city, trip.cityNames)}
                  </button>
                ))}
              </div>
            ) : null}
            {progress.total ? (
              <>
                <p className="booked-line">已訂 {progress.done}／{progress.total}</p>
                <div className="meter" aria-hidden="true">
                  <span style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                </div>
              </>
            ) : null}
            {costs.count ? (
              <button className="cost-entry" type="button" onClick={openCosts}>
                <span>
                  <b>費用</b>
                  <small>{costs.count} 項有價錢 · 每日預計同送去理財</small>
                </span>
                <strong>{totalsLine(costs.totals)}</strong>
              </button>
            ) : null}
            <Overview html={trip.overviewHtml} tripId={trip.id} />
          </article>
        ) : null}

        {!searching && !detailItem && rootTab === "days" && activeDay ? (
          <DayScreen
            trip={trip}
            day={activeDay}
            onDay={(id) => {
              setEntryAt(null);
              onDay(id);
              window.scrollTo({ top: 0 });
            }}
            onSpot={(index) => {
              setEntryAt({ kind: "spot", index });
              window.scrollTo({ top: 0 });
            }}
            onMeal={(index) => {
              setEntryAt({ kind: "meal", index });
              window.scrollTo({ top: 0 });
            }}
            onHotel={(index) => {
              setEntryAt({ kind: "hotel", index });
              window.scrollTo({ top: 0 });
            }}
            onMap={() => onTab("map")}
            visits={visits}
            onTrip={onTrip}
          />
        ) : null}

        {!searching && !detailItem && rootTab === "transport" ? <Transport trip={trip} dayId={activeDay?.id || ""} onDay={onDay} /> : null}

        {!searching && !detailItem && rootTab === "map" && activeDay ? (
          <TripMap
            trip={trip}
            day={activeDay}
            onDay={onDay}
            onEntry={(entry) => {
              setEntryAt(entry);
              onTab("days");
              window.scrollTo({ top: 0 });
            }}
          />
        ) : null}

        {!searching && !detailItem && rootTab === "eat" ? (
          <section className="screen">
            {activeDay ? (
              <div className="food-day-block">
                <div className="daystrip dayjump dayjump-sticky" aria-label="日期">
                  {trip.days.map((item) => {
                    const chip = dayChip(item, trip.cityNames);
                    const on = item.id === activeDay.id;
                    return (
                      <button key={item.id} type="button" className={on ? "daychip on" : "daychip"} aria-current={on ? "date" : undefined} onClick={() => onDay(item.id)}>
                        <b>{chip.num}</b>
                        {chip.hint ? <small>{chip.hint}</small> : null}
                      </button>
                    );
                  })}
                </div>
                <h2 className="section-label">{activeDay.label} · 今日餐</h2>
                {activeDay.meals.length ? (
                  <div className="sheet plan">
                    {activeDay.meals.map((meal, index) => (
                      <article key={`${meal.name}-${index}`} className="food-meal-card">
                        <div className="food-meal-top">
                          <strong>{meal.name}</strong>
                          <span>{[meal.slot, meal.place].filter(Boolean).join(" · ")}</span>
                        </div>
                        {[meal.hours, meal.price, meal.address, meal.note].filter(Boolean).length ? (
                          <p className="food-meal-meta">{[meal.hours, meal.price, meal.address, meal.note].filter(Boolean).join(" · ")}</p>
                        ) : null}
                        <div className="food-meal-actions">
                          <button className="ghost" type="button" onClick={() => { setEntryAt({ kind: "meal", index }); window.scrollTo({ top: 0 }); }}>
                            詳情
                          </button>
                          <SpotMoney trip={trip} day={activeDay} itemRef={meal.id} label={meal.name} price={meal.price} compact blank category="meal" slot={meal.slot} hours={meal.hours} />
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted">今日未列餐。可睇下面美食指南，或喺「想去」加餐廳。</p>
                )}
              </div>
            ) : null}
            {eatGuides.length ? (
              <>
                <div className="segment">
                  {eatGuides.map((guide) => (
                    <button
                      key={guide.id}
                      type="button"
                      className={openEat && guide.id === openEat.id ? "on" : ""}
                      aria-pressed={Boolean(openEat && guide.id === openEat.id)}
                      onClick={() => {
                        onTab(guide.id);
                        window.scrollTo({ top: 0 });
                      }}
                    >
                      {guide.label}
                    </button>
                  ))}
                </div>
                {openEat ? (
                  <>
                    {anchored.anchors.length ? (
                      <div className="daystrip anchorstrip">
                        {anchored.anchors.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="daychip"
                            onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {openEat.places?.length ? (
                      <div className="guide-places sheet">
                        {openEat.places.map((place, index) => (
                          <article className="guide-place" key={`${place.name}-${place.address}-${index}`}>
                            <strong>{place.name}</strong>
                            {[place.city, place.address].filter(Boolean).length ? (
                              <p className="muted">{[place.city, place.address].filter(Boolean).join(" · ")}</p>
                            ) : null}
                            {place.lines?.length ? (
                              <ul className="guide-place-lines">
                                {place.lines.slice(0, 4).map((line) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            ) : null}
                            {place.links?.length ? (
                              <p className="guide-place-links">
                                {place.links.map((link) => (
                                  <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                                    {link.label || "連結"}
                                  </a>
                                ))}
                              </p>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : null}
                    <article className="guide-read eat-read" dangerouslySetInnerHTML={{ __html: anchored.html }} />
                  </>
                ) : null}
              </>
            ) : (
              <p className="soft-hint">暫無美食／手信指南。日常路徑係用 AI 寫行程時一併產出。</p>
            )}
          </section>
        ) : null}

        {!searching && !detailItem && rootTab === "guides" && !openGuide ? (
          <section className="screen">
            <h1 className="screen-title">{t("tab.guides")}</h1>
            {guideMenus.map((menu) => (
              <div key={menu.guide.id}>
                <h2 className="sheet-label">{chipTitle(menu.guide.label)}</h2>
                <div className="sheet">
                  {menu.slices.map((item) => (
                      <button
                        className="navrow"
                        type="button"
                        key={`${menu.guide.id}-${item.index}`}
                        onClick={() => {
                          pendingTopic.current = item.index;
                          setEntryAt(null);
                          onTab(menu.guide.id);
                          window.scrollTo({ top: 0 });
                        }}
                      >
                        <span className="navrow-main">
                          <strong>{item.title}</strong>
                        </span>
                        <span className="navrow-go" aria-hidden="true">›</span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {!searching && !detailItem && openGuide && topicAt === null ? (
          <section className="screen">
            {guideParsed?.lead ? <div className="reading lede-block" dangerouslySetInnerHTML={{ __html: guideParsed.lead }} /> : null}
            <div className="sheet">
              {(guideParsed?.slices || []).map((item, index) => (
                <button
                  className="navrow"
                  type="button"
                  key={`${item.title}-${index}`}
                  onClick={() => {
                    setTopicAt(index);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  <span className="navrow-num">{index + 1}</span>
                  <span className="navrow-main">
                    <strong>{item.title}</strong>
                  </span>
                  <span className="navrow-go" aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {!searching && !detailItem && topic ? (
          <article className="screen reading" dangerouslySetInnerHTML={{ __html: topicHtml || topic.html }} />
        ) : null}

        {!searching && !detailItem && rootTab === "more" ? (
          <MoreScreen
            trip={trip}
            costs={costs}
            hasGuides={guideMenus.length > 0}
            onOpen={(id) => {
              if (id === "costs") {
                openCosts();
                return;
              }
              onTab(id);
              window.scrollTo({ top: 0 });
            }}
            onLibrary={onBack}
          />
        ) : null}

        {trip.footer && !searching && !detailItem && topicAt === null && rootTab !== "map" ? <p className="foot">{trip.footer}</p> : null}
        {!searching && !detailItem && topicAt === null && rootTab === "overview" && activeTab !== "costs" ? (
          <button className="btn save-trip" type="button" onClick={() => void downloadTrip(trip)}>
            <Download size={18} aria-hidden="true" />
            儲存行程
          </button>
        ) : null}
      </main>
      <nav className="dock" aria-label={t("dock.label")}>
        {DOCK_TABS.map((slot) => {
          const Icon = TAB_ICON[slot];
          const on = dockTab === slot;
          const target = slot === "eat" ? eatGuides[0]?.id || "food" : slot;
          return (
            <button key={slot} type="button" aria-current={on ? "page" : undefined} data-on={on ? "true" : undefined} onClick={() => openDock(target)}>
              {Icon ? <Icon size={20} aria-hidden="true" /> : null}
              <span>{t(DOCK_LABEL[slot])}</span>
            </button>
          );
        })}
      </nav>
      {lightbox ? (
        <div className="lightbox" onClick={() => setLightbox("")} role="presentation">
          <img src={lightbox} alt="" />
          <span className="lightbox-hint">輕觸關閉</span>
        </div>
      ) : null}
    </div>
  );
}

function Html({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: shownHtml(html) }} />;
}

function ownText(el: HTMLElement): string {
  return [...el.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function placeAnchors(html: string, places: string[]): { html: string; anchors: { id: string; label: string }[] } {
  if (!html || typeof DOMParser === "undefined") return { html, anchors: [] };
  const doc = new DOMParser().parseFromString(`<div id="place-root">${html}</div>`, "text/html");
  const root = doc.getElementById("place-root");
  if (!root) return { html, anchors: [] };
  const anchors: { id: string; label: string }[] = [];
  const used = new Set<string>();
  for (const head of root.querySelectorAll("h2, h3")) {
    if (!(head instanceof HTMLElement)) continue;
    const text = ownText(head);
    const place = places.find((name) => text === name || text.startsWith(name));
    if (!place || used.has(place)) continue;
    used.add(place);
    const id = `place-${anchors.length}`;
    head.id = id;
    anchors.push({ id, label: place });
  }
  return { html: root.innerHTML, anchors };
}

function splitOverview(html: string): { lead: string; first: string; rest: { title: string; html: string }[] } {
  if (!html || typeof DOMParser === "undefined") return { lead: "", first: html, rest: [] };
  const doc = new DOMParser().parseFromString(`<div id="ov-root">${html}</div>`, "text/html");
  const root = doc.getElementById("ov-root");
  const heads = [...(root?.querySelectorAll("h2") || [])];
  if (!root || heads.length < 2) return { lead: "", first: html, rest: [] };
  const sections = heads.map((head) => {
    const nodes: Node[] = [head];
    let sib = head.nextSibling;
    while (sib) {
      if (sib instanceof HTMLElement && sib.tagName === "H2") break;
      nodes.push(sib);
      sib = sib.nextSibling;
    }
    const wrap = doc.createElement("div");
    nodes.forEach((node) => wrap.append(node.cloneNode(true)));
    return { title: ownText(head) || (head.textContent || "").trim(), html: wrap.innerHTML };
  });
  const lead = root.cloneNode(true) as HTMLElement;
  const firstHead = lead.querySelector("h2");
  if (firstHead?.parentElement) {
    let sib: ChildNode | null = firstHead;
    while (sib) {
      const next: ChildNode | null = sib.nextSibling;
      sib.remove();
      sib = next;
    }
  }
  const first = sections[0];
  return { lead: lead.innerHTML, first: first?.html || "", rest: sections.slice(1).map((section) => {
    const part = new DOMParser().parseFromString(`<div>${section.html}</div>`, "text/html");
    part.querySelector("h2")?.remove();
    return { title: section.title, html: part.body.innerHTML };
  }) };
}

function FoldSection({ title, html, tripId, startOpen }: { title: string; html: string; tripId: string; startOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(startOpen));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && ref.current) mountBookingChecks(ref.current, tripId, /預訂|預約/.test(title));
  }, [open, html, tripId, title]);
  return (
    <section className="fold">
      <button className="fold-bar" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <strong>{title}</strong>
        <span>{open ? "收起" : "展開"}</span>
      </button>
      {open ? <div className="reading" ref={ref} dangerouslySetInnerHTML={{ __html: html }} /> : null}
    </section>
  );
}

function Overview({ html, tripId }: { html: string; tripId: string }) {
  const parts = useMemo(() => splitOverview(shownHtml(html)), [html]);
  const leadRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (leadRef.current) mountBookingChecks(leadRef.current, tripId, false);
    if (firstRef.current) mountBookingChecks(firstRef.current, tripId, sectionIsBooking(parts.first));
  }, [parts.lead, parts.first, tripId]);
  if (!parts.rest.length) {
    return <CheckedHtml html={shownHtml(html)} tripId={tripId} allRows={sectionIsBooking(shownHtml(html))} />;
  }
  return (
    <>
      {parts.lead ? <div className="reading" ref={leadRef} dangerouslySetInnerHTML={{ __html: parts.lead }} /> : null}
      <div className="reading" ref={firstRef} dangerouslySetInnerHTML={{ __html: parts.first }} />
      {parts.rest.map((section) => (
        <FoldSection
          key={section.title}
          title={section.title}
          html={section.html}
          tripId={tripId}
          startOpen={/預訂|預約|預算/.test(section.title)}
        />
      ))}
    </>
  );
}

function CheckedHtml({ html, tripId, allRows }: { html: string; tripId: string; allRows: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) mountBookingChecks(ref.current, tripId, allRows);
  }, [html, tripId, allRows]);
  return <div className="reading" ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}

function sectionIsBooking(html: string): boolean {
  if (typeof DOMParser === "undefined") return /<h2>[^<]*(預訂|預約)/.test(html);
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll("h2")].some((head) => /預訂|預約/.test(head.textContent || ""));
}

function shownHtml(html: string): string {
  if (!html || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div id="shown-root">${html}</div>`, "text/html");
  const root = doc.getElementById("shown-root");
  if (!root) return html;
  for (const details of [...root.querySelectorAll("details")]) {
    details.querySelector("summary")?.remove();
    const parent = details.parentNode;
    if (!parent) continue;
    while (details.firstChild) parent.insertBefore(details.firstChild, details);
    details.remove();
  }
  linkFoodMentions(root);
  tidyRoot(root);
  return root.innerHTML;
}

function linkFoodMentions(root: HTMLElement) {
  const nodes: Text[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    if (node.parentElement?.closest("a")) continue;
    const text = node.nodeValue || "";
    if (!text.includes("「美食咖啡」")) continue;
    const frag = node.ownerDocument.createDocumentFragment();
    const parts = text.split("「美食咖啡」");
    parts.forEach((part, index) => {
      if (part) frag.append(part);
      if (index === parts.length - 1) return;
      frag.append("「");
      const link = node.ownerDocument.createElement("a");
      link.href = "#";
      link.dataset.goto = "food";
      link.textContent = "美食咖啡";
      frag.append(link);
      frag.append("」");
    });
    node.parentNode?.replaceChild(frag, node);
  }
}

function spotHtml(html: string, name: string): string {
  const opened = shownHtml(html);
  if (typeof DOMParser === "undefined") return opened;
  const doc = new DOMParser().parseFromString(`<div id="spot-root">${opened}</div>`, "text/html");
  const root = doc.getElementById("spot-root");
  if (!root) return opened;
  const key = name.replace(/\s+/g, "");
  for (const el of [...root.querySelectorAll("h1, h2, h3, h4, p, .spotname, .badge")]) {
    const text = (el.textContent || "").replace(/\s+/g, "");
    if (!text) continue;
    if (text === key || (key && text.includes(key) && text.length < key.length + 16)) el.remove();
  }
  return root.innerHTML;
}

function afterLabel(text: string, label: string): string {
  const mark = text.indexOf(label);
  if (mark < 0) return text;
  return text.slice(mark + label.length).replace(/^\s*[：:]\s*/, "").trim();
}

function presentSpot(spot: TripSpot): { hours: string; address: string; price: string; brief: string; deep: string } {
  const html = spotHtml(spot.html, spot.name);
  if (typeof DOMParser === "undefined") {
    return { hours: spot.hours, address: spot.address, price: spot.price, brief: html, deep: "" };
  }
  const doc = new DOMParser().parseFromString(`<div id="spot-view">${html}</div>`, "text/html");
  const root = doc.getElementById("spot-view");
  if (!root) return { hours: spot.hours, address: spot.address, price: spot.price, brief: html, deep: "" };
  let hours = spot.hours;
  let address = spot.address;
  let price = spot.price;
  for (const li of [...root.querySelectorAll("li")]) {
    const text = (li.textContent || "").replace(/\s+/g, " ").trim();
    if (!hours && /開放時間|營業時間/.test(text)) {
      hours = afterLabel(text, /營業時間/.test(text) ? "營業時間" : "開放時間");
      li.remove();
    } else if (!address && text.includes("地址")) {
      address = afterLabel(text, "地址");
      li.remove();
    } else if (!price && /門票|票價|費用|價錢|人均/.test(text)) {
      const label = text.includes("門票") ? "門票" : text.includes("票價") ? "票價" : text.includes("費用") ? "費用" : text.includes("人均") ? "人均" : "價錢";
      const value = afterLabel(text, label);
      if (/免費|免票|¥|€|\$/.test(value)) {
        price = value;
        li.remove();
      }
    }
  }
  root.querySelectorAll("ul, ol").forEach((list) => {
    if (!list.children.length) list.remove();
  });
  root.querySelectorAll("a.maplink").forEach((link) => link.remove());
  const deepParts: string[] = [];
  root.querySelectorAll(".deep").forEach((block) => {
    deepParts.push(block.innerHTML);
    block.remove();
  });
  root.querySelectorAll("hr").forEach((rule) => {
    if (!rule.nextElementSibling && !rule.previousElementSibling) rule.remove();
  });
  return { hours, address, price, brief: root.innerHTML, deep: deepParts.join("") };
}

type GuideSlice = { title: string; html: string };

/**
 * Spot description: the brief renders in full, and the 深度導覽 section
 * renders expanded. No clamping, no expand/collapse toggles on the spot
 * detail page — everything is readable without clicking. The reference
 * image (if any) sits above this component in the detail view.
 */
function SpotBody({ brief, deep }: { brief: string; deep: string }) {
  // presentSpot already includes the 深度導覽 <h4> inside deep; drop it here
  // so the section heading below doesn't repeat it.
  const deepBody = deep.replace(/^\s*<h4>.*?<\/h4>/, "");
  return (
    <>
      <div className="spot-body" dangerouslySetInnerHTML={{ __html: brief }} />
      {deep ? (
        <div className="spot-deep">
          <h4>📖 深度導覽</h4>
          <div dangerouslySetInnerHTML={{ __html: deepBody }} />
        </div>
      ) : null}
    </>
  );
}

function headingLabel(el: HTMLElement): string {
  const own = [...el.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return own || (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 28);
}

function chipTitle(raw: string): string {
  return raw.replace(/^[\s\p{Extended_Pictographic}\u2600-\u27BF\uFE0F]+/gu, "").trim() || raw;
}

function htmlOf(nodes: Node[]): string {
  const wrap = document.createElement("div");
  nodes.forEach((node) => wrap.append(node.cloneNode(true)));
  return wrap.innerHTML;
}

function isMediaOnly(nodes: Node[]): boolean {
  const wrap = document.createElement("div");
  nodes.forEach((node) => wrap.append(node.cloneNode(true)));
  return Boolean(wrap.querySelector("img")) && !wrap.querySelector("ul, ol, table, p, h4");
}

function guideSlices(html: string): { lead: string; slices: GuideSlice[] } {
  const whole = [{ title: "內容", html }];
  if (typeof DOMParser === "undefined") return { lead: "", slices: whole };
  const doc = new DOMParser().parseFromString(`<div id="guide-root">${html}</div>`, "text/html");
  const root = doc.getElementById("guide-root");
  if (!root) return { lead: "", slices: whole };
  const h2count = root.querySelectorAll("h2").length;
  const h3count = root.querySelectorAll("h3").length;
  const tag = h2count >= 2 ? "H2" : h3count >= 2 ? "H3" : "";
  if (!tag) return { lead: "", slices: whole };

  const heads = [...root.querySelectorAll(tag)].filter((el): el is HTMLElement => el instanceof HTMLElement);
  const slices: GuideSlice[] = heads.map((head) => {
    const nodes: Node[] = [head];
    let sib = head.nextSibling;
    while (sib) {
      if (sib instanceof HTMLElement && sib.tagName === tag) break;
      nodes.push(sib);
      sib = sib.nextSibling;
    }
    return { title: chipTitle(headingLabel(head)), html: "", nodes } as GuideSlice & { nodes: Node[] };
  });

  const merged: Array<GuideSlice & { nodes: Node[] }> = [];
  for (const slice of slices as Array<GuideSlice & { nodes: Node[] }>) {
    const prev = merged[merged.length - 1];
    if (prev && isMediaOnly(prev.nodes)) {
      prev.nodes = [...prev.nodes, ...slice.nodes];
      if (prev.title.length <= 8) {
        /* keep the short city name */
      } else {
        prev.title = slice.title;
      }
      continue;
    }
    merged.push({ ...slice, nodes: [...slice.nodes] });
  }

  const leadRoot = root.cloneNode(true) as HTMLElement;
  const seen = new Set<HTMLElement>();
  for (const head of leadRoot.querySelectorAll(tag)) {
    const parent = head.parentElement;
    if (!parent || seen.has(parent)) continue;
    seen.add(parent);
    let sib: ChildNode | null = head;
    while (sib) {
      const next: ChildNode | null = sib.nextSibling;
      sib.remove();
      sib = next;
    }
  }
  leadRoot.querySelectorAll("div").forEach((div) => {
    if (!div.textContent?.trim() && !div.querySelector("img")) div.remove();
  });
  const leadText = (leadRoot.textContent || "").replace(/\s/g, "");
  const readySlices = merged
    .map((slice) => ({ title: slice.title, html: htmlOf(slice.nodes) }))
    .filter((slice) => {
      const parsed = new DOMParser().parseFromString(`<div>${slice.html}</div>`, "text/html");
      const box = parsed.body;
      box.querySelector("h1, h2, h3")?.remove();
      const text = (box.textContent || "").replace(/\s/g, "");
      return text.length > 8 || Boolean(box.querySelector("img, table, ul, ol"));
    });
  return {
    lead: leadText.length > 12 ? leadRoot.innerHTML : "",
    slices: readySlices,
  };
}

function foldByHeading(root: HTMLElement, tag: string) {
  const rank = (name: string) => (name === "H2" ? 2 : name === "H3" ? 3 : name === "H4" ? 4 : 9);
  const heads = [...root.querySelectorAll(tag)].filter(
    (el): el is HTMLElement => el instanceof HTMLElement && !el.closest("details"),
  );
  for (const head of heads) {
    if (!head.parentElement || head.closest("details")) continue;
    const details = document.createElement("details");
    details.className = "spot";
    const row = document.createElement("span");
    row.className = "spot-row";
    row.textContent = chipTitle(headingLabel(head)) || "詳情";
    const summary = document.createElement("summary");
    summary.append(row);
    const body = document.createElement("div");
    body.className = "spotbody";
    head.parentElement.insertBefore(details, head);
    details.append(summary, body);
    head.remove();
    let sib = details.nextSibling;
    while (sib) {
      if (sib instanceof HTMLElement && rank(sib.tagName) <= rank(tag)) break;
      const next = sib.nextSibling;
      body.append(sib);
      sib = next;
    }
  }
}

function foldPlaces(root: HTMLElement) {
  for (const extra of [...root.querySelectorAll(".restextra")]) {
    if (!(extra instanceof HTMLElement) || extra.closest("details")) continue;
    const name = extra.previousElementSibling;
    if (!(name instanceof HTMLElement) || name.tagName !== "P") continue;
    const details = document.createElement("details");
    details.className = "spot";
    const row = document.createElement("span");
    row.className = "spot-row";
    row.textContent = (name.textContent || "").replace(/\s+/g, " ").trim() || "詳情";
    const summary = document.createElement("summary");
    summary.append(row);
    const body = document.createElement("div");
    body.className = "spotbody";
    name.replaceWith(details);
    details.append(summary, body);
    body.append(extra);
    let sib = details.nextElementSibling;
    while (sib && !["P", "H2", "H3", "H4", "DETAILS"].includes(sib.tagName)) {
      const next = sib.nextElementSibling;
      body.append(sib);
      sib = next;
    }
  }
}

function presentSlice(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div id="slice">${html}</div>`, "text/html");
  const root = doc.getElementById("slice");
  if (!root) return html;
  tidyRoot(root);
  while (root.children.length === 1 && root.firstElementChild?.classList.contains("card")) {
    const card = root.firstElementChild;
    while (card.firstChild) root.insertBefore(card.firstChild, card);
    card.remove();
  }
  const first = root.firstElementChild;
  if (first && (first.tagName === "H2" || first.tagName === "H3" || first.tagName === "H4")) first.remove();
  for (const head of [...root.querySelectorAll("h2, h3, h4")]) {
    if (!(head instanceof HTMLElement)) continue;
    const kicker = doc.createElement("p");
    kicker.className = "kicker";
    kicker.textContent = chipTitle(headingLabel(head));
    head.replaceWith(kicker);
  }
  return root.innerHTML;
}

function GuidePane({ html }: { html: string }) {
  const parsed = useMemo(() => guideSlices(html), [html]);
  const [index, setIndex] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const many = parsed.slices.length > 1;
  const safeIndex = Math.min(index, parsed.slices.length - 1);
  const slice = parsed.slices[safeIndex];
  const body = useMemo(() => (slice ? presentSlice(slice.html) : ""), [slice]);

  useEffect(() => {
    setIndex(0);
  }, [html]);

  useEffect(() => {
    const current = stripRef.current?.querySelector('[aria-pressed="true"]');
    current?.scrollIntoView({ inline: "center", block: "nearest" });
    if (bodyRef.current) labelTables(bodyRef.current);
  }, [safeIndex, body]);

  if (!slice) return <Html html={html} />;

  return (
    <>
      {parsed.lead ? <div className="guide-lead" dangerouslySetInnerHTML={{ __html: parsed.lead }} /> : null}
      {many ? (
        <div className="pills guide-pills" ref={stripRef} role="tablist" aria-label="分段">
          {parsed.slices.map((item, itemIndex) => (
            <button
              key={`${item.title}-${itemIndex}`}
              className="pill text-pill"
              type="button"
              aria-pressed={itemIndex === safeIndex}
              onClick={() => {
                setIndex(itemIndex);
                document.getElementById("guide-body")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span className="pill-hint">{item.title}</span>
            </button>
          ))}
        </div>
      ) : null}
      <div id="guide-body" className="guide-read" ref={bodyRef} dangerouslySetInnerHTML={{ __html: body || slice.html }} />
      {many ? (
        <nav className="guidenav" aria-label="前後段">
          <button className="btn" type="button" disabled={safeIndex === 0} onClick={() => setIndex(safeIndex - 1)}>
            <ChevronLeft size={18} aria-hidden="true" />
            上一段
          </button>
          <span className="daynav-now">
            {safeIndex + 1}
            <small>/{parsed.slices.length}</small>
          </span>
          <button
            className="btn"
            type="button"
            disabled={safeIndex === parsed.slices.length - 1}
            onClick={() => setIndex(safeIndex + 1)}
          >
            下一段
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </>
  );
}

function DayScreen({
  trip,
  day,
  visits,
  onDay,
  onSpot,
  onMeal,
  onHotel,
  onMap,
  onTrip,
}: {
  trip: TripBook;
  day: TripDay;
  visits: Record<string, string>;
  onDay: (id: string) => void;
  onSpot: (index: number) => void;
  onMeal: (index: number) => void;
  onHotel: (index: number) => void;
  onMap: () => void;
  onTrip: (next: TripBook) => void;
}) {
  const index = trip.days.findIndex((item) => item.id === day.id);
  const rationale = trip.rationales.find((item) => item.city && item.city === day.city);
  const todayKey = dayKey(day.label) || dayKey(day.title);
  const todayPoint = rationale?.points.find((point) => dayKey(point.label) === todayKey);
  const otherPoints = rationale?.points.filter((point) => point !== todayPoint) || [];
  const route = planItems(day);
  const headline = dayHeadline(day);
  const live = todayDay(trip)?.id === day.id;
  // While the trip is on, today's screen leads with 下一站 + the timeline;
  // the big cover photo drops below as a thumbnail.
  const hero = live ? undefined : day.images[0];
  const moreImages = live ? day.images : day.images.slice(1);
  const chipRef = useRef<HTMLButtonElement>(null);
  const readRef = useRef<HTMLDivElement>(null);
  // Unified-timeline days count check-ins over every timeline entry (sights +
  // meals + hotels); legacy days count sights only, as before.
  const seen = day.timeline.length
    ? day.timeline.filter((entryId) => {
        const spotIndex = day.spots.findIndex((spot) => spot.id === entryId);
        if (spotIndex >= 0) return Boolean(visits[visitKey(day.id, spotIndex)]);
        const mealIndex = day.meals.findIndex((meal) => meal.id === entryId);
        if (mealIndex >= 0) return Boolean(visits[mealVisitKey(day.id, mealIndex)]);
        const hotelIndex = day.hotels.findIndex((hotel) => hotel.id === entryId);
        return hotelIndex >= 0 && Boolean(visits[hotelVisitKey(day.id, hotelIndex)]);
      }).length
    : day.spots.filter((_, spotIndex) => visits[visitKey(day.id, spotIndex)]).length;
  const totalEntries = day.timeline.length || day.spots.length;
  useEffect(() => {
    const strip = chipRef.current?.parentElement;
    const chip = chipRef.current;
    if (!strip || !chip) return;
    strip.scrollTo({ left: chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" });
  }, [day.id]);
  useEffect(() => {
    if (readRef.current) mountBookingChecks(readRef.current, trip.id, false);
  }, [day, trip.id]);
  return (
    <section className="screen">
      <div className="daystrip dayjump dayjump-sticky" aria-label="日期">
        {trip.days.map((item) => {
          const chip = dayChip(item, trip.cityNames);
          const on = item.id === day.id;
          return (
            <button
              key={item.id}
              type="button"
              ref={on ? chipRef : undefined}
              className={on ? "daychip on" : "daychip"}
              aria-current={on ? "date" : undefined}
              onClick={() => onDay(item.id)}
            >
              <b>{chip.num}</b>
              {chip.hint ? <small>{chip.hint}</small> : null}
            </button>
          );
        })}
      </div>
      {live ? <NextStopCard trip={trip} day={day} visits={visits} onSpot={onSpot} onMeal={onMeal} onHotel={onHotel} /> : null}
      {titleDayCountHint(trip.title, trip.subtitle, trip.days.length) ? (
        <p className="soft-hint day-count-hint">{titleDayCountHint(trip.title, trip.subtitle, trip.days.length)}</p>
      ) : null}
      {hero ? (
        <figure className="refimg cover">
          <a href={hero.href || hero.src} target="_blank" rel="noopener">
            <img src={hero.src} alt={hero.caption || headline.objective} loading="lazy" />
          </a>
          {hero.caption ? <div className="attr">{cleanCredit(hero.caption)}</div> : null}
          <figcaption>
            <p className="eyebrow">
              第 {index + 1} / {trip.days.length} 日
              {day.city ? ` · ${cityLabel(day.city, trip.cityNames)}` : ""}
            </p>
            <p className="day-when">{headline.when}</p>
            <h1>{headline.objective}</h1>
          </figcaption>
        </figure>
      ) : (
        <>
          <p className="eyebrow">
            第 {index + 1} / {trip.days.length} 日
            {day.city ? ` · ${cityLabel(day.city, trip.cityNames)}` : ""}
          </p>
          <p className="day-when">{headline.when}</p>
          <h1 className="screen-title day-objective">{headline.objective}</h1>
        </>
      )}
      {moreImages.length && !live ? (
        <div className="dayimgs thumbs">
          {moreImages.map((image) => (
            <figure className="refimg" key={image.src}>
              <a href={image.href || image.src} target="_blank" rel="noopener">
                <img src={image.src} alt={image.caption || headline.objective} loading="lazy" />
              </a>
            </figure>
          ))}
        </div>
      ) : null}
      {live ? null : <DayFacts day={day} />}
      <div ref={readRef}>
        {day.leadHtml ? (
          leadLong(day.leadHtml) ? (
            <details className="fold day-brief">
              <summary className="fold-bar">
                <strong>今日注意</strong>
                <span />
              </summary>
              <div className="reading">
                <Html html={day.leadHtml} />
              </div>
            </details>
          ) : (
            <div className="reading day-brief">
              <Html html={day.leadHtml} />
            </div>
          )
        ) : null}
      </div>
      {day.spots.length || day.rides.length || day.timeline.length ? (
        <>
          <h2 className="section-label">
            今日行程
            <span className="label-actions">
              <button className="map-jump" type="button" onClick={onMap}>
                地圖
              </button>
              <span className="muted">已去 {seen}／{totalEntries}</span>
            </span>
          </h2>
          {totalEntries ? (
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${Math.round((seen / totalEntries) * 100)}%` }} />
            </div>
          ) : null}
          <div className="timeline">
            {route.map((item) => {
              if (item.kind === "ride")
                return (
                  <RideCard
                    key={`${item.ride.from}-${item.ride.to}-${item.ride.detail}`}
                    trip={trip}
                    day={day}
                    ride={item.ride}
                    onOpenRide={(ride) => {
                      const entryId = ride.entry;
                      if (entryId) {
                        const spotIndex = day.spots.findIndex((spot) => spot.id === entryId);
                        if (spotIndex >= 0) {
                          onSpot(spotIndex);
                          return;
                        }
                        const mealIndex = day.meals.findIndex((meal) => meal.id === entryId);
                        if (mealIndex >= 0) {
                          onMeal(mealIndex);
                          return;
                        }
                        const hotelIndex = day.hotels.findIndex((hotel) => hotel.id === entryId);
                        if (hotelIndex >= 0) {
                          onHotel(hotelIndex);
                          return;
                        }
                      }
                      // Legacy fallback: pair by destination name.
                      const spotIndex = day.spots.findIndex((spot) => spot.name === ride.spot);
                      if (spotIndex >= 0) onSpot(spotIndex);
                    }}
                  />
                );
              if (item.kind === "meal") {
                const mealIndex = item.index;
                const mealItem = day.meals[mealIndex];
                const at = visits[mealVisitKey(day.id, mealIndex)] || "";
                return (
                  <article className={at ? "stop meal done" : "stop meal"} key={`meal-${mealItem.id}`}>
                    <span className="stop-num">{item.num}</span>
                    <div className="stop-card" onClick={() => onMeal(mealIndex)} {...cardKeys(() => onMeal(mealIndex))}>
                      {mealItem.image ? (
                        <img className="stop-thumb" src={mealItem.image} alt="" loading="lazy" />
                      ) : (
                        <span className="stop-thumb empty" aria-hidden="true">🍽️</span>
                      )}
                      <span className="stop-copy">
                        <strong>
                          {mealItem.name}
                          {mealItem.badge ? <em>{mealItem.badge}</em> : null}
                        </strong>
                        <small className="kind-chip">🍽️ 用餐{mealItem.slot ? ` · ${mealItem.slot}` : ""}</small>
                        {mealItem.hours ? <small className="stop-hours">{mealItem.hours}</small> : null}
                        {mealItem.address || mealItem.price ? (
                          <small className="stop-addr">{[mealItem.address, mealItem.price].filter(Boolean).join(" · ")}</small>
                        ) : null}
                        {at ? <span className="pill-hint">{visitClock(at)} 已去</span> : null}
                        <SpotMoney trip={trip} day={day} itemRef={mealItem.id} label={mealItem.name} price={mealItem.price} compact blank category="meal" slot={mealItem.slot} hours={mealItem.hours} />
                      </span>
                      <button
                        className={at ? "stamp on" : "stamp"}
                        type="button"
                        aria-label={at ? "取消打卡" : "打卡"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleVisit(trip.id, mealVisitKey(day.id, mealIndex), at);
                        }}
                      >
                        {at ? "已去" : "打卡"}
                      </button>
                    </div>
                  </article>
                );
              }
              if (item.kind === "hotel") {
                const hotelIndex = item.index;
                const hotelItem = day.hotels[hotelIndex];
                const at = visits[hotelVisitKey(day.id, hotelIndex)] || "";
                return (
                  <article className={at ? "stop hotel done" : "stop hotel"} key={`hotel-${hotelItem.id}`}>
                    <span className="stop-num">{item.num}</span>
                    <div className="stop-card" onClick={() => onHotel(hotelIndex)} {...cardKeys(() => onHotel(hotelIndex))}>
                      {hotelItem.image ? (
                        <img className="stop-thumb" src={hotelItem.image} alt="" loading="lazy" />
                      ) : (
                        <span className="stop-thumb empty" aria-hidden="true">🛏️</span>
                      )}
                      <span className="stop-copy">
                        <strong>
                          {hotelItem.name}
                          {hotelItem.badge ? <em>{hotelItem.badge}</em> : null}
                        </strong>
                        <small className="kind-chip">🛏️ 住宿</small>
                        {hotelItem.hours ? <small className="stop-hours">{hotelItem.hours}</small> : null}
                        {hotelItem.address || hotelItem.price ? (
                          <small className="stop-addr">{[hotelItem.address, hotelItem.price].filter(Boolean).join(" · ")}</small>
                        ) : null}
                        {at ? <span className="pill-hint">{visitClock(at)} 已去</span> : null}
                      </span>
                      <button
                        className={at ? "stamp on" : "stamp"}
                        type="button"
                        aria-label={at ? "取消打卡" : "打卡"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleVisit(trip.id, hotelVisitKey(day.id, hotelIndex), at);
                        }}
                      >
                        {at ? "已去" : "打卡"}
                      </button>
                    </div>
                  </article>
                );
              }
              const spotIndex = item.index;
              const spotItem = day.spots[spotIndex];
              const at = visits[visitKey(day.id, spotIndex)] || "";
              return (
                <article className={at ? "stop done" : "stop"} key={`${spotItem.name}-${spotIndex}`}>
                  <span className="stop-num">{item.num}</span>
                  <div className="stop-card" onClick={() => onSpot(spotIndex)} {...cardKeys(() => onSpot(spotIndex))}>
                    {spotItem.image ? (
                      <img className="stop-thumb" src={spotItem.image} alt="" loading="lazy" />
                    ) : (
                      <span className="stop-thumb empty" aria-hidden="true">📷</span>
                    )}
                    <span className="stop-copy">
                      <strong>
                        {spotItem.name}
                        {spotItem.badge ? <em>{spotItem.badge}</em> : null}
                      </strong>
                      <small className="kind-chip">📷 景點</small>
                      {spotItem.hours ? <small className="stop-hours">{spotItem.hours}</small> : null}
                      {spotItem.address || spotItem.price ? (
                        <small className="stop-addr">{[spotItem.address, spotItem.price].filter(Boolean).join(" · ")}</small>
                      ) : null}
                      {at ? <span className="pill-hint">{visitClock(at)} 已去</span> : null}
                      <SpotMoney trip={trip} day={day} itemRef={spotItem.id} label={spotItem.name} price={spotItem.price} compact blank category="sight" hours={spotItem.hours} />
                    </span>
                    <button
                      className={at ? "stamp on" : "stamp"}
                      type="button"
                      aria-label={at ? "取消打卡" : "打卡"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleVisit(trip.id, visitKey(day.id, spotIndex), at);
                      }}
                    >
                      {at ? "已去" : "打卡"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}
      {live ? <DayFacts day={day} /> : null}
      {live && moreImages.length ? (
        <div className="dayimgs thumbs">
          {moreImages.map((image) => (
            <figure className="refimg" key={image.src}>
              <a href={image.href || image.src} target="_blank" rel="noopener">
                <img src={image.src} alt={image.caption || headline.objective} loading="lazy" />
              </a>
            </figure>
          ))}
        </div>
      ) : null}
      <DayMoneyBatch trip={trip} day={day} />
      {/*
        Keys must differ between these two siblings. Giving both the same
        key={day.id} made React drop the first from its reconciliation map,
        so the old 今日美食 section was never unmounted and a new one
        stacked up on every date switch.
        Unified-timeline days render meals on the timeline itself, so the
        separate 今日美食 box is skipped there (no duplicated meals).
      */}
      {day.timeline.length ? null : <DayMeals key={`meals-${day.id}`} trip={trip} day={day} />}
      <DaySouvenirs key={`souv-${day.id}`} trip={trip} day={day} />
      {day.noteHtml ? (
        <div className="reading day-link">
          <Html html={day.noteHtml} />
        </div>
      ) : null}
      <DayPlanner key={`plan-${day.id}`} trip={trip} day={day} onTrip={onTrip} />
      <ExtraStops tripId={trip.id} dayId={day.id} />
      {rationale ? (
        <section className="why">
          <h2>點解今日咁排</h2>
          {todayPoint ? (
            <p>{todayPoint.text}</p>
          ) : rationale.summary ? (
            <p className="why-summary">{rationale.summary}</p>
          ) : null}
          {otherPoints.length ? (
            <details>
              <summary>成個{cityLabel(day.city, trip.cityNames) || "行程"}點排</summary>
              <ul>
                {otherPoints.map((point) => (
                  <li key={`${point.label}-${point.text.slice(0, 12)}`}>
                    {point.label ? <span className="why-day">{point.label}</span> : null}
                    <span>{point.text}</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}
      <DayNotes tripId={trip.id} dayId={day.id} />
    </section>
  );
}


function titleDayCountHint(title: string, subtitle: string, actual: number): string {
  const text = `${title} ${subtitle}`;
  const match = text.match(/(\d+)\s*(?:日|天|days?)/i);
  if (!match) return "";
  const claimed = Number(match[1]);
  if (!claimed || claimed === actual || actual < 1) return "";
  return `標題寫「${claimed}日」，日程實際有 ${actual} 日。`;
}

function accuracyLabel(meters: number): { text: string; coarse: boolean } {
  if (meters >= 1000) {
    const km = Math.round(meters / 100) / 10;
    return { text: `大約 ${km} 公里（較粗，請核對地方名）`, coarse: true };
  }
  if (meters >= 100) return { text: `大約 ${Math.round(meters / 10) * 10} 米`, coarse: false };
  return { text: `大約 ${Math.round(meters)} 米`, coarse: false };
}

function SpotMoney({
  trip,
  day,
  label,
  price,
  compact,
  blank,
  category,
  time,
  slot,
  hours,
  itemRef,
}: {
  trip: TripBook;
  day: TripDay;
  label: string;
  price: string;
  compact?: boolean;
  blank?: boolean;
  category?: SpendCategory;
  time?: string;
  slot?: string;
  hours?: string;
  /** Stable entry id (spot/meal/hotel id) so the same item gets the same key everywhere. */
  itemRef?: string;
}) {
  const marks = useMoneyMarks();
  const clock = time || spendTimeHint(slot || "", hours || "");
  const item = spendItem(trip, day, label, price, blank, category, clock, itemRef || "");
  if (!item) return null;
  const key = item.key || "";
  if (key && marks.logged.has(key)) {
    return (
      <span className={compact ? "money-spot logged" : "btn money-send logged"} onClick={(event) => event.stopPropagation()}>
        {compact ? "✓ 已記" : "✓ 已記入理財"}
      </span>
    );
  }
  const sent = Boolean(key && marks.sent.has(key));
  const href = moneySpendUrl({ trip: trip.title, tripId: moneyTripIdForBook(trip.id), bookId: trip.id, items: [item] });
  return (
    <a
      className={compact ? "money-spot" : "btn primary money-send"}
      href={href}
      target={MONEY_WINDOW}
      onClick={(event) => {
        event.stopPropagation();
        markSent(key);
        marks.bump();
        if (!plainClick(event)) return;
        event.preventDefault();
        openMoney(href);
      }}
    >
      {compact ? (sent ? "已送出" : "入帳") : sent ? "已送去理財，未確認" : "將呢項交去理財確認"}
    </a>
  );
}

const COST_KIND_LABEL: Record<string, string> = { hotel: "住宿", ride: "交通", meal: "餐飲", sight: "景點", other: "其他" };

function totalsLine(totals: TripCosts["totals"] | Record<string, number>): string {
  return Object.entries(totals)
    .map(([currency, value]) => formatSpend(typeof value === "number" ? value : value.all, currency))
    .join(" + ");
}

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** 「記低今日開支」: one tap sends every unlogged priced item on this day to Money's multi-row sheet. */
function DayMoneyBatch({ trip, day, items: given, compact }: { trip: TripBook; day: TripDay; items?: SpendItem[]; compact?: boolean }) {
  const marks = useMoneyMarks();
  const items = given || dayCostItems(trip, day);
  if (!items.length) return null;
  const pending = items.filter((item) => !marks.logged.has(item.key || ""));
  const batch = pending.slice(0, 20);
  const totals: Record<string, number> = {};
  for (const item of items) totals[item.currency] = (totals[item.currency] || 0) + item.amount;
  const logged = items.length - pending.length;
  if (!pending.length) {
    return (
      <div className={compact ? "day-money compact" : "day-money"}>
        <span className="btn money-send logged">✓ 全部已記入理財（{items.length} 項）</span>
        {compact ? null : <p className="soft-hint">預計 {totalsLine(totals)}</p>}
      </div>
    );
  }
  const today = items[0]?.date === localToday();
  const sent = batch.every((item) => marks.sent.has(item.key || ""));
  const href = moneySpendUrl({ trip: trip.title, tripId: moneyTripIdForBook(trip.id), bookId: trip.id, items: batch });
  return (
    <div className={compact ? "day-money compact" : "day-money"}>
      <a
        className="btn primary money-send"
        href={href}
        target={MONEY_WINDOW}
        onClick={(event) => {
          event.stopPropagation();
          for (const item of batch) markSent(item.key || "");
          marks.bump();
          if (!plainClick(event)) return;
          event.preventDefault();
          openMoney(href);
        }}
      >
        {sent ? "已送去理財，未確認 · 再開" : today ? `記低今日開支（${batch.length} 項）` : `記低呢日開支（${batch.length} 項）`}
      </a>
      <p className="soft-hint">
        預計 {totalsLine(totals)}
        {logged ? ` · 已記 ${logged} 項` : ""}
        {pending.length > batch.length ? ` · 一次最多 20 項，記完再撳一次` : ""}
        {batch.some((item) => item.currencyGuess) ? " · 有項目冇寫貨幣，理財會提你核對" : ""}
      </p>
    </div>
  );
}

function CostsScreen({ trip, costs, onDay }: { trip: TripBook; costs: TripCosts; onDay: (id: string) => void }) {
  const marks = useMoneyMarks();
  const estimate = useMemo(() => tripEstimate(trip, costs), [trip, costs]);
  const all = costs.days.flatMap((row) => row.items);
  const loggedCount = all.filter((item) => marks.logged.has(item.key || "")).length;
  const kinds = ["hotel", "ride", "meal", "sight", "other"] as const;
  return (
    <article className="screen reading costs">
      <h1 className="screen-title">費用</h1>
      {!costs.count ? <p className="lede">呢本行程未有寫價錢嘅項目。喺景點、餐廳、住宿或交通寫低價錢，就會喺度計數。</p> : null}
      {costs.count ? (
        <section className="cost-card">
          <p className="cost-label">全程預計</p>
          <p className="cost-total">{totalsLine(costs.totals)}</p>
          <ul className="cost-kinds">
            {Object.entries(costs.totals).flatMap(([currency, bucket]) =>
              kinds
                .filter((kind) => (bucket[kind] || 0) > 0)
                .map((kind) => (
                  <li key={`${currency}-${kind}`}>
                    <span>{COST_KIND_LABEL[kind]}</span>
                    <b>{formatSpend(bucket[kind] || 0, currency)}</b>
                  </li>
                )),
            )}
          </ul>
          <p className="soft-hint">
            {costs.count} 項有價錢 · 已記入理財 {loggedCount}／{costs.count}
            {costs.guessCount ? ` · ${costs.guessCount} 項冇寫明貨幣，暫當 ${costs.currency || "HKD"}` : ""}
          </p>
          <a
            className="btn primary money-send"
            href={moneyEstimateUrl(estimate)}
            target={MONEY_WINDOW}
            onClick={(event) => {
              if (!plainClick(event)) return;
              event.preventDefault();
              openMoney(moneyEstimateUrl(estimate));
            }}
          >
            送去理財做旅程預算
          </a>
          <p className="soft-hint">理財會用佢嘅匯率換成港幣，等你對比或者設定呢個旅程嘅預算。只計有寫價錢嘅項目。</p>
        </section>
      ) : null}
      {costs.days.map((row) => {
        if (!row.items.length) return null;
        return (
          <section className="cost-day" key={row.day.id}>
            <button className="cost-day-head" type="button" onClick={() => onDay(row.day.id)}>
              <span>
                <b>{row.day.label || row.day.title}</b>
                {row.day.title && row.day.label ? <small>{row.day.title}</small> : null}
              </span>
              <strong>{totalsLine(row.totals)}</strong>
            </button>
            <ul className="cost-items">
              {row.items.map((item) => (
                <li key={item.key} className={marks.logged.has(item.key || "") ? "logged" : ""}>
                  <span className="cost-kind">{COST_KIND_LABEL[item.category || "other"]}</span>
                  <span className="cost-name">{item.label}</span>
                  <b>
                    {marks.logged.has(item.key || "") ? "✓ " : ""}
                    {formatSpend(item.amount, item.currency)}
                    {item.currencyGuess ? "?" : ""}
                  </b>
                </li>
              ))}
            </ul>
            <DayMoneyBatch trip={trip} day={row.day} items={row.items} compact />
          </section>
        );
      })}
    </article>
  );
}

/** ✓ 已記 from MoneyTracker's shared key list; refreshes on storage events and when the tab regains focus. */
function useMoneyMarks() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === LOGGED_KEY) bump();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") bump();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const marks = useMemo(() => ({ logged: loadLoggedKeys(), sent: loadSentKeys() }), [tick]);
  return { ...marks, bump: () => setTick((n) => n + 1) };
}

function RideCard({
  ride,
  trip,
  day,
  onOpenRide,
}: {
  ride: Ride;
  trip?: TripBook;
  day?: TripDay;
  onOpenRide?: (ride: Ride) => void;
}) {
  const line = [ride.detail, ride.price].filter(Boolean).join(" · ");
  const [open, setOpen] = useState(false);
  const hasLinkedStop = Boolean(ride.entry || ride.spot);
  return (
    <div className="leg openable">
      <button
        className="leg-main"
        type="button"
        onClick={() => {
          if (hasLinkedStop && onOpenRide) onOpenRide(ride);
          else setOpen((value) => !value);
        }}
      >
        <span className="mode">{ride.mode || "前往"}</span>
        <span>
          <strong>
            {ride.from} → {ride.to}
          </strong>
          {line ? <small>{line}</small> : null}
        </span>
      </button>
      {open || (!hasLinkedStop && ride.note && ride.note.length <= 36) ? (
        <div className="ride-detail">
          {ride.mode ? <p className="tiny">方式：{ride.mode}</p> : null}
          {ride.detail ? <p className="tiny">路程：{ride.detail}</p> : null}
          {ride.price ? <p className="tiny">費用：{ride.price}</p> : null}
          {ride.note ? <p className="tiny">{ride.note}</p> : null}
          {!ride.mode && !ride.detail && !ride.price && !ride.note ? <p className="tiny">未有更多班次資料。</p> : null}
          {hasLinkedStop && onOpenRide ? (
            <button className="leg-more" type="button" onClick={() => onOpenRide(ride)}>
              去相關景點
            </button>
          ) : null}
        </div>
      ) : ride.note ? (
        <button className="leg-more" type="button" onClick={() => setOpen(true)}>
          班次詳情
        </button>
      ) : (
        <button className="leg-more" type="button" onClick={() => setOpen(true)}>
          交通詳情
        </button>
      )}
      {trip && day ? (
        <SpotMoney trip={trip} day={day} itemRef={rideRef(ride)} label={rideSpendLabel(ride)} price={ride.price} compact category="ride" />
      ) : null}
    </div>
  );
}

function leadLong(html: string): boolean {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, "").length > 80;
}

/** Keyboard support for clickable cards that contain their own buttons (so
 *  they cannot be a <button> themselves). Only reacts when the card itself
 *  has focus, never for keys pressed on a nested control. */
function cardKeys(open: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    },
  };
}

function entryOf(day: TripDay, entry: DayEntry): TripSpot | undefined {
  if (entry.kind === "spot") return day.spots[entry.index];
  if (entry.kind === "meal") return day.meals[entry.index];
  return day.hotels[entry.index];
}

function NextStopCard({
  trip,
  day,
  visits,
  onSpot,
  onMeal,
  onHotel,
}: {
  trip: TripBook;
  day: TripDay;
  visits: Record<string, string>;
  onSpot: (index: number) => void;
  onMeal: (index: number) => void;
  onHotel: (index: number) => void;
}) {
  const { next, total } = nextStop(day, visits);
  if (!total) return null;
  if (!next) {
    return (
      <section className="next-stop done" aria-label={t("next.title")}>
        <p className="next-kicker">{t("next.title")}</p>
        <p className="next-done">✓ {t("next.allDone", { total })}</p>
      </section>
    );
  }
  const item = entryOf(day, next.entry);
  if (!item) return null;
  const open = () => (next.entry.kind === "meal" ? onMeal : next.entry.kind === "hotel" ? onHotel : onSpot)(next.entry.index);
  const go = mapLink(item);
  const kind = t(next.entry.kind === "meal" ? "kind.meal" : next.entry.kind === "hotel" ? "kind.hotel" : "kind.spot");
  const ride = next.ride ? [next.ride.mode, next.ride.detail].filter(Boolean).join(" · ") : "";
  return (
    <section className="next-stop" aria-label={t("next.title")}>
      <p className="next-kicker">
        {t("next.title")}
        <span>{t("next.progress", { done: next.done, total: next.total })}</span>
      </p>
      <button className="next-main" type="button" onClick={open}>
        <span className="stop-num">{next.num}</span>
        <span className="next-copy">
          <strong>{item.name}</strong>
          <small>{[kind, item.hours].filter(Boolean).join(" · ")}</small>
          {ride ? <small className="next-ride">{t("next.via")}：{ride}</small> : null}
        </span>
      </button>
      <div className="next-actions">
        {go ? (
          <a className="btn primary" href={go} target="_blank" rel="noopener">
            <Navigation size={16} aria-hidden="true" />
            {t("next.go")}
          </a>
        ) : null}
        <button className="btn" type="button" onClick={() => toggleVisit(trip.id, next.key, "")}>
          {t("next.checkIn")}
        </button>
        <button className="btn ghost" type="button" onClick={open}>
          {t("next.open")}
        </button>
      </div>
    </section>
  );
}

function MoreScreen({
  trip,
  costs,
  hasGuides,
  onOpen,
  onLibrary,
}: {
  trip: TripBook;
  costs: TripCosts;
  hasGuides: boolean;
  onOpen: (id: string) => void;
  onLibrary: () => void;
}) {
  const rows: { id: string; icon: LucideIcon; label: string; hint: string }[] = [
    { id: "overview", icon: TAB_ICON.overview, label: t("tab.overview"), hint: t("more.overviewHint") },
  ];
  if (hasGuides) rows.push({ id: "guides", icon: TAB_ICON.practical, label: t("tab.guides"), hint: t("more.guidesHint") });
  rows.push({
    id: "costs",
    icon: TAB_ICON.costs,
    label: t("tab.costs"),
    hint: costs.count ? `${t("more.costsHint", { count: costs.count })} ${totalsLine(costs.totals)}` : t("more.costsEmpty"),
  });
  return (
    <section className="screen more-screen">
      <h1 className="screen-title">{t("tab.more")}</h1>
      <h2 className="sheet-label">{t("more.trip")}</h2>
      <div className="sheet">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <button className="navrow" type="button" key={row.id} onClick={() => onOpen(row.id)}>
              <span className="navrow-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="navrow-main">
                <strong>{row.label}</strong>
                <span className="pill-hint">{row.hint}</span>
              </span>
              <span className="navrow-go" aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
      <h2 className="sheet-label">{t("more.keep")}</h2>
      <div className="sheet">
        <button className="navrow" type="button" onClick={() => void downloadTrip(trip)}>
          <span className="navrow-icon" aria-hidden="true">
            <Download size={18} />
          </span>
          <span className="navrow-main">
            <strong>{t("more.save")}</strong>
            <span className="pill-hint">{t("more.saveHint")}</span>
          </span>
          <span className="navrow-go" aria-hidden="true">›</span>
        </button>
        <button className="navrow" type="button" onClick={onLibrary}>
          <span className="navrow-icon" aria-hidden="true">
            <ChevronLeft size={18} />
          </span>
          <span className="navrow-main">
            <strong>{t("more.library")}</strong>
            <span className="pill-hint">{t("more.libraryHint")}</span>
          </span>
          <span className="navrow-go" aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
}

function DayFacts({ day }: { day: TripDay }) {
  const text = day.walkHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const km = text.match(/([\d.]+)\s*km/i)?.[1] || "";
  const load = text.match(/負荷\s*(🟢|🟡|🔴)/u)?.[1] || "";
  const rest = text.split("建議抖位：")[1]?.split("。")[0]?.trim() || "";
  const sun = sunLine(day);
  if (!km && !load && !sun && !text) return null;
  return (
    <>
      <div className="dayfacts">
        {km ? <span className="dayfact">步行 {km} km</span> : null}
        {load ? <span className="dayfact">負荷 {load}</span> : null}
        {sun ? <span className="dayfact">🌅 {sun.replace(/（[^）]*）/g, "")}</span> : null}
        {!km && !load && text ? <span className="dayfact">{text.replace(/^🚶\s*/, "")}</span> : null}
      </div>
      {rest ? <p className="restline">建議抖位：{rest}</p> : null}
    </>
  );
}

function dayHeadline(day: TripDay): { when: string; objective: string } {
  const title = day.title.trim();
  const cut = title.split(/：|:/);
  if (cut.length > 1 && cut[0].length <= 24) return { when: cut[0].trim(), objective: cut.slice(1).join("：").trim() };
  return { when: day.label, objective: title };
}

function FoldBox({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="meals">
      <button type="button" className="fold-card" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        {count ? <em>{count}</em> : null}
        <span className="fold-go">{open ? "收起" : "展開"}</span>
      </button>
      {open ? children : null}
    </section>
  );
}

function DayMeals({ trip, day }: { trip: TripBook; day: TripDay }) {
  const guide = trip.guides.find((item) => item.id === "food" || /美食/.test(item.label));
  const menu = useMemo(() => dayMenu(day, guide), [day, guide]);
  if (!menu.length) return null;
  return (
    <FoldBox title="今日美食" count={menu.length}>
      {menu.map((meal, index) => (
        <article className="meal" key={`${meal.slot}-${meal.title}-${index}`}>
          <h3>
            {meal.slot ? `${meal.slot} · ` : ""}
            {meal.title}
          </h3>
          {meal.note ? <p className="tiny">{meal.note}</p> : null}
          {meal.places.map((place) => (
            <div className="meal-place" key={`${place.name}-${place.address}`}>
              <h4>{place.name}</h4>
              {place.address ? <p className="tiny">{place.address}</p> : null}
              {place.lines.length ? (
                <ul>
                  {place.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {place.links.length ? (
                <p className="restlinks">
                  {place.links.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noopener">
                      {link.label}
                    </a>
                  ))}
                </p>
              ) : null}
            </div>
          ))}
        </article>
      ))}
    </FoldBox>
  );
}

function DaySouvenirs({ trip, day }: { trip: TripBook; day: TripDay }) {
  const guide = trip.guides.find((item) => item.id === "souvenir" || /手信/.test(item.label));
  const found = useMemo(() => daySouvenirs(day, guide), [day, guide]);
  if (!found.items.length) return null;
  return (
    <FoldBox title="今日手信" count={found.items.length}>
      {found.items.map((item) => (
        <article className="meal" key={item.name}>
          <h3>{item.name}</h3>
          {item.detail ? (
            <ul>
              <li>{item.detail}</li>
            </ul>
          ) : null}
          {item.links.length ? (
            <p className="restlinks">
              {item.links.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noopener">
                  {link.label}
                </a>
              ))}
            </p>
          ) : null}
        </article>
      ))}
      {found.notes.map((note) => (
        <p className="tiny" key={note}>
          {note}
        </p>
      ))}
    </FoldBox>
  );
}

function SpotDining({ day, spot, guide }: { day: TripDay; spot: TripSpot; guide?: TripGuide }) {
  const places = useMemo(() => diningForSpot(spot, day, guide), [spot, day, guide]);
  if (!places.length) return null;
  return (
    <section className="meals">
      <h2 className="section-label">餐廳</h2>
      {places.map((place) => (
        <article className="meal" key={`${place.name}-${place.address}`}>
          <h3>{place.name}</h3>
          {place.address ? <p className="tiny">{place.address}</p> : null}
          {place.lines.length ? (
            <ul>
              {place.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {place.links.length ? (
            <p className="restlinks">
              {place.links.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noopener">
                  {link.label}
                </a>
              ))}
            </p>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function visitClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function toggleVisit(tripId: string, key: string, at: string) {
  writeVisit(tripId, key, at ? "" : new Date().toISOString());
  window.dispatchEvent(new Event("trip-visits"));
}

function CheckIn({ at, onToggle }: { at: string; onToggle: () => void }) {
  return (
    <button className={at ? "btn stamp-lg on" : "btn stamp-lg"} type="button" onClick={onToggle}>
      {at ? `已打卡 ${visitClock(at)}` : "打卡"}
    </button>
  );
}

function Transport({ trip, dayId, onDay }: { trip: TripBook; dayId: string; onDay: (id: string) => void }) {
  const days = trip.days.filter((day) => day.rides.length);
  const day = trip.days.find((item) => item.id === dayId) || days[0];
  const chipRef = useRef<HTMLButtonElement>(null);
  const covered = new Set(days.map((item) => item.label.replace(/\s+/g, "").slice(0, 6)));
  const leftoverAll = trip.transport.blocks.filter((block) => !covered.has(block.heading.replace(/\s+/g, "").slice(0, 6)) && !days.some((item) => block.heading.replace(/\s+/g, "").includes(item.label.replace(/\s+/g, "").slice(0, 6))));
  // Show unmatched legacy blocks once on the first transport day only — not under every day chip.
  const leftover = day && days[0] && day.id === days[0].id ? leftoverAll : [];
  useEffect(() => {
    const strip = chipRef.current?.parentElement;
    const chip = chipRef.current;
    if (!strip || !chip) return;
    strip.scrollTo({ left: chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2 });
  }, [day?.id]);
  return (
    <section className="screen">
      {days.length ? (
        <div className="daystrip dayjump dayjump-sticky">
          {days.map((item) => {
            const chip = dayChip(item, trip.cityNames);
            const on = item.id === day?.id;
            return (
              <button
                key={item.id}
                type="button"
                ref={on ? chipRef : undefined}
                className={on ? "daychip on" : "daychip"}
                aria-current={on ? "date" : undefined}
                onClick={() => onDay(item.id)}
              >
                <b>{chip.num}</b>
                {chip.hint ? <small>{chip.hint}</small> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {trip.transport.introHtml ? <div className="note" dangerouslySetInnerHTML={{ __html: trip.transport.introHtml }} /> : null}
      {day ? (
        <article id={`leg-${day.id}`}>
          <h2 className="section-label">{day.label}</h2>
          {day.rides.length ? (
            <div className="sheet plan">
              {day.rides.map((ride) => (
                <RideCard key={`${day.id}-${ride.from}-${ride.to}-${ride.detail}`} trip={trip} day={day} ride={ride} />
              ))}
            </div>
          ) : (
            <p className="muted">呢日未有路程。</p>
          )}
        </article>
      ) : null}
      {leftover.length ? (
        <section className="transport-extra">
          <h2 className="section-label">其他交通備註</h2>
          <p className="soft-hint">唔屬於上面日子嘅舊格式交通說明，只顯示一次。</p>
          {leftover.map((block) => (
            <article className="reading block" key={block.heading}>
              {block.heading ? <h3 className="sheet-label">{block.heading}</h3> : null}
              <div dangerouslySetInnerHTML={{ __html: block.html }} />
            </article>
          ))}
        </section>
      ) : null}
    </section>
  );
}

function DayNav({
  trip,
  day,
  onDay,
}: {
  trip: TripBook;
  day: TripDay;
  onDay: (id: string) => void;
}) {
  const index = trip.days.findIndex((item) => item.id === day.id);
  const prev = trip.days[index - 1];
  const next = trip.days[index + 1];
  const chip = dayChip(day, trip.cityNames);
  return (
    <nav className="daynav" aria-label="前後日">
      <button className="btn" type="button" disabled={!prev} onClick={() => prev && onDay(prev.id)}>
        <ChevronLeft size={18} aria-hidden="true" />
        上一天
      </button>
      <span className="daynav-now">
        {chip.num}
        <small>
          {index + 1}/{trip.days.length}
        </small>
      </span>
      <button className="btn" type="button" disabled={!next} onClick={() => next && onDay(next.id)}>
        下一天
        <ChevronRight size={18} aria-hidden="true" />
      </button>
    </nav>
  );
}

const DWELL_CHIPS = [30, 60, 90, 120] as const;
const PLAN_KIND_LABEL: Record<string, string> = { spot: "景點", meal: "餐廳", hotel: "住宿" };

/** 今日規劃: add places (name or pasted Google Maps link) straight into the
 *  day, reorder by drag or ↑↓, estimate time at each stop, then pack the plan
 *  for AI. Wishes stay as a softer "maybe" list that can be promoted. */
function DayPlanner({ trip, day, onTrip }: { trip: TripBook; day: TripDay; onTrip: (next: TripBook) => void }) {
  const [rows, setRows] = useState(loadWishes(trip.id));
  const [kind, setKind] = useState<WishKind>("sight");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [dwell, setDwell] = useState<number | null>(null);
  const [fallback, setFallback] = useState("");
  const [copied, setCopied] = useState("");
  const [reading, setReading] = useState("");
  const [flash, setFlash] = useState("");
  const [dragId, setDragId] = useState("");
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const orderRef = useRef<string[] | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const formRef = useRef<HTMLInputElement>(null);
  const dayRows = rows.filter((row) => row.dayId === day.id);
  const entries = planEntries(day);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const shown = (dragOrder || entries.map((entry) => entry.id)).map((id) => byId.get(id)).filter((entry): entry is PlanEntry => Boolean(entry));
  const stats = dayDwellStats(day);

  useEffect(() => {
    const load = () => setRows(loadWishes(trip.id));
    load();
    window.addEventListener("trip-wishes", load);
    return () => window.removeEventListener("trip-wishes", load);
  }, [trip.id]);

  useEffect(() => {
    if (!flash) return;
    const timer = window.setTimeout(() => setFlash(""), 1600);
    return () => window.clearTimeout(timer);
  }, [flash]);

  function refreshWishes() {
    window.dispatchEvent(new Event("trip-wishes"));
  }

  function resetForm() {
    setName("");
    setAddress("");
    setNote("");
    setMapsUrl("");
    setDwell(null);
    setReading("");
  }

  function onPlaceInput(value: string) {
    const link = /^https:\/\//i.test(value.trim()) ? value.trim() : "";
    const parsed = placeFromMaps(value);
    if (parsed?.name) {
      setReading("");
      setName(parsed.name);
      if (link) setMapsUrl(link);
      if (parsed.note) setAddress((current) => current || parsed.note);
      return;
    }
    setName(value);
    const short = shortMapsLink(value);
    if (!short) {
      setReading("");
      if (!link) setMapsUrl("");
      return;
    }
    setMapsUrl(link);
    setReading("讀緊地名…");
    void resolveMapsPlace(value).then((found) => {
      setName((current) => {
        if (current !== value && shortMapsLink(current) !== short) return current;
        setReading(found?.name ? "" : "短連結讀唔到店名，請打返個名（連結會保留）");
        return found?.name || "";
      });
      if (found?.note) setAddress((current) => current || found.note);
    });
  }

  function addToDay() {
    const clean = name.trim();
    if (!clean || /^https?:\/\//i.test(clean)) return;
    const result = addDayPlace(trip, day.id, {
      kind: kind === "meal" ? "meal" : "sight",
      name: clean,
      address,
      note,
      dwellMin: dwell,
      mapsUrl,
      badge: kind === "souvenir" ? "手信" : "",
    });
    if (!result.id) return;
    onTrip(result.trip);
    setFlash(`已加入：${clean}`);
    setCopied("");
    resetForm();
  }

  function addToWishes() {
    const clean = name.trim();
    if (!clean || /^https?:\/\//i.test(clean)) return;
    addWish(trip.id, { dayId: day.id, kind, name: clean, note: [address, note].filter(Boolean).join("｜") });
    setFlash(`已記低喺願望清單：${clean}`);
    setCopied("");
    resetForm();
    refreshWishes();
  }

  function removeEntry(entry: PlanEntry) {
    if (!window.confirm(`由今日行程移除「${entry.name}」？`)) return;
    const at = findDayEntry(day, entry.id);
    const next = removeDayEntry(trip, day.id, entry.id);
    if (at) {
      writeTripVisits(trip.id, shiftVisitsOnRemove(loadVisits(trip.id), day.id, at));
      window.dispatchEvent(new Event("trip-visits"));
    }
    onTrip(next);
  }

  // Pointer-driven drag on the grip handle: works with mouse, pen and touch.
  function dragStart(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const order = entries.map((entry) => entry.id);
    orderRef.current = order;
    setDragOrder(order);
    setDragId(id);
  }

  function dragMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragId || !orderRef.current || !listRef.current) return;
    const others = [...listRef.current.querySelectorAll<HTMLElement>("[data-entry]")].filter((row) => row.dataset.entry !== dragId);
    let target = 0;
    for (const row of others) {
      const box = row.getBoundingClientRect();
      if (event.clientY > box.top + box.height / 2) target++;
    }
    const rest = orderRef.current.filter((id) => id !== dragId);
    const next = [...rest.slice(0, target), dragId, ...rest.slice(target)];
    if (next.join("|") === orderRef.current.join("|")) return;
    orderRef.current = next;
    setDragOrder(next);
  }

  function dragEnd() {
    const order = orderRef.current;
    const before = entries.map((entry) => entry.id).join("|");
    orderRef.current = null;
    setDragOrder(null);
    setDragId("");
    if (order && order.join("|") !== before) onTrip(reorderDayTimeline(trip, day.id, order));
  }

  function packDays(list: TripDay[]): PlanPackDay[] {
    return list.map((item) => ({ id: item.id, label: item.label, title: item.title, entries: planEntries(item) }));
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFallback("");
      setCopied(label);
    } catch {
      setCopied("");
      setFallback(text);
    }
  }

  function copyDay() {
    void copyText(planningPackPrompt(trip, packDays([day]), trip, dayRows), "day");
  }

  function copyTrip() {
    void copyText(planningPackPrompt(trip, packDays(trip.days), trip, loadWishes(trip.id)), "trip");
  }

  function copyWishes() {
    const wishes = loadWishes(trip.id);
    const labels = Object.fromEntries(trip.days.map((item) => [item.id, `${item.label} ${item.title}`.trim()]));
    void copyText(wishUpdatePrompt(trip, wishes, labels, trip), "wish");
  }

  const canAdd = Boolean(name.trim()) && !/^https?:\/\//i.test(name.trim());

  return (
    <div className="extras planner">
      <h2 className="section-label">
        今日規劃 <small>{entries.length ? `${entries.length} 個地方` : "未有地方"}</small>
      </h2>
      <p className="tiny">打店名或者貼 Google 地圖連結，直接加入今日。拖住 ⠿ 或者用 ↑↓ 排次序，再估每個地方停留幾耐。</p>
      <div className="wish-kinds">
        {(
          [
            ["sight", "景點"],
            ["meal", "餐廳"],
            ["souvenir", "手信"],
          ] as const
        ).map(([value, label]) => (
          <button key={value} className={kind === value ? "stamp on" : "stamp"} type="button" aria-pressed={kind === value} onClick={() => setKind(value)}>
            {label}
          </button>
        ))}
      </div>
      <form
        className="here plan-form"
        onSubmit={(event) => {
          event.preventDefault();
          addToDay();
        }}
      >
        <input ref={formRef} value={name} placeholder="店名或貼 Google 地圖連結" aria-label="店名或貼 Google 地圖連結" onChange={(event) => onPlaceInput(event.target.value)} />
        {reading ? (
          <p className="tiny plan-reading" role="status">
            {reading}
          </p>
        ) : null}
        {mapsUrl && !reading ? <p className="tiny plan-reading">已附地圖連結 ✓</p> : null}
        <input value={address} placeholder="可選：地址／區域" aria-label="地址" onChange={(event) => setAddress(event.target.value)} />
        <input value={note} placeholder="可選：備註（點解要去、想食乜）" aria-label="備註" onChange={(event) => setNote(event.target.value)} />
        <div className="dwell-pick" role="group" aria-label="停留時間">
          <span className="tiny">停留</span>
          {DWELL_CHIPS.map((value) => (
            <button key={value} type="button" className={dwell === value ? "stamp on" : "stamp"} aria-pressed={dwell === value} onClick={() => setDwell(dwell === value ? null : value)}>
              {value < 60 ? `${value} 分` : formatDwell(value).replace(" 小時", "h").replace(" 分", "m").replace(/\s/g, "")}
            </button>
          ))}
          <input
            className="dwell-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={720}
            step={5}
            value={dwell ?? ""}
            placeholder="分鐘"
            aria-label="停留分鐘"
            onChange={(event) => {
              const value = Number(event.target.value);
              setDwell(event.target.value === "" || !Number.isFinite(value) || value <= 0 ? null : Math.min(720, Math.round(value)));
            }}
          />
        </div>
        <div className="plan-buttons">
          <button className="btn primary" type="submit" disabled={!canAdd}>
            加入行程
          </button>
          <button className="btn ghost" type="button" disabled={!canAdd} onClick={addToWishes}>
            仍只加入願望清單
          </button>
        </div>
        {flash ? (
          <p className="tiny plan-flash" role="status">
            {flash}
          </p>
        ) : null}
      </form>

      {shown.length ? (
        <>
          <ol className={dragId ? "plan-list dragging" : "plan-list"} ref={listRef}>
            {shown.map((entry, position) => (
              <li key={entry.id} data-entry={entry.id} className={entry.id === dragId ? "plan-row lifted" : "plan-row"}>
                <button
                  className="plan-grip"
                  type="button"
                  aria-label={`拖曳排序：${entry.name}`}
                  onPointerDown={(event) => dragStart(event, entry.id)}
                  onPointerMove={dragMove}
                  onPointerUp={dragEnd}
                  onPointerCancel={dragEnd}
                >
                  <GripVertical size={16} />
                </button>
                <span className="plan-pos">{position + 1}</span>
                <span className="plan-main">
                  <span className="plan-name">
                    <em className={`plan-kind ${entry.kind}`}>{PLAN_KIND_LABEL[entry.kind] || entry.kind}</em>
                    <strong>{entry.name}</strong>
                  </span>
                  {entry.address ? <span className="pill-hint">{entry.address}</span> : null}
                </span>
                <DwellField
                  key={`${entry.id}:${entry.dwellMin}`}
                  value={entry.dwellMin}
                  name={entry.name}
                  onSave={(value) => onTrip(setEntryDwell(trip, day.id, entry.id, value))}
                />
                <span className="plan-actions">
                  <button className="stamp icon" type="button" aria-label="上移" disabled={position === 0 || Boolean(dragId)} onClick={() => onTrip(moveDayEntry(trip, day.id, entry.id, -1))}>
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="stamp icon"
                    type="button"
                    aria-label="下移"
                    disabled={position === shown.length - 1 || Boolean(dragId)}
                    onClick={() => onTrip(moveDayEntry(trip, day.id, entry.id, 1))}
                  >
                    <ArrowDown size={14} />
                  </button>
                  {entry.mapsUrl || entry.address || entry.kind !== "hotel" ? (
                    <a className="stamp icon" href={mapLink({ ...(entry.kind === "meal" ? day.meals[entry.index] : entry.kind === "hotel" ? day.hotels[entry.index] : day.spots[entry.index]), name: entry.name, address: entry.address } as TripSpot)} target="_blank" rel="noreferrer" aria-label={`喺地圖開：${entry.name}`}>
                      <MapPin size={14} />
                    </a>
                  ) : null}
                  {entry.kind !== "hotel" ? (
                    <button className="stamp icon" type="button" aria-label={`移除：${entry.name}`} onClick={() => removeEntry(entry)}>
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
          <p className="plan-total">
            今日預計停留共 <strong>{formatDwell(stats.total)}</strong>
            {stats.unset ? <span className="tiny"> · {stats.unset} 個地方未估時間</span> : null}
          </p>
        </>
      ) : (
        <div className="plan-empty">
          <p>今日仲未有地方。</p>
          <button className="btn ghost" type="button" onClick={() => formRef.current?.focus()}>
            加第一個地方
          </button>
        </div>
      )}

      {dayRows.length ? (
        <>
          <h3 className="section-label plan-sub">願望清單（未入行程）</h3>
          <div className="sheet">
            {dayRows.map((row) => (
              <div className="extra-row" key={row.id}>
                <strong>
                  {row.kind === "meal" ? "餐廳" : row.kind === "souvenir" ? "手信" : "景點"} · {row.name}
                </strong>
                {row.note ? <span className="pill-hint">{row.note}</span> : null}
                <span className="extra-actions">
                  <button
                    className="stamp on"
                    type="button"
                    onClick={() => {
                      const result = promoteWishToDay(trip, row);
                      if (!result.id) return;
                      onTrip(result.trip);
                      removeWish(trip.id, row.id);
                      refreshWishes();
                      setFlash(`已加入：${row.name}`);
                    }}
                  >
                    加入行程
                  </button>
                  <button
                    className="stamp"
                    type="button"
                    onClick={() => {
                      removeWish(trip.id, row.id);
                      refreshWishes();
                    }}
                  >
                    刪除
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="plan-ai">
        <button className="btn primary" type="button" onClick={copyDay} disabled={!entries.length && !dayRows.length}>
          <Copy size={15} /> {copied === "day" ? "已複製，貼去 Grok 或 Muse" : "複製今日計劃俾 AI"}
        </button>
        <button className="btn ghost" type="button" onClick={copyTrip}>
          {copied === "trip" ? "已複製成個行程" : "複製成個行程計劃俾 AI"}
        </button>
        {rows.length ? (
          <button className="btn ghost" type="button" onClick={copyWishes}>
            {copied === "wish" ? "已複製願望清單" : `只複製 ${rows.length} 項願望俾 AI 更新`}
          </button>
        ) : null}
      </div>
      <p className="tiny">AI 會跟你排好嘅次序同停留時間補返交通、介紹，出一份同一個行程嘅 JSON；上傳就會更新呢本行程。</p>
      {fallback ? <textarea className="prompt-box" readOnly value={fallback} onFocus={(event) => event.currentTarget.select()} /> : null}
    </div>
  );
}

function DwellField({ value, name, onSave }: { value: number; name: string; onSave: (value: number | null) => void }) {
  const [draft, setDraft] = useState(value ? String(value) : "");
  function commit() {
    const n = Number(draft);
    const next = draft.trim() === "" || !Number.isFinite(n) || n <= 0 ? 0 : Math.min(720, Math.round(n));
    if (next === value) {
      setDraft(next ? String(next) : "");
      return;
    }
    onSave(next || null);
  }
  return (
    <label className="plan-dwell" title={value ? formatDwell(value) : "未估"}>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={720}
        step={5}
        value={draft}
        placeholder="—"
        aria-label={`${name} 停留分鐘`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <span>分</span>
    </label>
  );
}

function ExtraStops({ tripId, dayId }: { tripId: string; dayId: string }) {
  const [rows, setRows] = useState<ExtraStop[]>([]);
  const [fixing, setFixing] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<PlaceFix | null>(null);
  const stopLocate = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => stopLocate.current?.();
  }, []);

  useEffect(() => {
    const load = () => setRows(loadExtras(tripId).filter((stop) => stop.dayId === dayId));
    load();
    window.addEventListener("trip-extras", load);
    return () => window.removeEventListener("trip-extras", load);
  }, [tripId, dayId]);

  function locate() {
    stopLocate.current?.();
    let answered = false;
    stopLocate.current = startLocate(
      (place) => {
        answered = true;
        setFixing(false);
        setDraft(place);
      },
      (message) => {
        answered = true;
        setFixing(false);
        setError(message);
      },
    );
    if (answered) return;
    setError("");
    setDraft(null);
    setFixing(true);
  }

  function confirm() {
    if (!draft || !draft.name.trim()) return;
    addExtra(tripId, {
      dayId,
      name: draft.name.trim(),
      address: draft.address,
      lat: draft.lat,
      lng: draft.lng,
    });
    setDraft(null);
    window.dispatchEvent(new Event("trip-extras"));
  }

  return (
    <div className="extras">
      {rows.length ? (
        <>
          <h2 className="section-label">未排行程</h2>
          <div className="sheet">
            {rows.map((stop) => (
              <div className="extra-row" key={stop.id}>
                <strong>{stop.name}</strong>
                <span className="pill-hint">
                  {visitClock(stop.at)}
                  {stop.address ? ` · ${stop.address}` : ""}
                </span>
                <span className="extra-actions">
                  <a className="stamp" href={`https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`} target="_blank" rel="noopener">
                    地圖
                  </a>
                  <button
                    className="stamp"
                    type="button"
                    onClick={() => {
                      removeExtra(tripId, stop.id);
                      window.dispatchEvent(new Event("trip-extras"));
                    }}
                  >
                    取消
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      {draft ? (
        <form
          className="here"
          onSubmit={(event) => {
            event.preventDefault();
            confirm();
          }}
        >
          <p className="muted">定位到呢度</p>
          <input
            value={draft.name}
            placeholder="地方名"
            aria-label="地方名"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          {draft.address ? <p className="tiny">{draft.address}</p> : null}
          {draft.accuracy ? (
            <p className={accuracyLabel(draft.accuracy).coarse ? "tiny locate-coarse" : "tiny"}>
              {accuracyLabel(draft.accuracy).text}
            </p>
          ) : null}
          <div className="here-actions">
            <button className="btn primary" type="submit" disabled={!draft.name.trim()}>
              確認打卡
            </button>
            <button className="btn ghost" type="button" onClick={() => setDraft(null)}>
              取消
            </button>
          </div>
        </form>
      ) : (
        <button className="btn here-go" type="button" disabled={fixing} onClick={locate}>
          {fixing ? "正在問定位…" : "打卡新地方"}
        </button>
      )}
      {error ? <p className="status error">{error}</p> : null}
    </div>
  );
}

function DayNotes({ tripId, dayId }: { tripId: string; dayId: string }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setValue(loadNote(tripId, dayId));
    setSaved(false);
  }, [tripId, dayId]);
  return (
    <div className="daynotes" id="day-notes">
      <div className="spot-head">
        <h4>實際行程筆記</h4>
        {saved ? <span className="saved">已儲存</span> : null}
      </div>
      <textarea
        value={value}
        placeholder="去到先寫：實際去咗邊、使咗幾多、有咩下次唔同做法。會同行程一齊同步。"
        onChange={(event) => {
          setValue(event.target.value);
          saveNote(tripId, dayId, event.target.value);
          setSaved(true);
        }}
      />
    </div>
  );
}
