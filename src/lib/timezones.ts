const FALLBACK_ZONES = [
  "UTC",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Ho_Chi_Minh",
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Zurich",
  "Europe/Istanbul",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "Pacific/Honolulu",
];

export function listTimeZones(): string[] {
  try {
    const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
    if (typeof intl.supportedValuesOf === "function") {
      return intl.supportedValuesOf("timeZone");
    }
  } catch {
    /* ignore */
  }
  return FALLBACK_ZONES;
}

export function zoneOffset(tz: string, locale = "en"): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function zoneCity(tz: string) {
  const city = tz.split("/").pop() ?? tz;
  return city.replace(/_/g, " ");
}

export function searchTimeZones(query: string, limit = 12): string[] {
  const zones = listTimeZones();
  const q = query.trim().toLowerCase().replace(/\s+/g, "_");
  if (!q) {
    const preferred = new Set(FALLBACK_ZONES);
    return [...FALLBACK_ZONES, ...zones.filter((z) => !preferred.has(z))].slice(0, limit);
  }
  return zones
    .filter((z) => z.toLowerCase().includes(q) || z.replace(/_/g, " ").toLowerCase().includes(q.replace(/_/g, " ")))
    .slice(0, limit);
}
