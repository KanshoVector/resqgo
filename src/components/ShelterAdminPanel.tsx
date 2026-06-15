"use client";

import { Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { updateShelterStatus } from "@/actions/evacuation-centers";
import type { PublicEvacuationCenter, ShelterStatus } from "@/lib/types/public";
import { SHELTER_STATUS_LABELS } from "@/lib/geo";

type ShelterAdminPanelProps = {
  shelters: PublicEvacuationCenter[];
  onUpdated: () => void;
};

export function ShelterAdminPanel({ shelters, onUpdated }: ShelterAdminPanelProps) {
  const [updating, setUpdating] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleUpdate = async (id: string, status: ShelterStatus) => {
    setUpdating(id);
    setMessage(null);
    const result = await updateShelterStatus(id, status);
    setUpdating(null);
    if (result.ok) {
      setMessage("避難所状態を更新しました。");
      onUpdated();
    } else {
      setMessage(result.message);
    }
  };

  return (
    <section className="rounded-xl border-2 border-orange-200 bg-orange-50 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-orange-900">
        <Building2 className="h-5 w-5" />
        避難所管理者メニュー
      </h2>
      {message && (
        <p className="mb-3 text-sm font-semibold text-orange-800">{message}</p>
      )}
      <ul className="space-y-2">
        {shelters.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2"
          >
            <span className="text-sm font-semibold text-slate-800">{s.name}</span>
            <div className="flex items-center gap-2">
              {(Object.keys(SHELTER_STATUS_LABELS) as ShelterStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={updating === s.id}
                  onClick={() => handleUpdate(s.id, status)}
                  className={`rounded px-2 py-1 text-xs font-bold ${
                    s.facility_status === status
                      ? "bg-orange-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {updating === s.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    SHELTER_STATUS_LABELS[status]
                  )}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
