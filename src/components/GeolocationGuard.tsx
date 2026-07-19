"use client";

import { AlertTriangle, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

type ToastKind = "error" | "warning" | "info";

type Toast = { id: number; kind: ToastKind; message: string };

type GeolocationContextValue = {
  requestCurrentLocation: () => void;
  locating: boolean;
};

const GeolocationContext = createContext<GeolocationContextValue | null>(null);

type GeolocationGuardProps = {
  onPositionChange: (lat: number, lng: number) => void;
  onManualRequired: () => void;
  children: React.ReactNode;
};

const TOAST_STYLES: Record<ToastKind, string> = {
  error: "bg-red-600 text-white border-red-300",
  warning: "bg-amber-400 text-slate-900 border-amber-600",
  info: "bg-slate-700 text-white border-slate-500",
};

export function GeolocationGuard({
  onPositionChange,
  onManualRequired,
  children,
}: GeolocationGuardProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [locating, setLocating] = useState(false);

  const pushToast = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 8000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      pushToast(
        "warning",
        "この端末では位置情報が利用できません。地図上で位置を指定してください。",
      );
      onManualRequired();
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPositionChange(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            pushToast(
              "error",
              "位置情報が拒否されました。地図上で手動でピンを刺してください。",
            );
            onManualRequired();
            break;
          case err.POSITION_UNAVAILABLE:
            pushToast(
              "warning",
              "GPS信号を取得できません。電波状況を確認し、地図上で位置を指定してください。",
            );
            onManualRequired();
            break;
          case err.TIMEOUT:
            pushToast(
              "warning",
              "位置情報の取得がタイムアウトしました（10秒）。地図上で手動でピンを刺してください。",
            );
            onManualRequired();
            break;
          default:
            pushToast("error", "位置情報の取得に失敗しました。地図上で位置を指定してください。");
            onManualRequired();
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [onManualRequired, onPositionChange, pushToast]);

  return (
    <GeolocationContext.Provider value={{ requestCurrentLocation, locating }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border-2 px-4 py-3 text-sm font-semibold shadow-lg ${TOAST_STYLES[toast.kind]}`}
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p className="flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 rounded p-0.5 hover:opacity-80"
              aria-label="通知を閉じる"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </GeolocationContext.Provider>
  );
}

export function useGeolocation() {
  const ctx = useContext(GeolocationContext);
  if (!ctx) throw new Error("useGeolocation must be used within GeolocationGuard");
  return ctx;
}
