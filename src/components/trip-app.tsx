import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from "react";
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
  TrainFront,
  Trash2,
  Upload,
  Navigation,
  Search,
  type LucideIcon,
} from "lucide-react";
import {
  cityLabel,
  cleanCredit,
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
  writeCheck,
  writeVisit,
  addExtra,
  loadExtras,
  removeExtra,
  type ExtraStop,
  type TripBook,
  type TripSpot,
  type TripDay,
  type TripGuide,
  type Ride,
} from "@/lib/trip";
import { DrivePanel } from "@/components/drive-panel";
import { syncTripDriveIfDue } from "@/lib/drive-sync";
import { AI_TRIP_PROMPT } from "@/lib/ai-prompt";
import { startLocate, type PlaceFix } from "@/lib/geo";

const TAB_ICON: Record<string, LucideIcon> = {
  overview: BookOpen,
  days: CalendarDays,
  transport: TrainFront,
  photo: Camera,
  food: Coffee,
  souvenir: Gift,
  practical: Info,
};

function coverOf(trip: TripBook): string {
  for (const day of trip.days) {
    const image = day.images.find((item) => item.src);
    if (image) return image.src;
  }
  return "";
}

function dayChip(day: TripDay): { num: string; hint: string } {
  const num = day.label.match(/(\d{1,2})/)?.[1] ?? day.label.slice(0, 2);
  if (day.label.includes("聖誕")) return { num, hint: "聖誕" };
  if (day.label.includes("返")) return { num, hint: "回程" };
  const inside = day.label.match(/（([^）]+)）/)?.[1] ?? "";
  const mark = inside.match(/[一二三四五六日]/)?.[0];
  return { num, hint: mark ? `週${mark}` : inside || cityLabel(day.city) };
}

function labelTables(root: ParentNode) {
  root.querySelectorAll("table").forEach((table) => {
    const headers = [...table.querySelectorAll("thead th")].map((th) => (th.textContent || "").trim());
    if (!headers.length) return;
    table.classList.add("stackable");
    table.querySelectorAll("tbody tr").forEach((tr) => {
      [...tr.children].forEach((cell, index) => {
        if (cell instanceof HTMLElement && headers[index]) cell.dataset.label = headers[index];
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

type SearchHit = { dayId: string; spot: number; title: string; meta: string };

function searchTrip(trip: TripBook, query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 1) return [];
  const hits: SearchHit[] = [];
  for (const day of trip.days) {
    if (`${day.label} ${day.title}`.toLowerCase().includes(needle)) {
      hits.push({ dayId: day.id, spot: -1, title: day.title || day.label, meta: day.label });
    }
    day.spots.forEach((spot, index) => {
      const blob = `${spot.name} ${spot.badge} ${spot.hours} ${spot.address} ${spot.price} ${plainText(spot.html)}`.toLowerCase();
      if (!blob.includes(needle)) return;
      hits.push({ dayId: day.id, spot: index, title: spot.name, meta: `${day.label}${spot.badge ? ` · ${spot.badge}` : ""}` });
    });
  }
  hits.sort((a, b) => Number(!(a.spot >= 0 && a.title.toLowerCase().includes(needle))) - Number(!(b.spot >= 0 && b.title.toLowerCase().includes(needle))));
  return hits.slice(0, 40);
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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadTrips();
    const ui = loadUi();
    setTrips(stored);
    const returning =
      window.location.hash.includes("access_token") || window.location.hash.includes("error=");
    const live = stored.find((trip) => todayDay(trip));
    if (!returning && live) {
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
      const text = await file.text();
      absorbSaved(text);
      importBooks(parseTripFile(text), file.name);
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
          {trips.length === 0 ? (
            <section className="empty">
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
                <strong>加入行程</strong>
                <span>上傳 JSON。內容留喺呢部手機，可以同步去 Google Drive</span>
              </button>
            </section>
          ) : (
            <section>
              <div className="lib-head">
                <h1>我的行程</h1>
                <p className="muted">撳一張卡打開。同一個 id 再上傳會更新內容，筆記保留。</p>
              </div>
              <div className="trip-grid">
                {trips.map((trip) => (
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
                      setTrips(deleteTrip(trips, trip.id));
                      setStatus(`已刪除「${trip.title}」`);
                    }}
                  />
                ))}
              </div>
            </section>
          )}
          {status ? <p className="status">{status}</p> : null}
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
    />
  );
}

function TripCard({
  trip,
  onOpen,
  onDelete,
}: {
  trip: TripBook;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const cover = coverOf(trip);
  const cities = [...new Set(trip.days.map((day) => day.city).filter(Boolean))];
  const progress = bookingProgress(trip);
  return (
    <article className="trip-tile">
      <div className="trip-open" onClick={onOpen}>
        {cover ? <img className="trip-cover" src={cover} alt="" /> : <span className="trip-cover empty-cover" />}
        <span className="trip-copy">
          <strong>{trip.title}</strong>
          {trip.subtitle ? <span className="muted">{trip.subtitle}</span> : null}
          {cities.length ? (
            <span className="chips">
              {cities.map((city) => (
                <span className={`chip city-${city}`} key={city}>
                  {cityLabel(city)}
                </span>
              ))}
            </span>
          ) : null}
          <span className="muted">{tripStats(trip)}</span>
          {timingLabel(tripTiming(trip)) ? <span className="when">{timingLabel(tripTiming(trip))}</span> : null}
          {progress.total ? <span className="muted">已訂 {progress.done}／{progress.total}</span> : null}
        </span>
      </div>
      <div className="tile-actions">
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
}: {
  trip: TripBook;
  tab: string;
  dayId: string;
  onTab: (id: string) => void;
  onDay: (id: string) => void;
  onBack: () => void;
}) {
  const activeTab = tab || (trip.days.length ? "days" : "overview");
  const activeDay = trip.days.find((day) => day.id === dayId) || trip.days[0];
  const [lightbox, setLightbox] = useState("");
  const [spotAt, setSpotAt] = useState<number | null>(null);
  const [topicAt, setTopicAt] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [checkTick, setCheckTick] = useState(0);
  const [visitTick, setVisitTick] = useState(0);
  const scrollDay = useRef("");
  const pendingSpot = useRef<number | undefined>(undefined);
  const pendingTopic = useRef<number | undefined>(undefined);
  const scrollPlace = useRef("");
  const mainRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
  }, [activeTab, activeDay?.id, trip.id, topicAt, spotAt]);

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
        if (activeDay) scrollPlace.current = cityLabel(activeDay.city);
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
  const rootTab = eatIds.has(activeTab)
    ? "eat"
    : guideIds.has(activeTab) || activeTab === "guides"
      ? "guides"
      : activeTab === "days" || activeTab === "transport" || activeTab === "map"
        ? activeTab
        : "overview";

  useEffect(() => {
    if (pendingSpot.current === undefined) {
      setSpotAt(null);
      return;
    }
    setSpotAt(pendingSpot.current >= 0 ? pendingSpot.current : null);
    pendingSpot.current = undefined;
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
      const label = cityLabel(day.city);
      if (label && !names.includes(label)) names.push(label);
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
          if (!title || title === chipTitle(guide.label) || /相片|Wikimedia|commons/i.test(title)) return [];
          return [{ title, index }];
        });
        const shown = slices.length ? slices : all.map((slice, index) => ({ title: chipTitle(slice.title) || chipTitle(guide.label), index }));
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
  const spot = activeDay && spotAt !== null ? activeDay.spots[spotAt] : undefined;
  const spotView = useMemo(() => (spot ? presentSpot(spot) : null), [spot]);
  let screenTitle = trip.title;
  if (spot) screenTitle = spot.name;
  else if (rootTab === "days" && activeDay) screenTitle = activeDay.label || activeDay.title;
  else if (rootTab === "transport") screenTitle = "交通";
  else if (rootTab === "map") screenTitle = "地圖";
  else if (openEat) screenTitle = "美食手信";
  else if (topic) screenTitle = topic.title;
  else if (openGuide) screenTitle = openGuide.label;
  else if (rootTab === "guides") screenTitle = "指南";
  else screenTitle = "總覽";

  function openHit(hit: SearchHit) {
    pendingSpot.current = hit.spot;
    setSearching(false);
    setQuery("");
    onTab("days");
    if (hit.dayId === activeDay?.id) {
      setSpotAt(hit.spot >= 0 ? hit.spot : null);
      pendingSpot.current = undefined;
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
    if (spotAt !== null) {
      setSpotAt(null);
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
    onBack();
  }

  function openDock(id: string) {
    setSearching(false);
    setQuery("");
    setSpotAt(null);
    setTopicAt(null);
    onTab(id);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="app book app-shell" onClick={onContentClick}>
      <header className="topbar">
        <button className="icon-btn" type="button" aria-label={searching || spot || topic || openGuide ? "返回" : "返回行程庫"} onClick={goBack}>
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
                <div className="navrow" key={`${hit.dayId}-${hit.spot}-${hit.title}`} onClick={() => openHit(hit)}>
                  <span className="navrow-main">
                    <strong>{hit.title}</strong>
                    <span className="pill-hint">{hit.meta}</span>
                  </span>
                  <span className="navrow-go" aria-hidden="true">›</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!searching && spot && activeDay ? (
          <article className="screen reading">
            {spot.badge ? <p className="spot-badge-row"><span className={`badge ${spot.tone}`}>{spot.badge}</span></p> : null}
            {mapLink(spot) ? (
              <a className="btn primary nav-go" href={mapLink(spot)} target="_blank" rel="noopener">
                <Navigation size={18} aria-hidden="true" />
                導航
              </a>
            ) : null}
            {activeDay && spotAt !== null ? (
              <CheckIn
                at={visits[visitKey(activeDay.id, spotAt)] || ""}
                onToggle={() => toggleVisit(trip.id, visitKey(activeDay.id, spotAt), visits[visitKey(activeDay.id, spotAt)] || "")}
              />
            ) : null}
            {spotView && (spotView.hours || spotView.address || spotView.price) ? (
              <dl className="facts">
                {spotView.hours ? <div><dt>時間</dt><dd>{spotView.hours}</dd></div> : null}
                {spotView.address ? <div><dt>地點</dt><dd>{spotView.address}</dd></div> : null}
                {spotView.price ? <div><dt>費用</dt><dd>{spotView.price}</dd></div> : null}
              </dl>
            ) : null}
            <div dangerouslySetInnerHTML={{ __html: `${spotView?.brief || ""}${spotView?.deep || ""}` }} />
            <SpotDining day={activeDay} spot={spot} guide={trip.guides.find((item) => item.id === "food" || /美食/.test(item.label))} />
          </article>
        ) : null}

        {!searching && !spot && rootTab === "overview" ? (
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
                    {cityLabel(city)}
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
            <Overview html={trip.overviewHtml} tripId={trip.id} />
          </article>
        ) : null}

        {!searching && !spot && rootTab === "days" && activeDay ? (
          <DayScreen
            trip={trip}
            day={activeDay}
            onDay={(id) => {
              setSpotAt(null);
              onDay(id);
              window.scrollTo({ top: 0 });
            }}
            onSpot={(index) => {
              setSpotAt(index);
              window.scrollTo({ top: 0 });
            }}
            onMap={() => onTab("map")}
            visits={visits}
          />
        ) : null}

        {!searching && !spot && rootTab === "transport" ? <Transport trip={trip} dayId={activeDay?.id || ""} onDay={onDay} /> : null}

        {!searching && !spot && rootTab === "map" && activeDay ? (
          <TripMap
            trip={trip}
            day={activeDay}
            onDay={onDay}
            onSpot={(index) => {
              setSpotAt(index);
              onTab("days");
              window.scrollTo({ top: 0 });
            }}
          />
        ) : null}

        {!searching && !spot && rootTab === "eat" && openEat ? (
          <section className="screen">
            <div className="segment">
              {eatGuides.map((guide) => (
                <div
                  key={guide.id}
                  className={guide.id === openEat.id ? "on" : ""}
                  onClick={() => {
                    onTab(guide.id);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  {guide.label}
                </div>
              ))}
            </div>
            {anchored.anchors.length ? (
              <div className="daystrip anchorstrip">
                {anchored.anchors.map((item) => (
                  <div
                    key={item.id}
                    className="daychip"
                    onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            ) : null}
            <article className="guide-read eat-read" dangerouslySetInnerHTML={{ __html: anchored.html }} />
          </section>
        ) : null}

        {!searching && !spot && rootTab === "guides" && !openGuide ? (
          <section className="screen">
            <h1 className="screen-title">指南</h1>
            {guideMenus.map((menu) => (
              <div key={menu.guide.id}>
                <h2 className="sheet-label">{chipTitle(menu.guide.label)}</h2>
                <div className="sheet">
                  {menu.slices.map((item) => (
                      <div
                        className="navrow"
                        key={`${menu.guide.id}-${item.index}`}
                        onClick={() => {
                          pendingTopic.current = item.index;
                          setSpotAt(null);
                          onTab(menu.guide.id);
                          window.scrollTo({ top: 0 });
                        }}
                      >
                        <span className="navrow-main">
                          <strong>{item.title}</strong>
                        </span>
                        <span className="navrow-go" aria-hidden="true">›</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {!searching && !spot && openGuide && topicAt === null ? (
          <section className="screen">
            {guideParsed?.lead ? <div className="reading lede-block" dangerouslySetInnerHTML={{ __html: guideParsed.lead }} /> : null}
            <div className="sheet">
              {(guideParsed?.slices || []).map((item, index) => (
                <div
                  className="navrow"
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
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!searching && !spot && topic ? (
          <article className="screen reading" dangerouslySetInnerHTML={{ __html: topicHtml || topic.html }} />
        ) : null}

        {trip.footer && !searching && !spot && topicAt === null && rootTab !== "map" ? <p className="foot">{trip.footer}</p> : null}
        {!searching && !spot && topicAt === null && rootTab === "overview" ? (
          <button className="btn save-trip" type="button" onClick={() => void downloadTrip(trip)}>
            <Download size={18} aria-hidden="true" />
            儲存行程
          </button>
        ) : null}
      </main>
      <nav className="dock" aria-label="主要畫面">
        {[
          ["overview", "總覽"],
          ["days", "每日"],
          ["transport", "交通"],
          ["map", "地圖"],
          [eatGuides[0]?.id || "food", "美食"],
          ["guides", "指南"],
        ].filter(([id]) => id !== "food" || eatGuides.length).map(([id, label]) => (
          <button key={label} type="button" aria-selected={rootTab === (eatIds.has(id) ? "eat" : id)} onClick={() => openDock(id)}>
            {label}
          </button>
        ))}
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
      <div className="fold-bar" onClick={() => setOpen((value) => !value)}>
        <strong>{title}</strong>
        <span>{open ? "收起" : "展開"}</span>
      </div>
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
  onMap,
}: {
  trip: TripBook;
  day: TripDay;
  visits: Record<string, string>;
  onDay: (id: string) => void;
  onSpot: (index: number) => void;
  onMap: () => void;
}) {
  const index = trip.days.findIndex((item) => item.id === day.id);
  const rationale = trip.rationales.find((item) => item.city && item.city === day.city);
  const todayKey = dayKey(day.label) || dayKey(day.title);
  const todayPoint = rationale?.points.find((point) => dayKey(point.label) === todayKey);
  const otherPoints = rationale?.points.filter((point) => point !== todayPoint) || [];
  const route = planItems(day);
  const headline = dayHeadline(day);
  const [hero, ...moreImages] = day.images;
  const chipRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLDivElement>(null);
  const seen = day.spots.filter((_, spotIndex) => visits[visitKey(day.id, spotIndex)]).length;
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
      <div className="daystrip dayjump" aria-label="日期">
        {trip.days.map((item) => {
          const chip = dayChip(item);
          const on = item.id === day.id;
          return (
            <div
              key={item.id}
              ref={on ? chipRef : undefined}
              className={on ? "daychip on" : "daychip"}
              onClick={() => onDay(item.id)}
            >
              <b>{chip.num}</b>
              {chip.hint ? <small>{chip.hint}</small> : null}
            </div>
          );
        })}
      </div>
      {hero ? (
        <figure className="refimg cover">
          <a href={hero.href || hero.src} target="_blank" rel="noopener">
            <img src={hero.src} alt={hero.caption || headline.objective} loading="lazy" />
          </a>
          {hero.caption ? <div className="attr">{cleanCredit(hero.caption)}</div> : null}
          <figcaption>
            <p className="eyebrow">
              第 {index + 1} / {trip.days.length} 日
              {day.city ? ` · ${cityLabel(day.city)}` : ""}
            </p>
            <p className="day-when">{headline.when}</p>
            <h1>{headline.objective}</h1>
          </figcaption>
        </figure>
      ) : (
        <>
          <p className="eyebrow">
            第 {index + 1} / {trip.days.length} 日
            {day.city ? ` · ${cityLabel(day.city)}` : ""}
          </p>
          <p className="day-when">{headline.when}</p>
          <h1 className="screen-title day-objective">{headline.objective}</h1>
        </>
      )}
      {moreImages.length ? (
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
      <DayFacts day={day} />
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
      {day.spots.length || day.rides.length ? (
        <>
          <h2 className="section-label">
            今日行程
            <span className="label-actions">
              <button className="map-jump" type="button" onClick={onMap}>
                地圖
              </button>
              <span className="muted">已去 {seen}／{day.spots.length}</span>
            </span>
          </h2>
          {day.spots.length ? (
            <div className="meter" aria-hidden="true">
              <span style={{ width: `${Math.round((seen / day.spots.length) * 100)}%` }} />
            </div>
          ) : null}
          <div className="timeline">
            {route.map((item) => {
              if (item.kind === "ride")
                return (
                  <RideCard
                    key={`${item.ride.from}-${item.ride.to}-${item.ride.detail}`}
                    ride={item.ride}
                    onOpenSpot={(name) => {
                      const spotIndex = day.spots.findIndex((spot) => spot.name === name);
                      if (spotIndex >= 0) onSpot(spotIndex);
                    }}
                  />
                );
              const spotIndex = item.index;
              const spotItem = day.spots[spotIndex];
              const at = visits[visitKey(day.id, spotIndex)] || "";
              return (
                <article className={at ? "stop done" : "stop"} key={`${spotItem.name}-${spotIndex}`}>
                  <span className="stop-num">{spotIndex + 1}</span>
                  <div className="stop-card" onClick={() => onSpot(spotIndex)} role="link">
                    <span className="stop-copy">
                      <strong>
                        {spotItem.name}
                        {spotItem.badge ? <em>{spotItem.badge}</em> : null}
                      </strong>
                      {spotItem.address || spotItem.price ? (
                        <small>{[spotItem.address, spotItem.price].filter(Boolean).join(" · ")}</small>
                      ) : null}
                      {at ? <span className="pill-hint">{visitClock(at)} 已去</span> : null}
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
      {/*
        Keys must differ between these two siblings. Giving both the same
        key={day.id} made React drop the first from its reconciliation map,
        so the old 今日美食 section was never unmounted and a new one
        stacked up on every date switch.
      */}
      <DayMeals key={`meals-${day.id}`} trip={trip} day={day} />
      <DaySouvenirs key={`souv-${day.id}`} trip={trip} day={day} />
      {day.noteHtml ? (
        <div className="reading day-link">
          <Html html={day.noteHtml} />
        </div>
      ) : null}
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
              <summary>成個{cityLabel(day.city) || "行程"}點排</summary>
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

function planItems(day: TripDay): Array<{ kind: "ride"; ride: Ride } | { kind: "spot"; index: number }> {
  const items: Array<{ kind: "ride"; ride: Ride } | { kind: "spot"; index: number }> = [];
  const placed = new Set<number>();
  for (const ride of day.rides) {
    items.push({ kind: "ride", ride });
    if (ride.spot) {
      const index = day.spots.findIndex(
        (spot, spotIndex) => !placed.has(spotIndex) && spot.name === ride.spot,
      );
      if (index >= 0) {
        placed.add(index);
        items.push({ kind: "spot", index });
      }
    }
  }
  day.spots.forEach((_, index) => {
    if (!placed.has(index)) items.push({ kind: "spot", index });
  });
  return items;
}

function RideCard({ ride, onOpenSpot }: { ride: Ride; onOpenSpot?: (spotName: string) => void }) {
  const line = [ride.detail, ride.price].filter(Boolean).join(" · ");
  const [open, setOpen] = useState(false);
  const openable = Boolean(ride.spot && onOpenSpot);
  const longNote = ride.note.length > 36;
  return (
    <div className={openable ? "leg openable" : "leg"}>
      <button className="leg-main" type="button" disabled={!openable} onClick={() => openable && onOpenSpot?.(ride.spot)}>
        <span className="mode">{ride.mode || "前往"}</span>
        <span>
          <strong>
            {ride.from} → {ride.to}
          </strong>
          {line ? <small>{line}</small> : null}
        </span>
      </button>
      {ride.note ? (
        longNote && !open ? (
          <button className="leg-more" type="button" onClick={() => setOpen(true)}>
            班次詳情
          </button>
        ) : (
          <p className="tiny">{ride.note}</p>
        )
      ) : null}
    </div>
  );
}

function leadLong(html: string): boolean {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, "").length > 80;
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
  const chipRef = useRef<HTMLDivElement>(null);
  const covered = new Set(days.map((item) => item.label.replace(/\s+/g, "").slice(0, 6)));
  const leftover = trip.transport.blocks.filter((block) => !covered.has(block.heading.replace(/\s+/g, "").slice(0, 6)) && !days.some((item) => block.heading.replace(/\s+/g, "").includes(item.label.replace(/\s+/g, "").slice(0, 6))));
  useEffect(() => {
    const strip = chipRef.current?.parentElement;
    const chip = chipRef.current;
    if (!strip || !chip) return;
    strip.scrollTo({ left: chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2 });
  }, [day?.id]);
  return (
    <section className="screen">
      {days.length ? (
        <div className="daystrip dayjump">
          {days.map((item) => {
            const chip = dayChip(item);
            const on = item.id === day?.id;
            return (
              <div
                key={item.id}
                ref={on ? chipRef : undefined}
                className={on ? "daychip on" : "daychip"}
                onClick={() => onDay(item.id)}
              >
                <b>{chip.num}</b>
                {chip.hint ? <small>{chip.hint}</small> : null}
              </div>
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
                <RideCard key={`${day.id}-${ride.from}-${ride.to}-${ride.detail}`} ride={ride} />
              ))}
            </div>
          ) : (
            <p className="muted">呢日未有路程。</p>
          )}
        </article>
      ) : null}
      {leftover.map((block) => (
        <article className="reading block" key={block.heading}>
          <div dangerouslySetInnerHTML={{ __html: block.html }} />
        </article>
      ))}
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
  const chip = dayChip(day);
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
          {draft.accuracy ? <p className="tiny">大約 {draft.accuracy} 米</p> : null}
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
