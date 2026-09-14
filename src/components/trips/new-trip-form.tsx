import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AirportSelect } from "@/components/trips/airport-select";
import { DestinationSearch } from "@/components/trips/destination-search";
import { TimeSelect } from "@/components/trips/time-select";
import { TimezoneSelect } from "@/components/trips/timezone-select";
import { joinDestinationNames } from "@/data/destinations";
import { placeProvider } from "@/services/place-provider";
import { useTripStore } from "@/store/trip-store";
import { uid } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { HotelStay, TransportMode, TravelPace, TripDestination } from "@/types/trip";

export function NewTripForm() {
  const createTrip = useTripStore((s) => s.createTrip);
  const navigate = useNavigate();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [destinations, setDestinations] = useState<TripDestination[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timezone, setTimezone] = useState("Asia/Tokyo");
  const [arrivalTime, setArrivalTime] = useState("14:00");
  const [departureTime, setDepartureTime] = useState("19:00");
  const [arrivalAirport, setArrivalAirport] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [pace, setPace] = useState<TravelPace>("moderate");
  const [preferredTransport, setPreferredTransport] = useState<TransportMode>("transit");
  const [notes, setNotes] = useState("");
  const [hotels, setHotels] = useState<HotelStay[]>([blankHotel()]);
  const [nameTouched, setNameTouched] = useState(false);

  function onDestinations(next: TripDestination[]) {
    setDestinations(next);
    const first = next[0];
    const last = next[next.length - 1];
    if (first?.timezone) setTimezone(first.timezone);
    if (first?.iata && !arrivalAirport) setArrivalAirport(first.iata);
    if (last?.iata) setDepartureAirport(last.iata);
    if (!nameTouched) setName(joinDestinationNames(next));
  }

  async function lookupHotel(index: number) {
    const hotel = hotels[index];
    const q = hotel.name || destinations[0]?.name || "";
    const hits = await placeProvider.search(q);
    const hit = hits[0];
    if (!hit) {
      toast.message(t("newTrip.noMatch"));
      return;
    }
    setHotels((list) =>
      list.map((h, i) =>
        i === index
          ? { ...h, name: hit.name, address: hit.address, lat: hit.lat, lng: hit.lng }
          : h,
      ),
    );
  }

  function save() {
    if (!name.trim() || !destinations.length || !startDate || !endDate) {
      toast.error(t("newTrip.required"));
      return;
    }
    const id = uid("trip");
    createTrip({
      id,
      name: name.trim(),
      destination: joinDestinationNames(destinations),
      destinations,
      startDate,
      endDate,
      timezone,
      arrivalTime,
      departureTime,
      arrivalAirport,
      departureAirport,
      pace,
      preferredTransport,
      hotels: hotels.filter((h) => h.name.trim()),
      placeIds: [],
      notes,
      createdAt: new Date().toISOString(),
    });
    toast.success(t("newTrip.created"));
    void navigate({ to: `/trips/${id}` });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <h1 className="font-display text-3xl">{t("newTrip.title")}</h1>
      <Card className="grid gap-3 p-4 md:p-6">
        <Field label={t("newTrip.name")}>
          <Input
            value={name}
            onChange={(e) => {
              setNameTouched(true);
              setName(e.target.value);
            }}
            placeholder={t("newTrip.namePh")}
            className="h-11 sm:h-10"
          />
        </Field>
        <div className="grid gap-1.5">
          <span className="text-xs font-medium text-muted">{t("newTrip.destinations")}</span>
          <DestinationSearch value={destinations} onChange={onDestinations} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("newTrip.start")}>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 sm:h-10" />
          </Field>
          <Field label={t("newTrip.end")}>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 sm:h-10" />
          </Field>
        </div>
        <Field label={t("newTrip.timezone")}>
          <TimezoneSelect value={timezone} onChange={setTimezone} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("newTrip.arrivalTime")}>
            <TimeSelect value={arrivalTime} onChange={setArrivalTime} />
          </Field>
          <Field label={t("newTrip.departureTime")}>
            <TimeSelect value={departureTime} onChange={setDepartureTime} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("newTrip.arrivalAirport")}>
            <AirportSelect
              value={arrivalAirport}
              onChange={setArrivalAirport}
              onAirport={(a) => {
                if (a.tz) setTimezone(a.tz);
              }}
            />
          </Field>
          <Field label={t("newTrip.departureAirport")}>
            <AirportSelect value={departureAirport} onChange={setDepartureAirport} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("newTrip.pace")}>
            <Select value={pace} onChange={(e) => setPace(e.target.value as TravelPace)} className="h-11 sm:h-10">
              <option value="relaxed">{t("pace.relaxed")}</option>
              <option value="moderate">{t("pace.moderate")}</option>
              <option value="packed">{t("pace.packed")}</option>
            </Select>
          </Field>
          <Field label={t("newTrip.transport")}>
            <Select value={preferredTransport} onChange={(e) => setPreferredTransport(e.target.value as TransportMode)} className="h-11 sm:h-10">
              <option value="walk">{t("transport.walk")}</option>
              <option value="transit">{t("transport.transit")}</option>
              <option value="taxi">{t("newTrip.taxiCar")}</option>
              <option value="cycle">{t("transport.cycle")}</option>
            </Select>
          </Field>
        </div>
        <Field label={t("newTrip.notes")}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </Card>

      <Card className="space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">{t("newTrip.hotels")}</h2>
          <Button size="sm" variant="secondary" className="min-h-11 sm:min-h-8" onClick={() => setHotels((h) => [...h, blankHotel(startDate, endDate)])}>
            {t("newTrip.addHotel")}
          </Button>
        </div>
        {hotels.map((hotel, index) => (
          <div key={hotel.id} className="grid gap-3 rounded-lg border border-line p-3">
            <Input
              placeholder={t("newTrip.hotelName")}
              value={hotel.name}
              className="h-11 sm:h-10"
              onChange={(e) => setHotels((list) => list.map((h, i) => (i === index ? { ...h, name: e.target.value } : h)))}
            />
            <Input
              placeholder={t("newTrip.address")}
              value={hotel.address}
              className="h-11 sm:h-10"
              onChange={(e) => setHotels((list) => list.map((h, i) => (i === index ? { ...h, address: e.target.value } : h)))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="date"
                value={hotel.checkInDate}
                className="h-11 sm:h-10"
                onChange={(e) => setHotels((list) => list.map((h, i) => (i === index ? { ...h, checkInDate: e.target.value } : h)))}
              />
              <Input
                type="date"
                value={hotel.checkOutDate}
                className="h-11 sm:h-10"
                onChange={(e) => setHotels((list) => list.map((h, i) => (i === index ? { ...h, checkOutDate: e.target.value } : h)))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("newTrip.checkInTime")}>
                <TimeSelect
                  value={hotel.checkInTime}
                  onChange={(time) => setHotels((list) => list.map((h, i) => (i === index ? { ...h, checkInTime: time } : h)))}
                />
              </Field>
              <Field label={t("newTrip.checkOutTime")}>
                <TimeSelect
                  value={hotel.checkOutTime}
                  onChange={(time) => setHotels((list) => list.map((h, i) => (i === index ? { ...h, checkOutTime: time } : h)))}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" className="min-h-11 sm:min-h-8" onClick={() => void lookupHotel(index)}>
                {t("newTrip.lookup")}
              </Button>
              {hotels.length > 1 ? (
                <Button type="button" size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => setHotels((list) => list.filter((_, i) => i !== index))}>
                  {t("newTrip.remove")}
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </Card>
      <Button className="min-h-12 w-full sm:w-auto" onClick={save}>{t("newTrip.create")}</Button>
    </div>
  );
}

function blankHotel(checkInDate = "", checkOutDate = ""): HotelStay {
  return {
    id: uid("hotel"),
    name: "",
    address: "",
    lat: 35.68,
    lng: 139.76,
    checkInDate,
    checkOutDate,
    checkInTime: "15:00",
    checkOutTime: "11:00",
    notes: "",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
