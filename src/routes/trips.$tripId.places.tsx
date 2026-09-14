import { createFileRoute } from "@tanstack/react-router";
import { PlacesHub } from "@/components/places/places-hub";

export const Route = createFileRoute("/trips/$tripId/places")({ component: TripPlacesPage });

function TripPlacesPage() {
  const { tripId } = Route.useParams();
  return <PlacesHub tripId={tripId} />;
}
