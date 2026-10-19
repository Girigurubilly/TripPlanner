import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { DayEntry, ExtraStop, TripBook, TripDay } from "../lib/trip";
import { cityLabel, loadExtras, mapEntryTargets } from "../lib/trip";
import { cityCenter, geocode, type GeoPoint } from "../lib/geocode";

type Pin = {
  entry: DayEntry;
  num: number;
  kind: "spot" | "meal" | "hotel";
  name: string;
  query: string | null;
  bias: GeoPoint | null;
  point: GeoPoint | null;
};

type ExtraPin = { name: string; point: GeoPoint };

const KIND_LABEL: Record<Pin["kind"], string> = {
  spot: "📷 景點",
  meal: "🍽️ 用餐",
  hotel: "🛏️ 住宿",
};

export function TripMap({
  trip,
  day,
  onDay,
  onEntry,
}: {
  trip: TripBook;
  day: TripDay;
  onDay: (id: string) => void;
  onEntry: (entry: DayEntry) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const follow = useRef(true);
  const [ready, setReady] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState(0);
  const [extras, setExtras] = useState<ExtraStop[]>([]);
  // Same source of truth as the day screen: the unified timeline
  // (sights + meals + hotels, in chronological order). The map never
  // reads day.spots directly, so it cannot drift from the daily route.
  const targets = useMemo(() => mapEntryTargets(day), [day]);

  useEffect(() => {
    const load = () => setExtras(loadExtras(trip.id));
    load();
    window.addEventListener("trip-extras", load);
    return () => window.removeEventListener("trip-extras", load);
  }, [trip.id]);

  useEffect(() => {
    let stop = false;
    setActive(0);
    follow.current = true;
    setPins(targets.map((item) => ({ ...item, point: null })));
    const mappable = targets.filter((item) => item.query);
    setPending(mappable.length);
    void (async () => {
      for (const target of mappable) {
        if (stop) return;
        // Per-entry bias: a Florence entry on a Milan-start day must be
        // geocoded against Florence, or the bias guard rejects it.
        const point = await geocode(target.query!, target.bias);
        if (stop) return;
        setPins((current) =>
          current.map((pin) =>
            pin.entry.kind === target.entry.kind && pin.entry.index === target.entry.index ? { ...pin, point } : pin,
          ),
        );
        setPending((count) => Math.max(0, count - 1));
      }
    })();
    return () => {
      stop = true;
    };
  }, [day.id, targets]);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let dead = false;
    void import("leaflet").then((L) => {
      if (dead || mapRef.current) return;
      const map = L.map(node, { zoomControl: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      const center = cityCenter(day.city) || { lat: 22.3, lng: 114.2 };
      map.setView([center.lat, center.lng], 13);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
      setTimeout(() => map.invalidateSize(), 80);
    });
    return () => {
      dead = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !ready) return;
    const chosen = pins[active];
    void import("leaflet").then((L) => {
      layer.clearLayers();
      const placed = pins.flatMap((pin, pinIndex) => (pin.point ? [{ pin, pinIndex }] : []));
      const extraPins: ExtraPin[] = extras
        .filter((stop) => stop.dayId === day.id)
        .map((stop) => ({ name: stop.name, point: { lat: stop.lat, lng: stop.lng } }));
      // Route line through the day's placed entries in timeline order —
      // the same order the daily route shows them.
      const line = placed.map(({ pin }) => [pin.point!.lat, pin.point!.lng] as [number, number]);
      if (line.length > 1) L.polyline(line, { color: "#1e6f6f", weight: 4, opacity: 0.85 }).addTo(layer);
      for (const { pin, pinIndex } of placed) {
        if (!pin.point) continue;
        const on = pinIndex === active;
        const marker = L.marker([pin.point.lat, pin.point.lng], {
          icon: L.divIcon({
            className: `map-pin ${pin.kind}${on ? " on" : ""}`,
            html: `<span>${pin.num}</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
          zIndexOffset: on ? 500 : 0,
        });
        marker.on("click", () => {
          follow.current = false;
          setActive(pinIndex);
        });
        marker.addTo(layer);
      }
      for (const extra of extraPins) {
        const marker = L.marker([extra.point.lat, extra.point.lng], {
          icon: L.divIcon({
            className: "map-pin extra",
            html: `<span>+</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
        });
        marker.addTo(layer);
      }
      if (!follow.current && chosen?.point) map.panTo([chosen.point.lat, chosen.point.lng]);
      else if (line.length) map.fitBounds(line, { padding: [32, 32], maxZoom: 16 });
      else {
        const center = cityCenter(day.city);
        if (center) map.setView([center.lat, center.lng], 13);
      }
    });
  }, [pins, extras, day.id, day.city, active, ready]);

  const placed = pins.filter((pin) => pin.point);
  const current = pins[active] || pins[0];
  const route =
    placed.length > 1
      ? `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=${placed[0].point!.lat},${placed[0].point!.lng}&destination=${placed[placed.length - 1].point!.lat},${placed[placed.length - 1].point!.lng}&waypoints=${placed
          .slice(1, -1)
          .map((pin) => `${pin.point!.lat},${pin.point!.lng}`)
          .join("|")}`
      : "";

  return (
    <section className="map-view">
      <div className="daystrip dayjump">
        {trip.days.map((item) => {
          const chip = dayChip(item);
          const on = item.id === day.id;
          return (
            <div key={item.id} className={on ? "daychip on" : "daychip"} onClick={() => onDay(item.id)}>
              <b>{chip.num}</b>
              {chip.hint ? <small>{chip.hint}</small> : null}
            </div>
          );
        })}
      </div>
      <div className="map-canvas" ref={host} />
      <div className="map-bar">
        {pending ? <p className="tiny">定位緊 {pending} 個地點…</p> : null}
        {current ? (
          <div className="map-now">
            <strong>
              {current.num}. {current.name} <span>{KIND_LABEL[current.kind]}</span>
            </strong>
            <span>
              {current.point ? null : current.query ? <em>搵唔到位置</em> : <em>未有地點</em>}
              <button type="button" onClick={() => onEntry(current.entry)}>
                詳情
              </button>
            </span>
          </div>
        ) : (
          <p className="tiny">{cityLabel(day.city) || "今日"}未有可以標示嘅地點。</p>
        )}
        {pins.length > 1 ? (
          <div className="map-picks">
            {pins.map((pin, pinIndex) => (
              <button
                key={`${pin.kind}-${pin.entry.index}`}
                type="button"
                className={pinIndex === active ? "on" : ""}
                onClick={() => {
                  follow.current = false;
                  setActive(pinIndex);
                }}
              >
                {pin.num}
              </button>
            ))}
          </div>
        ) : null}
        {route ? (
          <a className="btn primary nav-go" href={route} target="_blank" rel="noopener">
            用 Google 地圖行晒今日
          </a>
        ) : null}
      </div>
    </section>
  );
}

function dayChip(day: TripDay): { num: string; hint: string } {
  const num = day.label.match(/(\d{1,2})/)?.[1] ?? day.label.slice(0, 2);
  if (day.label.includes("聖誕")) return { num, hint: "聖誕" };
  if (day.label.includes("返")) return { num, hint: "回程" };
  const inside = day.label.match(/（([^）]+)）/)?.[1] ?? "";
  const mark = inside.match(/[一二三四五六日]/)?.[0];
  return { num, hint: mark ? `週${mark}` : inside || cityLabel(day.city) };
}
