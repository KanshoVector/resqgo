export function getGoogleMapsApiKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const PRIORITY_COLORS = { high: "#dc2626", medium: "#ea580c", low: "#ca8a04" } as const;
export const PRIORITY_LABELS = { high: "高", medium: "中", low: "低" } as const;
export const SHELTER_STATUS_COLORS = { open: "#16a34a", full: "#ea580c", closed: "#64748b" } as const;
export const SHELTER_STATUS_LABELS = { open: "開設中", full: "満員", closed: "閉鎖" } as const;

export async function fetchDirectionsPolyline(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<google.maps.LatLngLiteral[] | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || typeof google === "undefined") return null;
  return new Promise((resolve) => {
    new google.maps.DirectionsService().route(
      { origin, destination, travelMode: google.maps.TravelMode.WALKING },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result?.routes[0]) {
          resolve(null);
          return;
        }
        resolve(result.routes[0].overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })));
      },
    );
  });
}
