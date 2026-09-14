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

export function zoneRegion(tz: string) {
  if (!tz.includes("/")) return "Other";
  return tz.split("/")[0]?.replace(/_/g, " ") ?? "Other";
}

export function searchTimeZones(query: string, limit = 80): string[] {
  const zones = listTimeZones();
  const q = query.trim().toLowerCase().replace(/\s+/g, "_");
  const qSpace = q.replace(/_/g, " ");
  const preferred = FALLBACK_ZONES.filter((z) => zones.includes(z));
  const preferredSet = new Set(preferred);
  const rest = zones.filter((z) => !preferredSet.has(z));
  const ordered = [...preferred, ...rest];
  if (!q) return ordered.slice(0, limit);

  const wantsOffset = q.startsWith("gmt") || q.startsWith("utc") || q.startsWith("+") || q.startsWith("-");
  return ordered
    .filter((z) => {
      const lower = z.toLowerCase();
      const city = zoneCity(z).toLowerCase();
      if (lower.includes(q) || lower.replace(/_/g, " ").includes(qSpace) || city.includes(qSpace)) return true;
      if (wantsOffset) {
        const off = zoneOffset(z, "en").toLowerCase().replace(/\s+/g, "");
        return off.includes(q.replace(/_/g, "")) || off.replace("gmt", "").includes(q.replace(/_/g, ""));
      }
      return false;
    })
    .slice(0, limit);
}
