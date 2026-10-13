import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import type { ExtraStop, TripBook, TripDay } from "../lib/trip";
import { cityLabel, loadExtras } from "../lib/trip";
import { canMap, cityCenter, geocode, mapQuery, type GeoPoint } from "../lib/geocode";

type Pin = { index: number; name: string; point: GeoPoint | null; extra?: boolean };

export function TripMap({
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
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const follow = useRef(true);
  const [ready, setReady] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);
  const [active, setActive] = useState(0);
  const [pending, setPending] = useState(0);
  const [extras, setExtras] = useState<ExtraStop[]>([]);
  const targets = useMemo(
    () =>
      day.spots.flatMap((spot, index) =>
        canMap(spot.address || spot.name) ? [{ index, name: spot.name, query: mapQuery(spot.address || spot.name, day.city) }] : [],
      ),
    [day],
  );

  useEffect(() => {
    const load = () => setExtras(loadExtras(trip.id));
    load();
    window.addEventListener("trip-extras", load);
    return () => window.removeEventListener("trip-extras", load);
  }, [trip.id]);

  useEffect(() => {
    let stop = false;
    const bias = cityCenter(day.city);
    setActive(0);
    follow.current = true;
    setPins(targets.map((item) => ({ index: item.index, name: item.name, point: null })));
    setPending(targets.length);
    void (async () => {
      for (let i = 0; i < targets.length; i += 1) {
        if (stop) return;
        const point = await geocode(targets[i].query, bias);
        if (stop) return;
        setPins((current) => current.map((pin, pinIndex) => (pinIndex === i ? { ...pin, point } : pin)));
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
      const placed = pins.flatMap((pin) => (pin.point ? [pin] : []));
      const extraPins: Pin[] = extras
        .filter((stop) => stop.dayId === day.id)
        .map((stop) => ({ index: -1, name: stop.name, point: { lat: stop.lat, lng: stop.lng }, extra: true }));
      const line = placed.map((pin) => [pin.point!.lat, pin.point!.lng] as [number, number]);
      if (line.length > 1) L.polyline(line, { color: "#1e6f6f", weight: 4, opacity: 0.85 }).addTo(layer);
      for (const pin of [...placed, ...extraPins]) {
        if (!pin.point) continue;
        const on = pin.index >= 0 && pin.index === chosen?.index;
        const marker = L.marker([pin.point.lat, pin.point.lng], {
          icon: L.divIcon({
            className: pin.extra ? "map-pin extra" : on ? "map-pin on" : "map-pin",
            html: `<span>${pin.extra ? "+" : pin.index + 1}</span>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          }),
          zIndexOffset: on ? 500 : 0,
        });
        marker.on("click", () => {
          if (pin.index < 0) return;
          follow.current = false;
          setActive(pins.findIndex((item) => item.index === pin.index));
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
        {pending ? <p className="tiny">定位緊 {pending} 個景點…</p> : null}
        {current ? (
          <div className="map-now">
            <strong>
              {current.index + 1}. {current.name}
            </strong>
            <span>
              {current.point ? null : <em>搵唔到位置</em>}
              <button type="button" onClick={() => onSpot(current.index)}>
                詳情
              </button>
            </span>
          </div>
        ) : (
          <p className="tiny">{cityLabel(day.city) || "今日"}未有可以標示嘅景點。</p>
        )}
        {pins.length > 1 ? (
          <div className="map-picks">
            {pins.map((pin, pinIndex) => (
              <button
                key={pin.index}
                type="button"
                className={pinIndex === active ? "on" : ""}
                onClick={() => {
                  follow.current = false;
                  setActive(pinIndex);
                }}
              >
                {pin.index + 1}
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
