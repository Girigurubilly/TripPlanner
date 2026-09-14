import { useEffect, useMemo, useState } from "react";
import { Plane } from "lucide-react";
import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import {
  airportLine,
  loadAirports,
  searchAirports,
  type Airport,
} from "@/data/airports";
import { intlLocale, useI18n } from "@/i18n";

export function AirportSelect({
  value,
  onChange,
  onAirport,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  onAirport?: (airport: Airport) => void;
  placeholder?: string;
}) {
  const { t, locale } = useI18n();
  const loc = intlLocale(locale);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    void loadAirports()
      .then((list) => {
        if (live) setAirports(list);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  const items = useMemo<ComboboxItem[]>(() => {
    const hits = searchAirports(airports, query || value, 12);
    return hits.map((a) => ({
      id: a.iata,
      label: `${a.iata} · ${a.name}`,
      description: airportLine(a, loc),
      icon: <Plane className="size-4" />,
    }));
  }, [airports, query, value, loc]);

  return (
    <Combobox
      value={value}
      onChange={(next, item) => {
        const code = next.trim().toUpperCase();
        onChange(code);
        if (item) {
          const hit = airports.find((a) => a.iata === item.id);
          if (hit) onAirport?.(hit);
        }
      }}
      items={items}
      placeholder={placeholder ?? t("newTrip.airportPh")}
      customLabel={(q) => t("newTrip.useAirport", { code: q.toUpperCase() })}
      emptyText={t("newTrip.noAirport")}
      loadingText={loading ? t("newTrip.loadingAirports") : t("newTrip.noAirport")}
      onQueryChange={setQuery}
      filterLocal={false}
    />
  );
}
