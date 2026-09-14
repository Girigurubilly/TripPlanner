import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TripMap } from "@/components/map/trip-map";
import { buildInsights } from "@/lib/insights";
import { useTripStore } from "@/store/trip-store";
import { formatDayHeading } from "@/i18n/format";
import { useI18n, type MessageKey, type Translate } from "@/i18n";

export function InsightsPanel({ tripId }: { tripId: string }) {
  const trip = useTripStore((s) => s.trips.find((x) => x.id === tripId));
  const places = useTripStore((s) => s.places);
  const allItems = useTripStore((s) => s.items);
  const { t, locale } = useI18n();
  const items = allItems.filter((i) => i.tripId === tripId);
  if (!trip) return null;
  const { insights, conflicts } = buildInsights(trip, places, items);
  const byId = new Map(places.map((p) => [p.id, p]));
  const cluster = insights.find((i) => i.id.startsWith("cluster-"));
  const clusterStops =
    cluster?.placeIds
      ?.map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, name: p.name, kind: "place" as const })) ?? [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="tc-enter">
        <h1 className="font-display text-3xl">{t("insights.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("insights.subtitle")}</p>
      </div>
      <div className="tc-stagger grid gap-3 lg:grid-cols-2">
        {insights.map((ins) => (
          <Card key={ins.id} className="p-4">
            <Badge tone={ins.tone === "warn" ? "warn" : ins.tone === "ok" ? "ok" : "accent"}>
              {t(ins.tone === "warn" ? "insights.toneWarn" : ins.tone === "ok" ? "insights.toneOk" : "insights.toneInfo")}
            </Badge>
            <h2 className="mt-2 font-medium">{t(ins.titleKey, localizeDates(ins.params, locale))}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t(ins.detailKey, localizeDates(ins.params, locale))}</p>
            {ins.date ? (
              <Button asChild size="sm" variant="ghost" className="mt-2 min-h-11 px-0 sm:min-h-8">
                <Link to="/trips/$tripId/plan" params={{ tripId: trip.id }}>
                  {t("insights.review", { date: formatDayHeading(ins.date, locale) })}
                </Link>
              </Button>
            ) : null}
          </Card>
        ))}
      </div>
      {clusterStops.length ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line px-4 py-3">
            <h2 className="font-display text-xl">{t("insights.clusterMap")}</h2>
            <p className="text-sm text-muted">{cluster ? t(cluster.titleKey, localizeDates(cluster.params, locale)) : null}</p>
          </div>
          <div className="h-80">
            <TripMap className="h-full" hotel={trip.hotels[0]} stops={clusterStops} />
          </div>
        </Card>
      ) : null}
      <Card className="p-4">
        <h2 className="font-display text-xl">{t("insights.openFlags")}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {conflicts.map((c) => (
            <li key={c.id} className={c.severity === "error" ? "text-danger" : "text-warn"}>
              {formatDayHeading(c.date, locale)} · {formatConflict(c, t)}
            </li>
          ))}
          {!conflicts.length ? <li className="text-muted">{t("insights.noFlags")}</li> : null}
        </ul>
      </Card>
    </div>
  );
}

function localizeDates(params: Record<string, string | number>, locale: Parameters<typeof formatDayHeading>[1]) {
  const next = { ...params };
  if (typeof next.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(next.date)) {
    next.date = formatDayHeading(next.date, locale);
  }
  return next;
}

function formatConflict(
  c: { messageKey: MessageKey; params: Record<string, string | number> },
  t: Translate,
) {
  const params = { ...c.params };
  if (!params.name) params.name = t("conflict.previousStop");
  if (params.airport === "") params.airport = t("conflict.theAirport");
  if (typeof params.mode === "string") params.mode = t(`transport.${params.mode}` as MessageKey);
  return t(c.messageKey, params);
}
