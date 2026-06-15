"use server";

import type { ActionResult } from "@/lib/result";
import { searchSchema } from "@/lib/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PublicEmergencyLocation } from "@/lib/types/public";

const PUBLIC_EMERGENCY_KEYS = [
  "id",
  "title",
  "description",
  "location",
  "status",
  "priority",
  "created_by",
  "created_at",
] as const;

function toPublicEmergency(row: Record<string, unknown>): PublicEmergencyLocation {
  const picked = Object.fromEntries(
    PUBLIC_EMERGENCY_KEYS.map((k) => [k, row[k]]),
  ) as PublicEmergencyLocation;
  return picked;
}

export async function searchEmergency(
  input: unknown,
): Promise<ActionResult<PublicEmergencyLocation[]>> {
  const parsed = searchSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", message: "検索条件が不正です。" };
  }

  const { lat, lng, radiusMeters, priority } = parsed.data;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        ok: false,
        error: "VALIDATION",
        message: "周辺情報の閲覧にはログインが必要です。",
      };
    }

    const { data, error } = await supabase.rpc("search_nearby_emergencies", {
      lat,
      lng,
      radius_meters: radiusMeters,
      priority_filter: priority ?? null,
    });

    if (error) {
      console.error("[searchEmergency] RPC failed:", error);
      return {
        ok: false,
        error: "INTERNAL",
        message: "周辺の救助要請の検索に失敗しました。",
      };
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    return { ok: true, data: rows.map(toPublicEmergency) };
  } catch (err) {
    console.error("[searchEmergency] Unexpected error:", err);
    return {
      ok: false,
      error: "INTERNAL",
      message: "予期しないエラーが発生しました。",
    };
  }
}

export type { PublicEmergencyLocation };
