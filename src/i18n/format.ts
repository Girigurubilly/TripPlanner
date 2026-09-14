import { parseISO } from "date-fns";
import { intlLocale, type Locale, type Translate } from "@/i18n";

export function formatDayHeading(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(parseISO(isoDate));
}

export function formatDayLong(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseISO(isoDate));
}

export function formatDurationI18n(min: number, t: Translate): string {
  const n = Math.max(0, Math.round(min));
  if (n < 60) return t("time.min", { n });
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? t("time.hm", { h, m }) : t("time.h", { h });
}

export function formatDistanceI18n(meters: number, t: Translate): string {
  if (meters < 1000) return t("time.meters", { n: Math.round(meters) });
  const km = meters / 1000;
  const n = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10;
  return t("time.km", { n });
}
