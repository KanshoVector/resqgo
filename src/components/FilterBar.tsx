"use client";

import type { EmergencyPriority, ShelterStatus } from "@/lib/types/public";
import { PRIORITY_LABELS, SHELTER_STATUS_LABELS } from "@/lib/geo";

export type FilterState = {
  priority: EmergencyPriority | "all";
  shelterStatus: ShelterStatus | "all";
  radiusMeters: number;
};

type FilterBarProps = {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
};

const RADIUS_PRESETS = [100, 500, 1000, 3000, 5000, 10000, 25000, 50000];

export function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-800">検索・絞り込み</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="filter-priority" className="mb-1 block text-xs font-semibold text-slate-600">
            緊急度
          </label>
          <select
            id="filter-priority"
            value={filters.priority}
            onChange={(e) =>
              onChange({
                ...filters,
                priority: e.target.value as FilterState["priority"],
              })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">すべて</option>
            {(Object.keys(PRIORITY_LABELS) as EmergencyPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-shelter" className="mb-1 block text-xs font-semibold text-slate-600">
            避難所状態
          </label>
          <select
            id="filter-shelter"
            value={filters.shelterStatus}
            onChange={(e) =>
              onChange({
                ...filters,
                shelterStatus: e.target.value as FilterState["shelterStatus"],
              })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">すべて</option>
            {(Object.keys(SHELTER_STATUS_LABELS) as ShelterStatus[]).map((s) => (
              <option key={s} value={s}>
                {SHELTER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-radius" className="mb-1 block text-xs font-semibold text-slate-600">
            距離: {filters.radiusMeters.toLocaleString()}m
          </label>
          <select
            id="filter-radius"
            value={filters.radiusMeters}
            onChange={(e) =>
              onChange({ ...filters, radiusMeters: Number(e.target.value) })
            }
            className="mb-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {RADIUS_PRESETS.map((r) => (
              <option key={r} value={r}>
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </option>
            ))}
          </select>
          <input
            type="range"
            min={100}
            max={50000}
            step={100}
            value={filters.radiusMeters}
            onChange={(e) =>
              onChange({ ...filters, radiusMeters: Number(e.target.value) })
            }
            className="w-full accent-red-600"
            aria-label="検索半径スライダー"
          />
        </div>
      </div>
    </div>
  );
}
