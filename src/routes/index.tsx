import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { TripsDashboard } from "@/components/trips/trips-dashboard";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <AppShell>
      <TripsDashboard />
    </AppShell>
  );
}
