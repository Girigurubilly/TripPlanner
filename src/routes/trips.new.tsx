import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { NewTripForm } from "@/components/trips/new-trip-form";

export const Route = createFileRoute("/trips/new")({ component: NewTripPage });

function NewTripPage() {
  return (
    <AppShell>
      <NewTripForm />
    </AppShell>
  );
}
