import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
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
  type LucideIcon,
} from "lucide-react";
import {
  cityLabel,
  deleteTrip,
  downloadTrip,
  loadNote,
  loadTrips,
  loadUi,
  parseTripFile,
  saveNote,
  saveUi,
  tripStats,
  upsertTrips,
  type TripBook,
  type TripDay,
} from "@/lib/trip";
import { DrivePanel } from "@/components/drive-panel";
import { AI_TRIP_PROMPT } from "@/lib/ai-prompt";

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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadTrips();
    const ui = loadUi();
    setTrips(stored);
    const returning =
      window.location.hash.includes("access_token") || window.location.hash.includes("error=");
    if (!returning && ui.openId && stored.some((trip) => trip.id === ui.openId)) {
      setOpenId(ui.openId);
      setTab(ui.tab);
      setDayId(ui.dayId);
    }
    setReady(true);
  }, []);

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
            <strong>行程書</strong>
            <span>只存在呢部瀏覽器</span>
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
                <strong>上傳行程 JSON</strong>
                <span>內容同筆記留喺呢部機，可以再同步去 Google Drive</span>
              </button>
            </section>
          ) : (
            <section>
              <div className="lib-head">
                <h1>行程庫</h1>
                <p className="muted">撳卡片打開。同一個 id 再上傳會更新內容，筆記保留。</p>
              </div>
              <div className="trip-grid">
                {trips.map((trip) => (
                  <TripCard
                    key={trip.id}
                    trip={trip}
                    onOpen={() => {
                      setOpenId(trip.id);
                      setTab("");
                      setDayId(trip.days[0]?.id || "");
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
              複製 AI 行程提示詞
            </button>
          </p>
          {promptFallback ? (
            <textarea className="prompt-box" readOnly value={AI_TRIP_PROMPT} />
          ) : null}
          <DrivePanel onLibraryChange={() => setTrips(loadTrips())} />
          <details className="format">
            <summary>行程檔格式</summary>
            <p className="tiny">
              schemaVersion 必須係 1。id 相同會覆蓋內容，筆記按 id 保留。可以係單一物件，或者一個行程陣列。
            </p>
            <pre>{`{
  "schemaVersion": 1,
  "id": "my-trip",
  "title": "旅行計畫",
  "days": [{ "id": "d1", "label": "Day 1", "title": "到達", "spots": [] }],
  "guides": [{ "id": "food", "label": "美食", "html": "" }]
}`}</pre>
          </details>
        </main>
      </div>
    );
  }

  return (
    <Book
      trip={openTrip}
      tab={tab}
      dayId={dayId}
      onTab={setTab}
      onDay={setDayId}
      onBack={() => setOpenId("")}
      onDelete={() => {
        setTrips(deleteTrip(trips, openTrip.id));
        setOpenId("");
        setStatus(`已刪除「${openTrip.title}」`);
      }}
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
        </span>
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
      ) : (
        <button className="icon-btn" type="button" aria-label="刪除行程" onClick={() => setConfirm(true)}>
          <Trash2 size={18} aria-hidden="true" />
        </button>
      )}
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
  onDelete,
}: {
  trip: TripBook;
  tab: string;
  dayId: string;
  onTab: (id: string) => void;
  onDay: (id: string) => void;
  onBack: () => void;
  onDelete: () => void;
}) {
  const activeTab = tab || (trip.days.length ? "days" : "overview");
  const activeDay = trip.days.find((day) => day.id === dayId) || trip.days[0];
  const [lightbox, setLightbox] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [spotAt, setSpotAt] = useState<number | null>(null);
  const [topicAt, setTopicAt] = useState<number | null>(null);
  const scrollDay = useRef("");
  const mainRef = useRef<HTMLElement>(null);

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
      : activeTab === "days" || activeTab === "transport"
        ? activeTab
        : "overview";

  useEffect(() => {
    setSpotAt(null);
  }, [activeDay?.id]);

  useEffect(() => {
    setTopicAt(null);
  }, [activeTab, trip.id]);

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
  const guideParsed = useMemo(() => (openGuide ? guideSlices(openGuide.html) : null), [openGuide]);
  const topic = guideParsed && topicAt !== null ? guideParsed.slices[topicAt] : undefined;
  const topicHtml = useMemo(() => (topic ? presentSlice(topic.html) : ""), [topic]);
  const spot = activeDay && spotAt !== null ? activeDay.spots[spotAt] : undefined;
  const spotBody = useMemo(() => (spot ? spotHtml(spot.html, spot.name) : ""), [spot]);
  let screenTitle = trip.title;
  if (spot) screenTitle = spot.name;
  else if (rootTab === "days" && activeDay) screenTitle = activeDay.label || activeDay.title;
  else if (rootTab === "transport") screenTitle = "交通";
  else if (openEat) screenTitle = "美食手信";
  else if (topic) screenTitle = topic.title;
  else if (openGuide) screenTitle = openGuide.label;
  else if (rootTab === "guides") screenTitle = "指南";
  else screenTitle = "總覽";

  function goBack() {
    if (spotAt !== null) {
      setSpotAt(null);
      return;
    }
    if (topicAt !== null) {
      setTopicAt(null);
      return;
    }
    if (rootTab === "guides" && openGuide) {
      onTab("guides");
      return;
    }
    onBack();
  }

  function openDock(id: string) {
    setSpotAt(null);
    setTopicAt(null);
    onTab(id);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="app book app-shell" onClick={onContentClick}>
      <header className="topbar">
        <button className="icon-btn" type="button" aria-label={spot || topic || openGuide ? "返回" : "返回行程庫"} onClick={goBack}>
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <p className="top-title">{screenTitle}</p>
        <button className="icon-btn" type="button" aria-label="匯出 JSON" onClick={() => downloadTrip(trip)}>
          <Download size={18} aria-hidden="true" />
        </button>
        <button className="icon-btn" type="button" aria-label="刪除行程" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </header>
      {confirmDelete ? (
        <div className="confirmbar">
          <span>刪除呢個行程？只會清呢部機。</span>
          <button className="btn danger" type="button" onClick={onDelete}>
            刪除
          </button>
          <button className="btn ghost" type="button" onClick={() => setConfirmDelete(false)}>
            取消
          </button>
        </div>
      ) : null}
      <main ref={mainRef}>
        {spot && activeDay ? (
          <article className="screen reading">
            {spot.badge ? <p className="spot-badge-row"><span className={`badge ${spot.tone}`}>{spot.badge}</span></p> : null}
            <div dangerouslySetInnerHTML={{ __html: spotBody }} />
          </article>
        ) : null}

        {!spot && rootTab === "overview" ? (
          <article className="screen reading">
            <h1 className="screen-title">{trip.title}</h1>
            {trip.subtitle ? <p className="lede">{trip.subtitle}</p> : null}
            {trip.tagline ? <p className="lede">{trip.tagline}</p> : null}
            <Overview html={trip.overviewHtml} />
          </article>
        ) : null}

        {!spot && rootTab === "days" && activeDay ? (
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
          />
        ) : null}

        {!spot && rootTab === "transport" ? <Transport trip={trip} /> : null}

        {!spot && rootTab === "eat" && openEat ? (
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
            <article className="reading" dangerouslySetInnerHTML={{ __html: anchored.html }} />
          </section>
        ) : null}

        {!spot && rootTab === "guides" && !openGuide ? (
          <section className="screen">
            <h1 className="screen-title">指南</h1>
            <div className="sheet">
              {trip.guides.filter((guide) => !eatIds.has(guide.id)).map((guide) => (
                <div className="navrow" key={guide.id} onClick={() => openDock(guide.id)}>
                  <span className="navrow-main">
                    <strong>{guide.label}</strong>
                  </span>
                  <span className="navrow-go" aria-hidden="true">›</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!spot && openGuide && topicAt === null ? (
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

        {!spot && topic ? (
          <article className="screen reading" dangerouslySetInnerHTML={{ __html: topicHtml || topic.html }} />
        ) : null}

        {trip.footer && !spot && topicAt === null ? <p className="foot">{trip.footer}</p> : null}
      </main>
      <nav className="dock" aria-label="主要畫面">
        {[
          ["overview", "總覽"],
          ["days", "每日"],
          ["transport", "交通"],
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

function FoldSection({ title, html }: { title: string; html: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && ref.current) labelTables(ref.current);
  }, [open]);
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

function Overview({ html }: { html: string }) {
  const parts = useMemo(() => splitOverview(shownHtml(html)), [html]);
  if (!parts.rest.length) return <Html html={html} />;
  return (
    <>
      {parts.lead ? <div className="reading" dangerouslySetInnerHTML={{ __html: parts.lead }} /> : null}
      <div className="reading" dangerouslySetInnerHTML={{ __html: parts.first }} />
      {parts.rest.map((section) => (
        <FoldSection key={section.title} title={section.title} html={section.html} />
      ))}
    </>
  );
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
  return root.innerHTML;
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
  onDay,
  onSpot,
}: {
  trip: TripBook;
  day: TripDay;
  onDay: (id: string) => void;
  onSpot: (index: number) => void;
}) {
  const index = trip.days.findIndex((item) => item.id === day.id);
  const rationale = trip.rationales.find((item) => item.city && item.city === day.city);
  return (
    <section className="screen">
      <div className="daystrip" aria-label="日期">
        {trip.days.map((item) => {
          const chip = dayChip(item);
          return (
            <div
              key={item.id}
              className={item.id === day.id ? "daychip on" : "daychip"}
              onClick={() => onDay(item.id)}
            >
              {chip.num}
            </div>
          );
        })}
      </div>
      <p className="eyebrow">
        第 {index + 1} / {trip.days.length} 日
        {day.city ? ` · ${cityLabel(day.city)}` : ""}
      </p>
      <h1 className="screen-title">{day.title}</h1>
      {day.images.length ? (
        <div className="dayimgs">
          {day.images.map((image) => (
            <figure className="refimg" key={image.src}>
              <a href={image.href || image.src} target="_blank" rel="noopener">
                <img src={image.src} alt={image.caption || day.title} loading="lazy" />
              </a>
              {image.caption ? <div className="attr">{image.caption}</div> : null}
            </figure>
          ))}
        </div>
      ) : null}
      <div className="reading">
        {day.leadHtml ? <Html html={day.leadHtml} /> : null}
        {day.walkHtml ? <Html html={day.walkHtml} /> : null}
        {day.foodHtml ? <Html html={day.foodHtml} /> : null}
        {day.noteHtml ? <Html html={day.noteHtml} /> : null}
      </div>
      {day.spots.length ? (
        <>
          <h2 className="section-label">景點</h2>
          <div className="sheet">
            {day.spots.map((item, spotIndex) => (
              <div className="navrow" key={`${item.name}-${spotIndex}`} onClick={() => onSpot(spotIndex)}>
                <span className="navrow-num">{spotIndex + 1}</span>
                <span className="navrow-main">
                  <strong>{item.name}</strong>
                  {item.badge ? <em>{item.badge}</em> : null}
                </span>
                <span className="navrow-go" aria-hidden="true">›</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
      <DayNotes tripId={trip.id} dayId={day.id} />
      {rationale ? (
        <div className="reading rationale-foot">
          <Html html={rationale.html} />
        </div>
      ) : null}
    </section>
  );
}

function Transport({ trip }: { trip: TripBook }) {
  const jumps = trip.days.filter((day) =>
    trip.transport.blocks.some((block) => block.heading.startsWith(day.label.slice(0, 6))),
  );
  return (
    <section className="screen">
      {jumps.length ? (
        <div className="daystrip anchorstrip">
          {jumps.map((day) => (
            <div
              key={day.id}
              className="daychip"
              onClick={() => document.getElementById(`leg-${day.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {dayChip(day).num}
            </div>
          ))}
        </div>
      ) : null}
      {trip.transport.introHtml ? <div className="reading" dangerouslySetInnerHTML={{ __html: trip.transport.introHtml }} /> : null}
      {trip.transport.blocks.map((block) => {
        const match = jumps.find((day) => block.heading.startsWith(day.label.slice(0, 6)));
        return (
          <article className="reading block" id={match ? `leg-${match.id}` : undefined} key={block.heading}>
            <div dangerouslySetInnerHTML={{ __html: block.html }} />
          </article>
        );
      })}
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
        placeholder="去到先寫：實際去咗邊、使咗幾多、有咩下次唔同做法…（自動存在呢部機，唔會上傳）"
        onChange={(event) => {
          setValue(event.target.value);
          saveNote(tripId, dayId, event.target.value);
          setSaved(true);
        }}
      />
    </div>
  );
}
