import { useEffect, useState, type ComponentType } from "react";
import type { HotelStay, RouteLeg } from "@/types/trip";
import { useI18n } from "@/i18n";

export type MapStop = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  number?: number;
  kind?: "stop" | "place" | "hotel";
};

export type MapLeg = {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  mode: RouteLeg["mode"];
};

export type TripMapProps = {
  stops: MapStop[];
  legs?: MapLeg[];
  hotel?: HotelStay;
  selectedId?: string;
  onSelect?: (id: string) => void;
  className?: string;
};

export function TripMap(props: TripMapProps) {
  const [Inner, setInner] = useState<ComponentType<TripMapProps> | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    let live = true;
    void import("./trip-map-inner").then((mod) => {
      if (live) setInner(() => mod.TripMapInner);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!Inner) {
    return (
      <div className={`flex items-center justify-center bg-bg-warm text-sm text-muted ${props.className ?? "h-full"}`}>
        {t("common.loadingMap")}
      </div>
    );
  }
  return <Inner {...props} />;
}
