import { createFileRoute } from "@tanstack/react-router";
import { InsightsPanel } from "@/components/insights/insights-panel";

export const Route = createFileRoute("/trips/$tripId/insights")({ component: InsightsPage });

function InsightsPage() {
  const { tripId } = Route.useParams();
  return <InsightsPanel tripId={tripId} />;
}
