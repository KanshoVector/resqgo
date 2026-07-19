"use server";

import type { ActionResult } from "@/lib/result";
import { toSupporterEmergency } from "@/lib/emergency-mapper";
import { searchSchema } from "@/lib/schemas";
import { filterSosEmergencies } from "@/lib/sos";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  PublicEvacuationCenter,
  SupporterEmergencyLocation,
} from "@/lib/types/public";

export async function searchEmergency(
  input: unknown,
): Promise<ActionResult<SupporterEmergencyLocation[]>> {
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
    return { ok: true, data: filterSosEmergencies(rows.map(toSupporterEmergency)) };
  } catch (err) {
    console.error("[searchEmergency] Unexpected error:", err);
    return {
      ok: false,
      error: "INTERNAL",
      message: "予期しないエラーが発生しました。",
    };
  }
}

export async function fetchAllMapPins(): Promise<
  ActionResult<{
    emergencies: SupporterEmergencyLocation[];
    shelters: PublicEvacuationCenter[];
  }>
> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        ok: false,
        error: "VALIDATION",
        message: "ログインが必要です。",
      };
    }

    const { data, error } = await supabase.rpc("fetch_all_map_pins");

    if (error || !data) {
      console.error("[fetchAllMapPins] RPC failed:", error);
      return {
        ok: false,
        error: "INTERNAL",
        message: "地図データの取得に失敗しました。",
      };
    }

    const payload = data as {
      emergencies: Record<string, unknown>[];
      shelters: Record<string, unknown>[];
    };

    return {
      ok: true,
      data: {
        emergencies: filterSosEmergencies(
          (payload.emergencies ?? []).map(toSupporterEmergency),
        ),
        shelters: (payload.shelters ?? []) as PublicEvacuationCenter[],
      },
    };
  } catch (err) {
    console.error("[fetchAllMapPins] Unexpected error:", err);
    return {
      ok: false,
      error: "INTERNAL",
      message: "予期しないエラーが発生しました。",
    };
  }
}
