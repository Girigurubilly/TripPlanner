import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TimeSelect } from "@/components/trips/time-select";
import { joinDateTime, splitDateTime } from "@/lib/time-input";
import { useTripStore } from "@/store/trip-store";
import { uid } from "@/lib/utils";
import { useI18n, type MessageKey } from "@/i18n";
import type { Booking, BookingType } from "@/types/trip";

const BOOKING_TYPES: BookingType[] = [
  "flight",
  "hotel",
  "train",
  "ticket",
  "restaurant",
  "insurance",
  "esim",
  "transfer",
];

const EMPTY: Omit<Booking, "id"> = {
  tripId: "",
  type: "ticket",
  title: "",
  confirmationNumber: "",
  startAt: "",
  endAt: "",
  cancellationDeadline: "",
  notes: "",
  imageDataUrl: "",
  pdfUrl: "",
  status: "confirmed",
};

export function BookingsPanel({ tripId }: { tripId: string }) {
  const allBookings = useTripStore((s) => s.bookings);
  const allItems = useTripStore((s) => s.items);
  const bookings = allBookings.filter((b) => b.tripId === tripId);
  const items = allItems.filter((i) => i.tripId === tripId);
  const places = useTripStore((s) => s.places);
  const upsertBooking = useTripStore((s) => s.upsertBooking);
  const deleteBooking = useTripStore((s) => s.deleteBooking);
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Booking, "id"> & { id?: string }>({ ...EMPTY, tripId });

  function edit(b?: Booking) {
    setForm(b ? { ...b } : { ...EMPTY, tripId });
    setOpen(true);
  }

  async function onImage(file: File) {
    if (file.size > 450_000) {
      toast.error(t("bookings.imageTooBig"));
      return;
    }
    const data = await fileToDataUrl(file);
    setForm((f) => ({ ...f, imageDataUrl: data }));
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-3xl">{t("bookings.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("bookings.subtitle")}</p>
        </div>
        <Button size="sm" className="min-h-11 shrink-0 sm:min-h-8" onClick={() => edit()}>
          <Plus />
          {t("bookings.add")}
        </Button>
      </div>
      <div className="tc-stagger grid gap-3 md:grid-cols-2">
        {bookings.map((b) => {
          const item = items.find((i) => i.id === b.itineraryItemId);
          const place = places.find((p) => p.id === (b.placeId || item?.placeId));
          return (
            <Card key={b.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{t(`bookingType.${b.type}`)}</Badge>
                    <Badge tone={b.status === "confirmed" ? "ok" : b.status === "cancelled" ? "danger" : "warn"}>
                      {t(`bookingStatus.${b.status}` as MessageKey)}
                    </Badge>
                  </div>
                  <h2 className="mt-2 font-medium">{b.title}</h2>
                  {b.confirmationNumber ? (
                    <p className="mt-1 font-mono text-xs text-muted">{b.confirmationNumber}</p>
                  ) : null}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="min-h-11 sm:min-h-8" onClick={() => edit(b)}>
                    {t("common.edit")}
                  </Button>
                  <Button size="icon" variant="ghost" className="min-h-11 min-w-11 sm:size-8" onClick={() => deleteBooking(b.id)} aria-label={t("common.delete")}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                {b.startAt ? (
                  <div>
                    <dt>{t("bookings.start")}</dt>
                    <dd className="text-ink">{b.startAt.replace("T", " ").slice(0, 16)}</dd>
                  </div>
                ) : null}
                {b.cancellationDeadline ? (
                  <div>
                    <dt>{t("bookings.cancelBy")}</dt>
                    <dd className="text-ink">{b.cancellationDeadline}</dd>
                  </div>
                ) : null}
                {place ? (
                  <div className="col-span-2">
                    <dt>{t("bookings.linked")}</dt>
                    <dd className="text-ink">{place.name}</dd>
                  </div>
                ) : null}
              </dl>
              {b.notes ? <p className="mt-2 text-sm text-ink-soft">{b.notes}</p> : null}
              {b.pdfUrl ? (
                <a className="mt-2 inline-block text-xs text-accent underline" href={b.pdfUrl} target="_blank" rel="noreferrer">
                  {t("bookings.pdf")}
                </a>
              ) : null}
              {b.imageDataUrl ? (
                <img src={b.imageDataUrl} alt="" className="mt-3 max-h-32 rounded-md border border-line object-cover" />
              ) : null}
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? t("bookings.edit") : t("bookings.add")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Select
              value={form.type}
              className="h-11 sm:h-10"
              onChange={(e) => setForm({ ...form, type: e.target.value as BookingType })}
            >
              {BOOKING_TYPES.map((k) => (
                <option key={k} value={k}>
                  {t(`bookingType.${k}`)}
                </option>
              ))}
            </Select>
            <Input
              placeholder={t("bookings.titlePlaceholder")}
              value={form.title}
              className="h-11 sm:h-10"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input
              placeholder={t("bookings.confirmation")}
              value={form.confirmationNumber}
              className="h-11 sm:h-10"
              onChange={(e) => setForm({ ...form, confirmationNumber: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DateTimeFields
                dateLabel={t("bookings.start")}
                value={form.startAt}
                onChange={(next) => setForm({ ...form, startAt: next })}
              />
              <DateTimeFields
                dateLabel={t("bookings.end")}
                value={form.endAt}
                onChange={(next) => setForm({ ...form, endAt: next })}
              />
            </div>
            <Input
              placeholder={t("bookings.deadline")}
              value={form.cancellationDeadline}
              className="h-11 sm:h-10"
              onChange={(e) => setForm({ ...form, cancellationDeadline: e.target.value })}
            />
            <Input
              placeholder={t("bookings.pdfUrl")}
              value={form.pdfUrl}
              className="h-11 sm:h-10"
              onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })}
            />
            <Select
              value={form.itineraryItemId ?? ""}
              className="h-11 sm:h-10"
              onChange={(e) => setForm({ ...form, itineraryItemId: e.target.value || undefined })}
            >
              <option value="">{t("bookings.noLink")}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.date} · {places.find((p) => p.id === i.placeId)?.name}
                </option>
              ))}
            </Select>
            <Textarea
              placeholder={t("common.notes")}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void onImage(e.target.files[0])} />
            <Button
              className="min-h-11"
              onClick={() => {
                if (!form.title.trim()) return toast.error(t("bookings.titleRequired"));
                upsertBooking({
                  ...form,
                  id: form.id ?? uid("book"),
                  tripId,
                });
                setOpen(false);
                toast.success(t("bookings.saved"));
              }}
            >
              {t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function DateTimeFields({
  dateLabel,
  value,
  onChange,
}: {
  dateLabel: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const parts = splitDateTime(value);
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted">{dateLabel}</span>
      <Input
        type="date"
        value={parts.date}
        className="h-11 sm:h-10"
        onChange={(e) => onChange(joinDateTime(e.target.value, parts.time))}
      />
      <TimeSelect value={parts.time} onChange={(time) => onChange(joinDateTime(parts.date, time))} />
    </label>
  );
}

