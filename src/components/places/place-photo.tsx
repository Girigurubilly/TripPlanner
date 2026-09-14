import { useEffect, useState } from "react";
import { bakedPhotoFor, resolvePlacePhoto } from "@/data/place-photos";
import { cn } from "@/lib/utils";
import type { PlaceCategory } from "@/types/trip";

const CAT_BG: Record<PlaceCategory, string> = {
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

export function PlacePhoto({
  name,
  neighbourhood = "",
  photos = [],
  category = "other",
  className,
}: {
  name: string;
  neighbourhood?: string;
  photos?: string[];
  category?: PlaceCategory;
  className?: string;
}) {
  const baked = bakedPhotoFor(name);
  const initial = (photos[0] && !photos[0].includes("Special:FilePath") ? photos[0] : undefined) || baked;
  const [src, setSrc] = useState<string | undefined>(initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const next = (photos[0] && !photos[0].includes("Special:FilePath") ? photos[0] : undefined) || bakedPhotoFor(name);
    setSrc(next);
    setFailed(false);
  }, [name, photos]);

  useEffect(() => {
    if (src) return;
    let cancelled = false;
    void resolvePlacePhoto(name, neighbourhood).then((url) => {
      if (!cancelled && url) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [name, neighbourhood, src]);

  if (!src || failed) {
    return (
      <div
        className={cn("grid place-items-center font-display text-lg tracking-tight", CAT_BG[category], className)}
        aria-hidden
      >
        {name.slice(0, 1)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn("object-cover", className)}
      onError={() => {
        const fallback = bakedPhotoFor(name);
        if (fallback && src !== fallback) {
          setSrc(fallback);
          return;
        }
        setFailed(true);
      }}
    />
  );
}
