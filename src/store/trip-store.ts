import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createSeedBackup, SEED_ALTERNATES, SEED_BOOKINGS, SEED_ITEMS, SEED_PLACES, SEED_TRIP } from "@/data/seed";
import { tripDates } from "@/lib/datetime";
import { recomputeDayItems } from "@/lib/planning";
import { importExportService } from "@/services/import-export";
import { uid } from "@/lib/utils";
import type {
  AlternatePlan,
  AppBackup,
  Booking,
  ItineraryItem,
  Place,
  Trip,
} from "@/types/trip";

type TripState = {
  places: Place[];
  trips: Trip[];
  items: ItineraryItem[];
  bookings: Booking[];
  alternatePlans: AlternatePlan[];
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  loadSeed: () => void;
  replaceAll: (data: AppBackup) => void;
  upsertPlace: (place: Place, tripId?: string) => void;
  updatePlace: (id: string, patch: Partial<Place>) => void;
  deletePlace: (id: string) => void;
  importPlaces: (places: Place[], tripId?: string) => void;
  createTrip: (trip: Trip) => void;
  updateTrip: (id: string, patch: Partial<Trip>) => void;
  deleteTrip: (id: string) => void;
  assignPlacesToDate: (tripId: string, placeIds: string[], date: string) => Promise<void>;
  unassignItem: (itemId: string) => Promise<void>;
  moveItem: (itemId: string, date: string, index: number) => Promise<void>;
  reorderDay: (tripId: string, date: string, orderedIds: string[]) => Promise<void>;
  updateItem: (id: string, patch: Partial<ItineraryItem>) => Promise<void>;
  recomputeTripDay: (tripId: string, date: string) => Promise<void>;
  upsertBooking: (booking: Booking) => void;
  deleteBooking: (id: string) => void;
  exportBackup: () => string;
};

function placesById(places: Place[]) {
  return new Map(places.map((p) => [p.id, p]));
}

async function recomputeDates(
  state: Pick<TripState, "trips" | "places" | "items">,
  tripId: string,
  dates: string[],
): Promise<ItineraryItem[]> {
  const trip = state.trips.find((t) => t.id === tripId);
  if (!trip) return state.items;
  const map = placesById(state.places);
  let items = state.items;
  for (const date of dates) {
    const day = items.filter((i) => i.tripId === tripId && i.date === date);
    const rest = items.filter((i) => !(i.tripId === tripId && i.date === date));
    const next = await recomputeDayItems(trip, date, day, map, trip.preferredTransport);
    items = [...rest, ...next];
  }
  return items;
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      places: SEED_PLACES,
      trips: [SEED_TRIP],
      items: SEED_ITEMS,
      bookings: SEED_BOOKINGS,
      alternatePlans: SEED_ALTERNATES,
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      loadSeed: () => {
        const seed = createSeedBackup();
        set({
          places: seed.places,
          trips: seed.trips,
          items: seed.items,
          bookings: seed.bookings,
          alternatePlans: seed.alternatePlans,
        });
        const trip = seed.trips[0];
        if (trip) {
          void (async () => {
            const items = await recomputeDates(
              { ...get(), ...seed },
              trip.id,
              tripDates(trip.startDate, trip.endDate),
            );
            set({ items });
          })();
        }
      },
      replaceAll: (data) =>
        set({
          places: data.places,
          trips: data.trips,
          items: data.items,
          bookings: data.bookings,
          alternatePlans: data.alternatePlans,
        }),
      upsertPlace: (place, tripId) =>
        set((s) => ({
          places: s.places.some((p) => p.id === place.id)
            ? s.places.map((p) => (p.id === place.id ? place : p))
            : [...s.places, place],
          trips: tripId
            ? s.trips.map((t) =>
                t.id === tripId && !t.placeIds.includes(place.id)
                  ? { ...t, placeIds: [...t.placeIds, place.id] }
                  : t,
              )
            : s.trips,
        })),
      updatePlace: (id, patch) =>
        set((s) => ({
          places: s.places.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),
      deletePlace: (id) =>
        set((s) => ({
          places: s.places.filter((p) => p.id !== id),
          items: s.items.filter((i) => i.placeId !== id),
          trips: s.trips.map((t) => ({ ...t, placeIds: t.placeIds.filter((pid) => pid !== id) })),
        })),
      importPlaces: (places, tripId) =>
        set((s) => ({
          places: [...s.places, ...places],
          trips: tripId
            ? s.trips.map((t) =>
                t.id === tripId
                  ? { ...t, placeIds: [...new Set([...t.placeIds, ...places.map((p) => p.id)])] }
                  : t,
              )
            : s.trips,
        })),
      createTrip: (trip) => set((s) => ({ trips: [trip, ...s.trips] })),
      updateTrip: (id, patch) =>
        set((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTrip: (id) =>
        set((s) => ({
          trips: s.trips.filter((t) => t.id !== id),
          items: s.items.filter((i) => i.tripId !== id),
          bookings: s.bookings.filter((b) => b.tripId !== id),
          alternatePlans: s.alternatePlans.filter((p) => p.tripId !== id),
        })),
      assignPlacesToDate: async (tripId, placeIds, date) => {
        const s = get();
        const existing = new Set(
          s.items.filter((i) => i.tripId === tripId && i.date === date).map((i) => i.placeId),
        );
        const startOrder = s.items.filter((i) => i.tripId === tripId && i.date === date).length;
        const trip = s.trips.find((t) => t.id === tripId);
        const created: ItineraryItem[] = [];
        let order = startOrder;
        for (const placeId of placeIds) {
          if (existing.has(placeId)) continue;
          const place = s.places.find((p) => p.id === placeId);
          created.push({
            id: uid("item"),
            tripId,
            placeId,
            date,
            order: order++,
            startTime: "09:00",
            endTime: "10:00",
            durationMin: place?.estimatedDurationMin ?? 60,
            notes: "",
            priority: place?.priority ?? "want",
            locked: false,
            progressStatus: "pending",
          });
        }
        const items = [
          ...s.items.filter((i) => !(placeIds.includes(i.placeId) && i.tripId === tripId)),
          ...created,
        ];
        const trips = trip
          ? s.trips.map((t) =>
              t.id === tripId
                ? { ...t, placeIds: [...new Set([...t.placeIds, ...placeIds])] }
                : t,
            )
          : s.trips;
        const places = s.places.map((p) =>
          placeIds.includes(p.id) && p.status === "saved" ? { ...p, status: "planned" as const } : p,
        );
        const next = await recomputeDates({ trips, places, items }, tripId, [date]);
        set({ items: next, trips, places });
      },
      unassignItem: async (itemId) => {
        const s = get();
        const target = s.items.find((i) => i.id === itemId);
        if (!target) return;
        const items = s.items.filter((i) => i.id !== itemId);
        const still = items.some((i) => i.placeId === target.placeId);
        const places = s.places.map((p) =>
          p.id === target.placeId && !still ? { ...p, status: "saved" as const } : p,
        );
        const next = await recomputeDates({ ...s, items, places }, target.tripId, [target.date]);
        set({ items: next, places });
      },
      moveItem: async (itemId, date, index) => {
        const s = get();
        const target = s.items.find((i) => i.id === itemId);
        if (!target) return;
        const from = target.date;
        let day = s.items
          .filter((i) => i.tripId === target.tripId && i.date === date && i.id !== itemId)
          .sort((a, b) => a.order - b.order);
        const moved = { ...target, date };
        day.splice(Math.min(index, day.length), 0, moved);
        day = day.map((it, i) => ({ ...it, order: i, date }));
        const rest = s.items.filter(
          (i) => i.id !== itemId && !(i.tripId === target.tripId && i.date === date),
        );
        const items = [...rest, ...day];
        const dates = from === date ? [date] : [from, date];
        const next = await recomputeDates({ ...s, items }, target.tripId, dates);
        set({ items: next });
      },
      reorderDay: async (tripId, date, orderedIds) => {
        const s = get();
        const rest = s.items.filter((i) => !(i.tripId === tripId && i.date === date));
        const day = orderedIds
          .map((id, order) => {
            const it = s.items.find((i) => i.id === id);
            return it ? { ...it, order, date } : null;
          })
          .filter((x): x is ItineraryItem => Boolean(x));
        const items = [...rest, ...day];
        const next = await recomputeDates({ ...s, items }, tripId, [date]);
        set({ items: next });
      },
      updateItem: async (id, patch) => {
        const s = get();
        const target = s.items.find((i) => i.id === id);
        if (!target) return;
        const items = s.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
        if (patch.progressStatus && (patch.progressStatus === "done" || patch.progressStatus === "skipped")) {
          const places = s.places.map((p) =>
            p.id === target.placeId
              ? { ...p, status: patch.progressStatus === "done" ? ("done" as const) : ("skipped" as const) }
              : p,
          );
          set({ items, places });
          return;
        }
        const next = await recomputeDates({ ...s, items }, target.tripId, [target.date]);
        set({ items: next });
      },
      recomputeTripDay: async (tripId, date) => {
        const s = get();
        const next = await recomputeDates(s, tripId, [date]);
        set({ items: next });
      },
      upsertBooking: (booking) =>
        set((s) => ({
          bookings: s.bookings.some((b) => b.id === booking.id)
            ? s.bookings.map((b) => (b.id === booking.id ? booking : b))
            : [...s.bookings, booking],
        })),
      deleteBooking: (id) => set((s) => ({ bookings: s.bookings.filter((b) => b.id !== id) })),
      exportBackup: () => {
        const s = get();
        return importExportService.exportBackup({
          version: 1,
          exportedAt: new Date().toISOString(),
          places: s.places,
          trips: s.trips,
          items: s.items,
          bookings: s.bookings,
          alternatePlans: s.alternatePlans,
        });
      },
    }),
    {
      name: "trip-canvas-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        places: s.places,
        trips: s.trips,
        items: s.items,
        bookings: s.bookings,
        alternatePlans: s.alternatePlans,
      }),
    },
  ),
);
