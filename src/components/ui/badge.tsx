import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { DayLoad, PlaceCategory, Priority } from "@/types/trip";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-wide",
  {
    variants: {
      tone: {
        neutral: "bg-surface-2 text-ink-soft",
        accent: "bg-accent-soft text-accent",
        warn: "bg-warn-soft text-warn",
        danger: "bg-danger-soft text-danger",
        ok: "bg-ok-soft text-ok",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const CAT_CLASS: Record<PlaceCategory, string> = {
  attraction: "bg-cat-attraction-bg text-cat-attraction",
  restaurant: "bg-cat-restaurant-bg text-cat-restaurant",
  cafe: "bg-cat-cafe-bg text-cat-cafe",
  hotel: "bg-cat-hotel-bg text-cat-hotel",
  photo: "bg-cat-photo-bg text-cat-photo",
  shopping: "bg-cat-shopping-bg text-cat-shopping",
  nature: "bg-cat-nature-bg text-cat-nature",
  nightlife: "bg-cat-nightlife-bg text-cat-nightlife",
  transport: "bg-cat-transport-bg text-cat-transport",
  other: "bg-cat-other-bg text-cat-other",
};

export function CategoryChip({ category }: { category: PlaceCategory }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", CAT_CLASS[category])}>
      {t(`category.${category}`)}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: Priority }) {
  const { t } = useI18n();
  const tone = priority === "must-do" ? "accent" : priority === "skip" ? "neutral" : priority === "if-time" ? "warn" : "ok";
  return <Badge tone={tone}>{t(`priority.${priority}`)}</Badge>;
}

export function LoadChip({ load }: { load: DayLoad }) {
  const { t } = useI18n();
  const tone = load === "overloaded" ? "danger" : load === "busy" ? "warn" : "ok";
  return <Badge tone={tone}>{t(`load.${load}`)}</Badge>;
}
