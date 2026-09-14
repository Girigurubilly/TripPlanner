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
    const zones = searchTimeZones(query, query ? 50 : 500);
    if (value && !zones.includes(value)) zones.unshift(value);
    return zones.map((tz) => {
      const offset = zoneOffset(tz, loc);
      return {
        id: tz,
        label: `${zoneCity(tz)}${offset ? ` · ${offset}` : ""}`,
        description: tz,
      };
    });
  }, [query, value, loc]);

  const selectedOffset = value ? zoneOffset(value, loc) : "";
  const display = value ? `${zoneCity(value)}${selectedOffset ? ` · ${selectedOffset}` : ""}` : "";

  return (
    <Combobox
      value={value}
      displayValue={display}
      onChange={(next) => onChange(next)}
      items={items}
      placeholder={t("newTrip.tzPick")}
      allowCustom={false}
      emptyText={t("newTrip.tzEmpty")}
      onQueryChange={setQuery}
      filterLocal={false}
      appearance="select"
    />
  );
}
