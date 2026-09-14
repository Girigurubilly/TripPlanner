import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Plane, Plus, X } from "lucide-react";
import {
  airportToDestination,
  airportLine,
  countryLabel,
  loadAirports,
  searchAirports,
  type Airport,
} from "@/data/airports";
import { DESTINATIONS, searchDestinations, toTripDestination } from "@/data/destinations";
import { destinationLabel } from "@/lib/trip-label";
import { uid } from "@/lib/utils";
import { intlLocale, useI18n } from "@/i18n";
import type { TripDestination } from "@/types/trip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Hit =
  | { kind: "city"; id: string; cityId: string }
  | { kind: "airport"; id: string; iata: string };

export function DestinationSearch({
  value,
  onChange,
}: {
  value: TripDestination[];
  onChange: (next: TripDestination[]) => void;
}) {
  const { t, locale } = useI18n();
  const loc = intlLocale(locale);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  function refreshAirports() {
    setLoading(true);
    setLoadError(false);
    void loadAirports()
      .then((list) => setAirports(list))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refreshAirports();
  }, []);

  const selectedIds = value.map((d) => d.id);
  const selectedIata = new Set(value.map((d) => d.iata).filter(Boolean));
  const cityHits = useMemo(() => searchDestinations(query, selectedIds), [query, value]);
  const extraAirportQueries = useMemo(
    () => (query.trim() ? cityHits.flatMap((c) => [c.name, c.iata ?? ""]).filter(Boolean) : []),
    [cityHits, query],
  );
  const airportHits = useMemo(
    () =>
      searchAirports(airports, query, query.trim() ? 20 : 12, extraAirportQueries).filter(
        (a) => !selectedIata.has(a.iata),
      ),
    [airports, query, extraAirportQueries, value],
  );

  const hits: Hit[] = useMemo(() => {
    const q = query.trim();
    const cities: Hit[] = cityHits.map((c) => ({ kind: "city", id: `city-${c.id}`, cityId: c.id }));
    const apts: Hit[] = airportHits.map((a) => ({ kind: "airport", id: `apt-${a.iata}`, iata: a.iata }));
    if (q.length === 3 && /^[a-zA-Z]{3}$/.test(q)) return [...apts, ...cities];
    return [...cities, ...apts];
  }, [cityHits, airportHits, query]);

  const nearbyIds = value.flatMap((d) => DESTINATIONS.find((c) => c.id === d.id)?.nearby ?? []);
  const heading = !query.trim()
    ? value.length
      ? t("newTrip.nearby")
      : t("newTrip.recommended")
    : t("newTrip.destMatches");

  function addCity(dest: TripDestination) {
    if (value.some((d) => d.id === dest.id || d.name.toLowerCase() === dest.name.toLowerCase())) return;
    onChange([...value, dest]);
    setQuery("");
    setOpen(true);
    setActive(0);
  }

  function addHit(hit: Hit) {
    if (hit.kind === "city") {
      const city = DESTINATIONS.find((c) => c.id === hit.cityId);
      if (city) addCity(toTripDestination(city));
      return;
    }
    const airport = airports.find((a) => a.iata === hit.iata);
    if (airport) addCity(airportToDestination(airport));
  }

  function addCustom() {
    const name = query.trim();
    if (!name) return;
    const iata = name.toUpperCase();
    const airport = /^[A-Z]{3}$/.test(iata) ? airports.find((a) => a.iata === iata) : undefined;
    if (airport) {
      addCity(airportToDestination(airport));
      return;
    }
    addCity({
      id: uid("dest"),
      name,
      country: value[0]?.country ?? "",
      timezone: value[0]?.timezone || "Asia/Tokyo",
      lat: value[0]?.lat ?? 35.68,
      lng: value[0]?.lng ?? 139.76,
    });
  }

  return (
    <div ref={wrapRef} className="space-y-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((dest) => (
            <li
              key={dest.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pr-1 pl-2.5 text-sm"
            >
              {dest.id.startsWith("apt-") ? (
                <Plane className="size-3.5 text-accent" />
              ) : (
                <MapPin className="size-3.5 text-accent" />
              )}
              <span>
                {destinationLabel(dest, locale)}
                {dest.iata ? <span className="text-muted"> · {dest.iata}</span> : null}
                {(() => {
                  const country =
                    DESTINATIONS.find((c) => c.id === dest.id)?.countryNames[
                      locale === "zh-Hant" ? "zhHant" : locale === "zh-Hans" ? "zhHans" : locale === "ja" ? "ja" : "en"
                    ] ?? countryLabel(dest.country, loc);
                  const label = destinationLabel(dest, locale);
                  if (!country || country === label || country === dest.name) return null;
                  return <span className="text-muted"> · {country}</span>;
                })()}
              </span>
              <button
                type="button"
                className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
                aria-label={t("newTrip.removeDest")}
                onClick={() => onChange(value.filter((d) => d.id !== dest.id))}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <Input
          value={query}
          placeholder={value.length ? t("newTrip.addDestPh") : t("newTrip.destSearchPh")}
          className="h-11 sm:h-10"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (hits[active]) addHit(hits[active]);
              else addCustom();
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Backspace" && !query && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!wrapRef.current?.contains(document.activeElement)) setOpen(false);
            }, 120);
          }}
        />
        {open ? (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lift">
            <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">{heading}</p>
            <ul role="listbox" className="max-h-80 overflow-y-auto p-1">
              {hits.map((hit, index) => {
                const prev = hits[index - 1];
                const showHeader = !prev || prev.kind !== hit.kind;
                const header = showHeader ? (
                  <li key={`${hit.kind}-head`} className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-faint uppercase">
                    {hit.kind === "city" ? t("newTrip.destCities") : t("newTrip.destAirports")}
                  </li>
                ) : null;
                if (hit.kind === "city") {
                  const city = DESTINATIONS.find((c) => c.id === hit.cityId);
                  if (!city) return null;
                  const nearby = nearbyIds.includes(city.id);
                  const name =
                    city.names[locale === "zh-Hant" ? "zhHant" : locale === "zh-Hans" ? "zhHans" : locale === "ja" ? "ja" : "en"];
                  const country =
                    city.countryNames[locale === "zh-Hant" ? "zhHant" : locale === "zh-Hans" ? "zhHans" : locale === "ja" ? "ja" : "en"];
                  return (
                    <Fragment key={hit.id}>
                      {header}
                      <li>
                        <button
                          type="button"
                          role="option"
                          aria-selected={index === active}
                          className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left ${
                            index === active ? "bg-accent-soft" : "hover:bg-surface-2"
                          }`}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addCity(toTripDestination(city))}
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                            <MapPin className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{name}</span>
                            <span className="block truncate text-xs text-muted">
                              {country}
                              {city.iata ? ` · ${city.iata}` : ""}
                              {nearby ? ` · ${t("newTrip.nearSelected")}` : ""}
                            </span>
                          </span>
                          <Plus className="size-4 text-faint" />
                        </button>
                      </li>
                    </Fragment>
                  );
                }
                const airport = airports.find((a) => a.iata === hit.iata);
                if (!airport) return null;
                return (
                  <Fragment key={hit.id}>
                    {header}
                    <li>
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === active}
                        className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left ${
                          index === active ? "bg-accent-soft" : "hover:bg-surface-2"
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addCity(airportToDestination(airport))}
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">
                          <Plane className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {airport.iata} · {airport.name}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {airportLine(airport, loc)} · {t("newTrip.destAirport")}
                          </span>
                        </span>
                        <Plus className="size-4 text-faint" />
                      </button>
                    </li>
                  </Fragment>
                );
              })}
              {loading && !airports.length ? (
                <li className="px-3 py-3 text-sm text-muted">{t("newTrip.loadingAirports")}</li>
              ) : null}
              {loadError ? (
                <li className="px-3 py-3 text-sm">
                  <p className="text-muted">{t("newTrip.airportsFailed")}</p>
                  <Button type="button" size="sm" variant="secondary" className="mt-2 min-h-9" onClick={refreshAirports}>
                    {t("newTrip.retryAirports")}
                  </Button>
                </li>
              ) : null}
              {query.trim() && !hits.some((h) => h.kind === "city" && DESTINATIONS.find((c) => c.id === h.cityId)?.name.toLowerCase() === query.trim().toLowerCase()) ? (
                <li>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-2.5 py-2.5 text-left hover:bg-surface-2"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={addCustom}
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2 text-muted">
                      <Plus className="size-4" />
                    </span>
                    <span className="text-sm">{t("newTrip.addAnyway", { name: query.trim() })}</span>
                  </button>
                </li>
              ) : null}
              {!hits.length && !query.trim() && !loading ? (
                <li className="px-3 py-3 text-sm text-muted">{t("newTrip.noDestMatch")}</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        {t("newTrip.multiDestHint")}{" "}
        {airports.length
          ? t("newTrip.worldAirportsHint", { n: airports.length.toLocaleString(loc) })
          : t("newTrip.loadingAirports")}
      </p>
      {(() => {
        const chips = value.length
          ? searchDestinations("", value.map((d) => d.id)).filter((c) => nearbyIds.includes(c.id)).slice(0, 6)
          : searchDestinations("", []).slice(0, 6);
        if (!chips.length) return null;
        return (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((city) => (
              <Button
                key={city.id}
                type="button"
                size="sm"
                variant="secondary"
                className="min-h-9 rounded-full"
                onClick={() => addCity(toTripDestination(city))}
              >
                {city.names[locale === "zh-Hant" ? "zhHant" : locale === "zh-Hans" ? "zhHans" : locale === "ja" ? "ja" : "en"]}
              </Button>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
