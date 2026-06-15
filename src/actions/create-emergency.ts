"use server";

import type { ActionResult } from "@/lib/result";
import { filterSosEmergencies, isSosEmergencyTitle } from "@/lib/sos";
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("emergency_locations")
      .insert({
        title,
        description: description ?? null,
        contact_info: contact_info ?? null,
        priority,
        created_by: user?.id ?? null,
        location: `SRID=4326;POINT(${lng} ${lat})`,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[createEmergency] Supabase insert failed:", error);
      return {
        ok: false,
        error: "INTERNAL",
        message: "救助要請の登録に失敗しました。",
      };
    }

    return { ok: true, data: { id: data.id } };
  } catch (err) {
    console.error("[createEmergency] Unexpected error:", err);
    return {
      ok: false,
      error: "INTERNAL",
      message: "予期しないエラーが発生しました。",
    };
  }
}
