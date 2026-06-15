"use client";

import Link from "next/link";
import { AlertCircle, MapPin, RefreshCw } from "lucide-react";
import {
  haversineMeters,
  parseGeoLocation,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  SHELTER_STATUS_COLORS,
  SHELTER_STATUS_LABELS,
} from "@/lib/geo";
import type {
  PublicEmergencyLocation,
  PublicEvacuationCenter,
} from "@/lib/types/public";

type EmergencyListProps = {
  emergencies: PublicEmergencyLocation[];
  shelters: PublicEvacuationCenter[];
  origin: { lat: number; lng: number } | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectEmergency: (item: PublicEmergencyLocation) => void;
  onSelectShelter: (item: PublicEvacuationCenter) => void;
  isAuthenticated: boolean;
};

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 h-4 w-2/3 rounded bg-slate-200" />
      <div className="mb-1 h-3 w-full rounded bg-slate-100" />
      <div className="h-3 w-1/2 rounded bg-slate-100" />
    </div>
  );
}

export function EmergencyList({
  emergencies,
  shelters,
  origin,
  loading,
  error,
  onRetry,
  onSelectEmergency,
  onSelectShelter,
  isAuthenticated,
}: EmergencyListProps) {
  if (!isAuthenticated) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
        ログイン後に周辺の救助要請・避難所情報を表示します。
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="データ読み込み中">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-600" />
        <p className="mb-3 text-sm font-semibold text-red-800">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500"
        >
          <RefreshCw className="h-4 w-4" />
          再読み込み
        </button>
      </div>
    );
  }

  const total = emergencies.length + shelters.length;

  if (total === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        指定条件に該当する情報は見つかりませんでした。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {emergencies.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-800">
            救助要請（{emergencies.length}件）
          </h3>
          <ul className="space-y-2">
            {emergencies.map((item) => {
              const coords = parseGeoLocation(item.location);
              const dist =
                origin && coords
                  ? haversineMeters(origin, coords)
                  : null;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEmergency(item)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-red-300 hover:shadow"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-xs font-bold text-white"
                        style={{ backgroundColor: PRIORITY_COLORS[item.priority] }}
                      >
                        緊急度: {PRIORITY_LABELS[item.priority]}
                      </span>
                      {dist !== null && (
                        <span className="text-xs text-slate-500">
                          {dist < 1000
                            ? `${Math.round(dist)}m`
                            : `${(dist / 1000).toFixed(1)}km`}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-bold text-slate-900">{item.title}</p>
                    {item.description && (
                      <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {shelters.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-800">
            避難所（{shelters.length}件）
          </h3>
          <ul className="space-y-2">
            {shelters.map((item) => {
              const coords = parseGeoLocation(item.location);
              const dist =
                origin && coords
                  ? haversineMeters(origin, coords)
                  : null;
              return (
                <li key={item.id}>
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-xs font-bold text-white"
                        style={{
                          backgroundColor: SHELTER_STATUS_COLORS[item.facility_status],
                        }}
                      >
                        {SHELTER_STATUS_LABELS[item.facility_status]}
                      </span>
                      {dist !== null && (
                        <span className="text-xs text-slate-500">
                          {dist < 1000
                            ? `${Math.round(dist)}m`
                            : `${(dist / 1000).toFixed(1)}km`}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-bold text-slate-900">{item.name}</p>
                    {item.address && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
                        <MapPin className="h-3 w-3" />
                        {item.address}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectShelter(item)}
                        className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                      >
                        地図で経路表示
                      </button>
                      <Link
                        href={`/evacuation-centers/${item.id}`}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        詳細を見る
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
