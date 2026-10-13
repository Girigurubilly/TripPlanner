export type PlaceFix = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  accuracy: number;
};

const DENIED = "Safari 未允許定位。撳網址列左邊「啊A」→ 網站設定 → 位置 → 允許，然後再撳一次。";

export function startLocate(onPlace: (place: PlaceFix) => void, onError: (message: string) => void): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation || (typeof window !== "undefined" && !window.isSecureContext)) {
    onError("請用 Safari 開啟 https://girigurubilly.github.io/TripPlanner/ ，手機先會問定位。");
    return () => {};
  }
  let settled = false;
  let watch = 0;
  const stop = () => {
    settled = true;
    if (watch) navigator.geolocation.clearWatch(watch);
  };
  const ok = (pos: GeolocationPosition) => {
    if (settled) return;
    stop();
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const accuracy = Math.round(pos.coords.accuracy || 0);
    void reversePlace(lat, lng)
      .then((place) => onPlace({ ...place, accuracy }))
      .catch(() => onPlace({ name: "", address: "", lat, lng, accuracy }));
  };
  const bad = (err: GeolocationPositionError) => {
    if (settled) return;
    stop();
    if (err.code === 1) onError(DENIED);
    else if (err.code === 3) onError("定位太耐。去空曠啲再試，並確認「啊A」→ 網站設定 → 位置係允許。");
    else onError("而家定位唔到。請去「設定 → 私隱與保安 → 定位服務」，開 Safari 網站。");
  };
  const opts: PositionOptions = { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 };
  // Called in the same tap as the button. watchPosition is what makes iPhone show the permission prompt.
  watch = navigator.geolocation.watchPosition(ok, bad, opts);
  return stop;
}

async function reversePlace(lat: number, lng: number): Promise<Pick<PlaceFix, "name" | "address" | "lat" | "lng">> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=zh-Hant&lat=${lat}&lon=${lng}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("place");
  const data = (await response.json()) as {
    name?: string;
    display_name?: string;
    address?: Record<string, string>;
  };
  const address = data.address || {};
  const name =
    data.name ||
    address.amenity ||
    address.shop ||
    address.tourism ||
    address.road ||
    address.neighbourhood ||
    address.suburb ||
    "";
  const parts = [address.road, address.neighbourhood || address.suburb, address.city || address.town || address.province].filter(
    (part): part is string => Boolean(part) && part !== name,
  );
  const line = [...new Set(parts)].join(" · ");
  return { name, address: line, lat, lng };
}
