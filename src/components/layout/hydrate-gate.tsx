import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { photosForCatalog } from "@/data/place-photos";
import { tripDates } from "@/lib/datetime";
import { uid } from "@/lib/utils";
import { useTripStore } from "@/store/trip-store";

export function HydrateGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = params.get("path");
    if (path && path.startsWith("/")) {
      params.delete("path");
      const rest = params.toString();
      const clean = path.split("?")[0] + (rest ? `?${rest}` : "");
      void router.history.replace(clean);
    }

    const finish = () => {
      const state = useTripStore.getState();
      if (state.trips.length === 0) {
        state.loadSeed();
      } else {
        const trips = state.trips.map((trip) => {
          if (trip.destinations?.length) return trip;
          return {
            ...trip,
            destinations: trip.destination
              ? [
                  {
                    id: uid("dest"),
                    name: trip.destination,
                    country: "",
                    timezone: trip.timezone,
                    lat: trip.hotels[0]?.lat ?? 35.68,
                    lng: trip.hotels[0]?.lng ?? 139.76,
                    iata: trip.arrivalAirport,
                  },
                ]
              : [],
          };
        });
        const places = state.places.map((p) => {
          const baked = photosForCatalog(p.name);
          const stale = p.photos?.[0]?.includes("Special:FilePath") || p.photos?.[0]?.includes("upload.wikimedia.org");
          if (baked.length && (!p.photos?.length || stale)) return { ...p, photos: baked };
          return p;
        });
        useTripStore.setState({ trips, places });
        for (const trip of trips) {
          for (const date of tripDates(trip.startDate, trip.endDate)) {
            void state.recomputeTripDay(trip.id, date);
          }
        }
      }
      state.setHydrated(true);
    };

    if (useTripStore.persist.hasHydrated()) {
      finish();
      return;
    }
    const unsub = useTripStore.persist.onFinishHydration(finish);
    void useTripStore.persist.rehydrate();
    return () => unsub();
  }, [router]);

  return children;
}
