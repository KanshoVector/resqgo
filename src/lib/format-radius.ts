export function formatRadiusLabel(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
  }
  return `${meters} m`;
}

export const RADIUS_PRESETS = [100, 500, 1000, 3000, 5000, 10000, 25000, 50000] as const;

export function parseRadiusInput(value: string): number {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return 5000;
  return Math.min(50000, Math.max(100, parsed));
}
