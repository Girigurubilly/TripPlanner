import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { useTripStore } from "@/store/trip-store";
import { useI18n } from "@/i18n";

export const Route = createFileRoute("/trips/$tripId")({ component: TripLayout });

function TripLayout() {
  const { tripId } = Route.useParams();
  const trip = useTripStore((s) => s.trips.find((t) => t.id === tripId));
  const { t } = useI18n();

  if (!trip) {
    return (
      <AppShell>
        <div className="p-8">
          <h1 className="font-display text-3xl">{t("tripMissing.title")}</h1>
          <p className="mt-2 text-sm text-muted">{t("tripMissing.body")}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell tripId={tripId}>
      <Outlet />
    </AppShell>
  );
}
