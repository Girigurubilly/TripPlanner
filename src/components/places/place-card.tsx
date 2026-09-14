import { Clock, Lock, MapPin } from "lucide-react";
import { CategoryChip, PriorityChip } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { PlacePhoto } from "@/components/places/place-photo";
import { cn } from "@/lib/utils";
import { formatDurationI18n } from "@/i18n/format";
import { useI18n } from "@/i18n";
import type { Place } from "@/types/trip";

export function PlaceCard({
  place,
  selected,
  onToggle,
  assigned,
  compact,
}: {
  place: Place;
  selected?: boolean;
  onToggle?: (id: string) => void;
  assigned?: boolean;
  compact?: boolean;
}) {
  const { t } = useI18n();
  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border bg-surface transition-[border-color,transform,box-shadow] duration-150",
        selected ? "border-accent shadow-soft" : "border-line",
        onToggle && "active:scale-[0.99]",
      )}
    >
      {!compact ? (
        <PlacePhoto
          name={place.name}
          neighbourhood={place.neighbourhood}
          photos={place.photos}
          category={place.category}
          className="h-36 w-full"
        />
      ) : null}
      <div className="flex items-start gap-2.5 p-3">
        {onToggle ? (
          <label className="grid min-h-11 min-w-11 place-items-start pt-0.5">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggle(place.id)}
              aria-label={place.name}
            />
          </label>
        ) : null}
        {compact ? (
          <PlacePhoto
            name={place.name}
            neighbourhood={place.neighbourhood}
            photos={place.photos}
            category={place.category}
            className="mt-0.5 size-12 shrink-0 rounded-md"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="truncate text-sm font-medium">{place.name}</h3>
            <CategoryChip category={place.category} />
            <PriorityChip priority={place.priority} />
          </div>
          {!compact ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <MapPin className="size-3" />
              <span className="truncate">
                {place.neighbourhood || place.address}
                {place.neighbourhood && place.address ? ` · ${place.address}` : ""}
              </span>
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {formatDurationI18n(place.estimatedDurationMin, t)}
            </span>
            <span>{t(`indoor.${place.indoorOutdoor}`)}</span>
            {place.reservationRequired === "yes" ? (
              <span className="inline-flex items-center gap-1 text-warn">
                <Lock className="size-3" />
                {t("places.reservation")}
              </span>
            ) : null}
            {assigned ? <span className="text-accent">{t("places.assigned")}</span> : <span>{t("places.unassigned")}</span>}
          </div>
          {place.notes && !compact ? (
            <p className="mt-2 line-clamp-2 text-xs text-ink-soft">{place.notes}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
