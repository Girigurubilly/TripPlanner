import { createFileRoute } from "@tanstack/react-router";
import { BookingsPanel } from "@/components/bookings/bookings-panel";

export const Route = createFileRoute("/trips/$tripId/bookings")({ component: BookingsPage });

function BookingsPage() {
  const { tripId } = Route.useParams();
  return <BookingsPanel tripId={tripId} />;
}
