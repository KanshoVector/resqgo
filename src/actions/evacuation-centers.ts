"use server";

import type { ActionResult } from "@/lib/result";
import { searchSchema } from "@/lib/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PublicEvacuationCenter } from "@/lib/types/public";

export async function searchEvacuationCenters(
  input: unknown,
): Promise<ActionResult<PublicEvacuationCenter[]>> {
  const parsed = searchSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", message: "検索条件が不正です。" };
  }

  const { lat, lng, radiusMeters, shelterStatus } = parsed.data;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        ok: false,
        error: "VALIDATION",
        message: "避難所情報の閲覧にはログインが必要です。",
      };
    }

    const { data, error } = await supabase.rpc("search_nearby_evacuation_centers", {
      lat,
      lng,
      radius_meters: radiusMeters,
      status_filter: shelterStatus ?? null,
    });

    if (error) {
      console.error("[searchEvacuationCenters] RPC failed:", error);
      return {
        ok: false,
        error: "INTERNAL",
        message: "避難所情報の取得に失敗しました。",
      };
    }

    return { ok: true, data: (data ?? []) as PublicEvacuationCenter[] };
  } catch (err) {
    console.error("[searchEvacuationCenters] Unexpected error:", err);
    return {
      ok: false,
      error: "INTERNAL",
      message: "予期しないエラーが発生しました。",
    };
  }
}

export async function getEvacuationCenter(
  id: string,
): Promise<ActionResult<PublicEvacuationCenter>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        ok: false,
        error: "VALIDATION",
        message: "避難所情報の閲覧にはログインが必要です。",
      };
    }

    const { data, error } = await supabase
      .from("evacuation_centers")
      .select("id, name, address, location, capacity, current_occupancy, facility_status, created_at")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error("[getEvacuationCenter] fetch failed:", error);
      return {
        ok: false,
        error: "INTERNAL",
        message: "避難所情報が見つかりませんでした。",
      };
    }

    return { ok: true, data: data as PublicEvacuationCenter };
  } catch (err) {
    console.error("[getEvacuationCenter] Unexpected error:", err);
    return {
      ok: false,
      error: "INTERNAL",
      message: "予期しないエラーが発生しました。",
    };
  }
}

export async function updateShelterStatus(
  id: string,
  facilityStatus: "open" | "full" | "closed",
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "VALIDATION", message: "ログインが必要です。" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "shelter_admin") {
      return { ok: false, error: "VALIDATION", message: "管理者権限が必要です。" };
    }

    const { error } = await supabase
      .from("evacuation_centers")
      .update({ facility_status: facilityStatus })
      .eq("id", id);

    if (error) {
      console.error("[updateShelterStatus] update failed:", error);
      return { ok: false, error: "INTERNAL", message: "更新に失敗しました。" };
    }

    return { ok: true, data: { id } };
  } catch (err) {
    console.error("[updateShelterStatus] Unexpected error:", err);
    return { ok: false, error: "INTERNAL", message: "予期しないエラーが発生しました。" };
  }
}
