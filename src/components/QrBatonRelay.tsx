"use client";

import { AlertTriangle, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useMemo, useRef } from "react";

export const QR_TTL_MS = 6 * 60 * 60 * 1000;

export type QrRelayPayload = {
  t: string;
  d?: string;
  g: [number, number];
  ts: number;
};

type QrBatonRelayProps = {
  title: string;
  description: string;
  lat: number;
  lng: number;
  onClose: () => void;
};

export function QrBatonRelay({
  title,
  description,
  lat,
  lng,
  onClose,
}: QrBatonRelayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const payload = useMemo<QrRelayPayload>(
    () => ({
      t: title,
      ...(description ? { d: description } : {}),
      g: [lat, lng],
      ts: Date.now(),
    }),
    [title, description, lat, lng],
  );

  const json = useMemo(() => JSON.stringify(payload), [payload]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    QRCode.toCanvas(canvas, json, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(console.error);
  }, [json]);

  const expiresAt = new Date(payload.ts + QR_TTL_MS);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-md rounded-xl border-2 border-amber-400 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900">
            <QrCode className="h-6 w-6" aria-hidden />
            <h2 className="text-xl font-bold">QRコードによる情報共有</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="閉じる"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div
          className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <p>
              このQRコードは暗号署名されていません。内容の真正性は保証されず、有効期限は6時間です。
            </p>
          </div>
        </div>

        <div className="flex justify-center rounded-lg border border-slate-200 bg-white p-4">
          <canvas ref={canvasRef} aria-label="救助要請QRコード" />
        </div>

        <dl className="mt-4 space-y-1 text-sm text-slate-700">
          <div>
            <dt className="inline font-semibold text-slate-900">タイトル: </dt>
            <dd className="inline">{title}</dd>
          </div>
          {description && (
            <div>
              <dt className="inline font-semibold text-slate-900">説明: </dt>
              <dd className="inline">{description}</dd>
            </div>
          )}
          <div>
            <dt className="inline font-semibold text-slate-900">位置: </dt>
            <dd className="inline">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </dd>
          </div>
          <div>
            <dt className="inline font-semibold text-slate-900">有効期限: </dt>
            <dd className="inline">{expiresAt.toLocaleString("ja-JP")}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export function isQrPayloadValid(payload: QrRelayPayload): boolean {
  return Date.now() - payload.ts <= QR_TTL_MS;
}
