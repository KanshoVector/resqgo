export function coordsFromLocation(
  location: unknown,
): { lat: number; lng: number } | null {
  try {
    let loc: unknown = location;
    if (typeof loc === "string") {
      const ewkb = parseEwkbHex(loc);
      if (ewkb) return ewkb;
      const wkt = loc.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
      if (wkt) {
        const lng = Number(wkt[1]);
        const lat = Number(wkt[2]);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      }
      loc = JSON.parse(loc);
    }
    if (!loc || typeof loc !== "object") return null;
    const o = loc as Record<string, unknown>;
    if (o.geometry && typeof o.geometry === "object") {
      return coordsFromLocation(o.geometry);
    }
    if (Array.isArray(o.coordinates) && o.coordinates.length >= 2) {
      const lng = Number(o.coordinates[0]);
      const lat = Number(o.coordinates[1]);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    }
    const lat = Number(o.lat ?? o.latitude);
    const lng = Number(o.lng ?? o.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/** PostGIS EWKB hex (Supabase RPC の geography 返却形式) */
function parseEwkbHex(hex: string): { lat: number; lng: number } | null {
  const m = hex.trim().match(/^0101000020E6100000([0-9a-f]{32})$/i);
  if (!m) return null;
  const bytes = m[1];
  const readDoubleLE = (offset: number) => {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    for (let i = 0; i < 8; i++) {
      view.setUint8(i, parseInt(bytes.slice(offset + i * 2, offset + i * 2 + 2), 16));
    }
    return view.getFloat64(0, true);
  };
  const lng = readDoubleLE(0);
  const lat = readDoubleLE(16);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function getGoogleMapsUrl(location: unknown): string | null {
  const c = coordsFromLocation(location);
  if (!c) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=walking`;
}

export function buildInAppRouteHref(
  location: unknown,
  label: string,
): string | null {
  const c = coordsFromLocation(location);
  if (!c) return null;
  const params = new URLSearchParams({
    tab: "search",
    destLat: String(c.lat),
    destLng: String(c.lng),
    destLabel: label,
  });
  return `/?${params.toString()}`;
}
