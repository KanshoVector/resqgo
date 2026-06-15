"use client";

import type { EmergencyPriority, ShelterStatus } from "@/lib/types/public";
import { PRIORITY_LABELS, SHELTER_STATUS_LABELS } from "@/lib/geo";
import {
  formatRadiusLabel,
  parseRadiusInput,
  RADIUS_PRESETS,
} from "@/lib/format-radius";

export type FilterState = {
  priority: EmergencyPriority | "all";
  shelterStatus: ShelterStatus | "all";
  radiusMeters: number;
};

type FilterBarProps = {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
};

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const setRadius = (meters: number) => {
    onChange({ ...filters, radiusMeters: meters });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-800">検索・絞り込み</h3>
      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="filter-radius" className="text-xs font-semibold text-slate-600">
            検索範囲:{" "}
            <span className="text-base font-bold text-red-600">
              {formatRadiusLabel(filters.radiusMeters)}
            </span>
          </label>
          <div className="flex flex-wrap gap-1">
            {RADIUS_PRESETS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                  filters.radiusMeters === r
                    ? "bg-red-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {formatRadiusLabel(r)}
              </button>
            ))}
          </div>
        </div>
        <input
          id="filter-radius"
          type="range"
          min={100}
          max={50000}
          step={100}
          value={filters.radiusMeters}
          onChange={(e) => setRadius(parseRadiusInput(e.target.value))}
          className="w-full accent-red-600"
          aria-label="検索半径スライダー"
          aria-valuetext={formatRadiusLabel(filters.radiusMeters)}
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate-500">
          <span>100 m</span>
          <span>50 km</span>
        </div>
      </div>
    </div>
  );
}
