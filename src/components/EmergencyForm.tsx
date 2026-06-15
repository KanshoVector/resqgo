"use client";

import {
  Crosshair,
  Loader2,
  MapPin,
  Send,
  SlidersHorizontal,
  WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createEmergency as createEmergencyAction } from "@/actions/create-emergency";
import { useAuth } from "@/components/AuthProvider";
import { EmergencyList } from "@/components/EmergencyList";
import { FilterBar, type FilterState } from "@/components/FilterBar";
import {
  GeolocationGuard,
  useGeolocation,
} from "@/components/GeolocationGuard";
import { MapView } from "@/components/MapView";
import { QrBatonRelay } from "@/components/QrBatonRelay";
import { ShelterAdminPanel } from "@/components/ShelterAdminPanel";
import { useEmergencyFeed } from "@/hooks/useEmergencyFeed";
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type EmergencyFormDraft,
} from "@/lib/draft-storage";
import { externalDataProvider, parseGeoLocation } from "@/lib/geo";
import type {
  EmergencyPriority,
  PublicEmergencyLocation,
  PublicEvacuationCenter,
} from "@/lib/types/public";

const SAVE_DEBOUNCE_MS = 3000;

export function EmergencyForm() {
  const [adjustMode, setAdjustMode] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const handlePositionChange = useCallback((newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
  }, []);

  const handleManualRequired = useCallback(() => {
    setAdjustMode(true);
  }, []);

  return (
    <GeolocationGuard
      onPositionChange={handlePositionChange}
      onManualRequired={handleManualRequired}
    >
      <EmergencyFormBody
        lat={lat}
        lng={lng}
        setLat={setLat}
        setLng={setLng}
        adjustMode={adjustMode}
        setAdjustMode={setAdjustMode}
      />
    </GeolocationGuard>
  );
}

type BodyProps = {
  lat: number | null;
  lng: number | null;
  setLat: (v: number) => void;
  setLng: (v: number) => void;
  adjustMode: boolean;
  setAdjustMode: (v: boolean) => void;
};

function EmergencyFormBody({
  lat,
  lng,
  setLat,
  setLng,
  adjustMode,
  setAdjustMode,
}: BodyProps) {
  const { user, role } = useAuth();
  const { requestCurrentLocation, locating } = useGeolocation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [priority, setPriority] = useState<EmergencyPriority>("medium");
  const [filters, setFilters] = useState<FilterState>({
    priority: "all",
    shelterStatus: "all",
    radiusMeters: 5000,
  });
  const [showQr, setShowQr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"success" | "error" | "info">("info");
  const [isOnline, setIsOnline] = useState(true);
  const [routeDestination, setRouteDestination] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [trafficInfo, setTrafficInfo] = useState<string[]>([]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftLoadedRef = useRef(false);
  const initialLocationRequested = useRef(false);

  const pinPosition = lat !== null && lng !== null ? { lat, lng } : null;
  const isAuthenticated = !!user;

  const { emergencies, shelters, loading, error, retry } = useEmergencyFeed(
    lat,
    lng,
    filters.radiusMeters,
    filters.priority,
    filters.shelterStatus,
    isAuthenticated,
  );

  const showStatus = useCallback(
    (message: string, kind: "success" | "error" | "info" = "info") => {
      setStatusMessage(message);
      setStatusKind(kind);
    },
    [],
  );

  const handlePinMove = useCallback(
    (newLat: number, newLng: number) => {
      if (!adjustMode) return;
      setLat(newLat);
      setLng(newLng);
    },
    [adjustMode, setLat, setLng],
  );

  useEffect(() => {
    if (initialLocationRequested.current) return;
    initialLocationRequested.current = true;
    requestCurrentLocation();
  }, [requestCurrentLocation]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    loadDraft().then((draft) => {
      if (!draft) return;
      setTitle(draft.title);
      setDescription(draft.description);
      setContactInfo(draft.contact_info);
      if (draft.lat !== null) setLat(draft.lat);
      if (draft.lng !== null) setLng(draft.lng);
      setFilters((f) => ({ ...f, radiusMeters: draft.radiusMeters }));
      draftLoadedRef.current = true;
    });
  }, [setLat, setLng]);

  useEffect(() => {
    if (!draftLoadedRef.current && !title && !description) return;
    const draft: EmergencyFormDraft = {
      title,
      description,
      contact_info: contactInfo,
      lat,
      lng,
      radiusMeters: filters.radiusMeters,
    };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(
      () => saveDraft(draft).catch(console.error),
      SAVE_DEBOUNCE_MS,
    );
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, description, contactInfo, lat, lng, filters.radiusMeters]);

  useEffect(() => {
    if (lat === null || lng === null) return;
    externalDataProvider
      .fetchTraffic(lat, lng, filters.radiusMeters / 1000)
      .then((records) =>
        setTrafficInfo(records.map((r) => `${r.roadName}: ${r.description}`)),
      )
      .catch(console.error);
  }, [lat, lng, filters.radiusMeters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lat === null || lng === null) {
      showStatus(
        "位置情報を取得するか、位置微調整モードで地図上にピンを設定してください。",
        "error",
      );
      return;
    }

    const payload = {
      title,
      description: description || undefined,
      lat,
      lng,
      contact_info: contactInfo || undefined,
      priority,
    };

    if (!isOnline) {
      showStatus("通信が利用できないため、QRコードによる情報共有に切り替えます。", "info");
      setShowQr(true);
      return;
    }

    setSubmitting(true);
    try {
      const result = await createEmergencyAction(payload);
      if (result.ok) {
        await clearDraft();
        showStatus("救助要請を受け付けました。", "success");
        setTitle("");
        setDescription("");
        setContactInfo("");
        retry();
      } else {
        showStatus(result.message, "error");
        if (result.error === "INTERNAL") setShowQr(true);
      }
    } catch {
      showStatus("通信エラーのため、QRコードによる情報共有に切り替えます。", "info");
      setShowQr(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectEmergency = (item: PublicEmergencyLocation) => {
    const coords = parseGeoLocation(item.location);
    if (coords) {
      setRouteDestination({ lat: coords.lat, lng: coords.lng, label: item.title });
    }
  };

  const handleSelectShelter = (item: PublicEvacuationCenter) => {
    const coords = parseGeoLocation(item.location);
    if (coords) {
      setRouteDestination({ lat: coords.lat, lng: coords.lng, label: item.name });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={requestCurrentLocation}
          disabled={locating}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Crosshair className="h-4 w-4 text-red-600" />
          )}
          現在地を取得
        </button>
        <button
          type="button"
          onClick={() => setAdjustMode(!adjustMode)}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm ${
            adjustMode
              ? "border-amber-500 bg-amber-100 text-amber-900"
              : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {adjustMode ? "位置微調整モード: ON" : "位置を微調整する"}
        </button>
      </div>

      <MapView
        pinPosition={pinPosition}
        onPinMove={handlePinMove}
        adjustMode={adjustMode}
        emergencies={isAuthenticated ? emergencies : []}
        shelters={isAuthenticated ? shelters : []}
        routeDestination={routeDestination}
        onClearRoute={() => setRouteDestination(null)}
      />

      {pinPosition && (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <MapPin className="h-4 w-4 text-red-600" />
          選択位置: {pinPosition.lat.toFixed(5)}, {pinPosition.lng.toFixed(5)}
        </p>
      )}

      {statusMessage && (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
            statusKind === "success"
              ? "border-green-300 bg-green-50 text-green-800"
              : statusKind === "error"
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-blue-300 bg-blue-50 text-blue-800"
          }`}
        >
          {statusMessage}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-900">救助要請の送信</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-semibold text-slate-700">
              状況タイトル <span className="text-red-600">*</span>
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              required
              placeholder="例: 2階に避難者3名、水と毛布が必要"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>
          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-semibold text-slate-700">
              詳細説明
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="建物の状態、必要な支援内容など（最大500文字）"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>
          <div>
            <label htmlFor="priority" className="mb-1 block text-sm font-semibold text-slate-700">
              緊急度
            </label>
            <select
              id="priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as EmergencyPriority)}
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900"
            >
              <option value="high">高 — 生命の危機あり</option>
              <option value="medium">中 — 早めの支援が必要</option>
              <option value="low">低 — 情報共有・経過観察</option>
            </select>
          </div>
          <div>
            <label htmlFor="contact" className="mb-1 block text-sm font-semibold text-slate-700">
              連絡先（非公開）
            </label>
            <input
              id="contact"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="支援者のみが参照できる連絡先"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-base font-bold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
            救助要請を送信
          </button>
        </form>
      </section>

      {isAuthenticated ? (
        <>
          <FilterBar filters={filters} onChange={setFilters} />
          {trafficInfo.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">道路交通情報（参考）</p>
              <ul className="mt-1 list-inside list-disc">
                {trafficInfo.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          <EmergencyList
            emergencies={emergencies}
            shelters={shelters}
            origin={pinPosition}
            loading={loading}
            error={error}
            onRetry={retry}
            onSelectEmergency={handleSelectEmergency}
            onSelectShelter={handleSelectShelter}
            isAuthenticated
          />
          {role === "shelter_admin" && shelters.length > 0 && (
            <ShelterAdminPanel shelters={shelters} onUpdated={retry} />
          )}
        </>
      ) : (
        <EmergencyList
          emergencies={[]}
          shelters={[]}
          origin={null}
          loading={false}
          error={null}
          onRetry={() => {}}
          onSelectEmergency={() => {}}
          onSelectShelter={() => {}}
          isAuthenticated={false}
        />
      )}

      {!isOnline && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <WifiOff className="h-5 w-5" />
          オフライン — 送信時はQRコードによる情報共有が利用されます
        </div>
      )}

      {showQr && lat !== null && lng !== null && (
        <QrBatonRelay
          title={title}
          description={description}
          lat={lat}
          lng={lng}
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}
