import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TransportMode } from "@/types/trip";
import { formatDistanceI18n, formatDurationI18n } from "@/i18n/format";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/utils";
import type { TripMapProps } from "./trip-map";

const MODE_COLOR: Record<TransportMode, string> = {
  walk: "#21564a",
  transit: "#3d4f6f",
  taxi: "#8a5a28",
  cycle: "#3d6b4f",
};

function numberIcon(n: number, selected: boolean) {
  return L.divIcon({
    className: "tc-marker",
    html: `<div class="tc-marker-num" style="${selected ? "transform:scale(1.12);outline:2px solid #fffcf6" : ""}">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function hotelIcon() {
  return L.divIcon({
    className: "tc-marker",
    html: `<div class="tc-marker-hotel">H</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function placeIcon(selected: boolean) {
  return L.divIcon({
    className: "tc-marker",
    html: `<div class="tc-marker-place" style="${selected ? "width:16px;height:16px;border-width:3px" : ""}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!positions.length) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    map.fitBounds(positions, { padding: [28, 28], maxZoom: 15 });
  }, [map, positions]);
  return null;
}

export function TripMapInner({ stops, legs = [], hotel, selectedId, onSelect, className }: TripMapProps) {
  const positions: [number, number][] = [
    ...stops.map((s) => [s.lat, s.lng] as [number, number]),
    ...(hotel ? ([[hotel.lat, hotel.lng]] as [number, number][]) : []),
  ];
  const center = positions[0] ?? ([35.68, 139.76] as [number, number]);

  return (
    <div className={cn("h-full min-h-64 overflow-hidden", className)}>
      <MapContainer
        center={center}
        zoom={13}
        className="h-full w-full"
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds positions={positions} />
        {hotel ? (
          <Marker position={[hotel.lat, hotel.lng]} icon={hotelIcon()}>
            <Popup>
              <strong>{hotel.name}</strong>
              <div>Check-in {hotel.checkInTime} · out {hotel.checkOutTime}</div>
            </Popup>
          </Marker>
        ) : null}
        {stops.map((stop) => (
          <Marker
            key={stop.id}
            position={[stop.lat, stop.lng]}
            icon={
              stop.kind === "hotel"
                ? hotelIcon()
                : stop.number
                  ? numberIcon(stop.number, selectedId === stop.id)
                  : placeIcon(selectedId === stop.id)
            }
            eventHandlers={{ click: () => onSelect?.(stop.id) }}
          >
            <Popup>
              <strong>{stop.number ? `${stop.number}. ` : ""}{stop.name}</strong>
            </Popup>
          </Marker>
        ))}
        {legs.map((leg, i) => (
          <Polyline
            key={i}
            positions={[
              [leg.from.lat, leg.from.lng],
              [leg.to.lat, leg.to.lng],
            ]}
            pathOptions={{
              color: MODE_COLOR[leg.mode],
              weight: 3.5,
              opacity: 0.85,
              dashArray: leg.mode === "walk" ? "6 8" : leg.mode === "transit" ? "1 0" : "10 6",
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}

export function LegCaption({
  mode,
  durationMin,
  distanceM,
}: {
  mode: TransportMode;
  durationMin: number;
  distanceM: number;
}) {
  const { t } = useI18n();
  return (
    <span className="text-xs text-muted">
      {t(`transport.${mode}` as MessageKey)} · {formatDurationI18n(durationMin, t)} · {formatDistanceI18n(distanceM, t)}
    </span>
  );
}
