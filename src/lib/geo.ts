export function parseGeoLocation(
  location: unknown,
): { lat: number; lng: number } | null {
  if (!location) return null;

  if (typeof location === "object" && location !== null) {
    const geo = location as { type?: string; coordinates?: number[] };
    if (
      geo.type === "Point" &&
      Array.isArray(geo.coordinates) &&
      geo.coordinates.length >= 2
    ) {
      return { lng: geo.coordinates[0], lat: geo.coordinates[1] };
    }
  }

  if (typeof location === "string") {
    const match = location.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
    }
  }

  return null;
}

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
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const PRIORITY_COLORS = {
  high: "#dc2626",
  medium: "#ea580c",
  low: "#ca8a04",
} as const;

export const SHELTER_STATUS_COLORS = {
  open: "#16a34a",
  full: "#ea580c",
  closed: "#64748b",
} as const;

export const SHELTER_STATUS_LABELS = {
  open: "開設中",
  full: "満員",
  closed: "閉鎖",
} as const;

export const PRIORITY_LABELS = {
  high: "高",
  medium: "中",
  low: "低",
} as const;

/** External infrastructure data integration interface */
export type TrafficCondition = "normal" | "congested" | "closed";

export type ExternalShelterRecord = {
  sourceId: string;
  source: "mlit" | "municipal" | "jartic";
  name: string;
  lat: number;
  lng: number;
  status?: string;
};

export type ExternalTrafficRecord = {
  sourceId: string;
  source: "jartic" | "mlit";
  roadName: string;
  condition: TrafficCondition;
  description: string;
};

export interface ExternalDataProvider {
  fetchShelters(lat: number, lng: number, radiusKm: number): Promise<ExternalShelterRecord[]>;
  fetchTraffic(lat: number, lng: number, radiusKm: number): Promise<ExternalTrafficRecord[]>;
}

/** Mock provider — replace with MLIT / municipal / JARTIC API adapters */
export class MockExternalDataProvider implements ExternalDataProvider {
  async fetchShelters(
    lat: number,
    lng: number,
    _radiusKm: number,
  ): Promise<ExternalShelterRecord[]> {
    return [
      {
        sourceId: "mlit-demo-001",
        source: "mlit",
        name: "指定緊急避難場所（公園）",
        lat: lat + 0.002,
        lng: lng + 0.003,
        status: "open",
      },
      {
        sourceId: "municipal-demo-002",
        source: "municipal",
        name: "区民センター避難所",
        lat: lat - 0.001,
        lng: lng + 0.002,
        status: "open",
      },
    ];
  }

  async fetchTraffic(_lat: number, _lng: number): Promise<ExternalTrafficRecord[]> {
    return [
      {
        sourceId: "jartic-demo-001",
        source: "jartic",
        roadName: "首都高速道路",
        condition: "congested",
        description: "一部区間で減速規制（モックデータ）",
      },
    ];
  }
}

export const externalDataProvider: ExternalDataProvider = new MockExternalDataProvider();

export async function fetchDirectionsPolyline(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<google.maps.LatLngLiteral[] | null> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || typeof google === "undefined") return null;

  return new Promise((resolve) => {
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.WALKING,
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result?.routes[0]) {
          resolve(null);
          return;
        }
        const path = result.routes[0].overview_path.map((p) => ({
          lat: p.lat(),
          lng: p.lng(),
        }));
        resolve(path);
      },
    );
  });
}
