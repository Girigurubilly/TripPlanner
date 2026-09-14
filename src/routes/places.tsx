import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { PlacesHub } from "@/components/places/places-hub";

export const Route = createFileRoute("/places")({ component: PlacesPage });

function PlacesPage() {
  return (
    <AppShell>
      <PlacesHub />
    </AppShell>
  );
}
