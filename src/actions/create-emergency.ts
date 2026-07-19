"use server";

import type { ActionResult } from "@/lib/result";
import { isSosEmergencyTitle } from "@/lib/sos";
import { emergencyInputSchema } from "@/lib/schemas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createEmergency(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = emergencyInputSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "VALIDATION", message: "入力内容が不正です。" };
  }

  const { title, description, lat, lng, contact_info, priority } = parsed.data;

  if (!isSosEmergencyTitle(title)) {
    return {
      ok: false,
      error: "VALIDATION",
      message: "避難所情報は救助要請として登録できません。避難所は専用マスターで管理されます。",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("create_sos_emergency", {
      p_title: title,
      p_description: description ?? null,
      p_contact_info: contact_info ?? null,
      p_priority: priority,
      p_lng: lng,
      p_lat: lat,
    });

    if (error) {
      console.error("[createEmergency] RPC failed:", error);
      if (error.code === "22023") {
        return { ok: false, error: "VALIDATION", message: "入力内容が不正です。" };
      }
      if (error.code === "P0001") {
        return {
          ok: false,
          error: "RATE_LIMIT",
          message: "投稿が集中しています。しばらく待ってから再度お試しください。",
        };
      }
      return {
        ok: false,
        error: "INTERNAL",
        message: "救助要請の登録に失敗しました。",
      };
    }

    if (!data) {
      return {
        ok: false,
        error: "INTERNAL",
        message: "救助要請の登録に失敗しました。",
      };
    }

    return { ok: true, data: { id: data as string } };
  } catch (err) {
    console.error("[createEmergency] Unexpected error:", err);
    return {
      ok: false,
      error: "INTERNAL",
      message: "予期しないエラーが発生しました。",
    };
  }
}
