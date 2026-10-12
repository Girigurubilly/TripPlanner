import { createFileRoute } from "@tanstack/react-router";
import { TripApp } from "@/components/trip-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <TripApp />;
}
