import { createFileRoute } from "@tanstack/react-router";
import { DailyMap } from "@/components/map/daily-map";

export const Route = createFileRoute("/trips/$tripId/map")({ component: MapPage });

function MapPage() {
  const { tripId } = Route.useParams();
  return <DailyMap tripId={tripId} />;
}
