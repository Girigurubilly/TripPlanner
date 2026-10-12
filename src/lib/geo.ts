export type PlaceFix = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  accuracy: number;
};

export function currentPlace(): Promise<PlaceFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("呢部機冇定位"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 0);
        void reversePlace(lat, lng)
          .then((place) => resolve({ ...place, accuracy }))
          .catch(() => resolve({ name: "", address: "", lat, lng, accuracy }));
      },
      (err) => {
        if (err.code === 1) reject(new Error("請允許定位，先可以打卡"));
        else if (err.code === 3) reject(new Error("定位太耐，去空曠啲再試"));
        else reject(new Error("而家定位唔到"));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 },
    );
  });
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
