import { findCity } from "@/data/destinations";
import type { Locale } from "@/i18n";
import type { Trip, TripDestination } from "@/types/trip";

function localeKey(locale: Locale): "en" | "zhHant" | "zhHans" | "ja" {
  if (locale === "zh-Hant") return "zhHant";
  if (locale === "zh-Hans") return "zhHans";
  if (locale === "ja") return "ja";
  return "en";
}

export function destinationLabel(dest: TripDestination, locale: Locale): string {
  const city = findCity(dest.id) || findCity(dest.name);
  if (city) {
    const name = city.names[localeKey(locale)];
    if (dest.iata && dest.iata !== city.iata) return `${name} (${dest.iata})`;
    return name;
  }
  return dest.iata ? `${dest.name} (${dest.iata})` : dest.name;
}

export function tripDestinationLabel(trip: Pick<Trip, "destination" | "destinations">, locale: Locale): string {
  const list = trip.destinations?.length ? trip.destinations : [];
  if (list.length) return list.map((d) => destinationLabel(d, locale)).join(" · ");
  return trip.destination;
}

export function listLabel(names: { en: string; zhHant: string; zhHans: string; ja: string }, locale: Locale): string {
  return names[localeKey(locale)];
}
