import { createFileRoute } from "@tanstack/react-router";
import { PlanWorkspace } from "@/components/plan/plan-workspace";

export const Route = createFileRoute("/trips/$tripId/plan")({ component: PlanPage });

function PlanPage() {
  const { tripId } = Route.useParams();
  return <PlanWorkspace tripId={tripId} />;
}
