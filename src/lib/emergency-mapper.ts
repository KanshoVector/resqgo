import type {
  PublicEmergencyLocation,
  SupporterEmergencyLocation,
} from "@/lib/types/public";

const SUPPORTER_EMERGENCY_KEYS = [
  "id",
  "title",
  "description",
  "contact_info",
  "location",
  "status",
  "priority",
  "created_by",
  "created_at",
] as const;

export function toSupporterEmergency(
  row: Record<string, unknown>,
): SupporterEmergencyLocation {
  return Object.fromEntries(
    SUPPORTER_EMERGENCY_KEYS.map((k) => [k, row[k] ?? null]),
  ) as SupporterEmergencyLocation;
}

export function toPublicEmergency(
  item: SupporterEmergencyLocation,
): PublicEmergencyLocation {
  const { contact_info: _, ...rest } = item;
  return rest;
}
