import { useMemo, useState } from "react";
import { Combobox, type ComboboxItem } from "@/components/ui/combobox";
import { searchTimeZones, zoneCity, zoneOffset } from "@/lib/timezones";
import { useI18n, intlLocale } from "@/i18n";

export function TimezoneSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const loc = intlLocale(locale);
  const items = useMemo<ComboboxItem[]>(() => {
    const zones = searchTimeZones(query, query ? 20 : 24);
    if (value && !zones.includes(value)) zones.unshift(value);
    return zones.map((tz) => {
      const offset = zoneOffset(tz, loc);
      return {
        id: tz,
        label: zoneCity(tz),
        description: offset ? `${tz} · ${offset}` : tz,
      };
    });
  }, [query, value, loc]);

  return (
    <Combobox
      value={value}
      displayValue={value}
      onChange={(next) => onChange(next)}
      items={items}
      placeholder={t("newTrip.tzSearch")}
      allowCustom={false}
      emptyText={t("newTrip.tzEmpty")}
      onQueryChange={setQuery}
      filterLocal={false}
    />
  );
}
