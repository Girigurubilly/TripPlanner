import { createFileRoute } from "@tanstack/react-router";
import { TripOverview } from "@/components/overview/trip-overview";

export const Route = createFileRoute("/trips/$tripId/")({ component: OverviewPage });

function OverviewPage() {
  const { tripId } = Route.useParams();
  return <TripOverview tripId={tripId} />;
}
