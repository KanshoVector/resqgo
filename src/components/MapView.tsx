"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { MapPin, Navigation } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  fetchDirectionsPolyline,
  getGoogleMapsApiKey,
  parseGeoLocation,
  PRIORITY_COLORS,
  SHELTER_STATUS_COLORS,
} from "@/lib/geo";
import type {
  PublicEmergencyLocation,
  PublicEvacuationCenter,
} from "@/lib/types/public";

type MapViewProps = {
  pinPosition: { lat: number; lng: number } | null;
  onPinMove: (lat: number, lng: number) => void;
  adjustMode: boolean;
  emergencies: PublicEmergencyLocation[];
  shelters: PublicEvacuationCenter[];
  routeDestination: { lat: number; lng: number; label: string } | null;
  onClearRoute: () => void;
};

const DEFAULT_CENTER = { lat: 35.6812, lng: 139.7671 };

export function MapView({
  pinPosition,
  onPinMove,
  adjustMode,
  emergencies,
  shelters,
  routeDestination,
  onClearRoute,
}: MapViewProps) {
  const pinLat = pinPosition?.lat ?? null;
  const pinLng = pinPosition?.lng ?? null;
  const routeLat = routeDestination?.lat ?? null;
  const routeLng = routeDestination?.lng ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pinMarkerRef = useRef<google.maps.Marker | null>(null);
  const emergencyMarkersRef = useRef<google.maps.Marker[]>([]);
  const shelterMarkersRef = useRef<google.maps.Marker[]>([]);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const adjustModeRef = useRef(adjustMode);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      setMapError("地図を表示するための設定が不足しています。");
      return;
    }

    let cancelled = false;
    setOptions({ key: apiKey, v: "weekly" });

    Promise.all([importLibrary("maps"), importLibrary("routes")])
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const map = new google.maps.Map(containerRef.current, {
          center: pinPosition ?? DEFAULT_CENTER,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER,
          },
          gestureHandling: "cooperative",
        });
        infoWindowRef.current = new google.maps.InfoWindow();
        mapRef.current = map;
        setMapReady(true);
      })
      .catch((err: unknown) => {
        console.error("[MapView] load failed:", err);
        setMapError("地図の読み込みに失敗しました。");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    adjustModeRef.current = adjustMode;
  }, [adjustMode]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    if (clickListenerRef.current) {
      google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }

    if (adjustMode) {
      clickListenerRef.current = mapRef.current.addListener(
        "click",
        (e: google.maps.MapMouseEvent) => {
          if (!adjustModeRef.current || !e.latLng) return;
          onPinMove(e.latLng.lat(), e.latLng.lng());
        },
      );
    }

    return () => {
      if (clickListenerRef.current) {
        google.maps.event.removeListener(clickListenerRef.current);
        clickListenerRef.current = null;
      }
    };
  }, [adjustMode, mapReady, onPinMove]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || pinLat === null || pinLng === null) return;

    const position = { lat: pinLat, lng: pinLng };
    mapRef.current.setCenter(position);

    if (!pinMarkerRef.current) {
      pinMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position,
        draggable: adjustMode,
        title: "現在地・投稿位置",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: "#dc2626",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
      });
      pinMarkerRef.current.addListener("dragend", () => {
        if (!adjustMode) return;
        const pos = pinMarkerRef.current?.getPosition();
        if (pos) onPinMove(pos.lat(), pos.lng());
      });
    } else {
      pinMarkerRef.current.setPosition(position);
      pinMarkerRef.current.setDraggable(adjustMode);
    }
  }, [adjustMode, mapReady, onPinMove, pinLat, pinLng]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    emergencyMarkersRef.current.forEach((m) => m.setMap(null));
    emergencyMarkersRef.current = [];

    emergencies.forEach((emergency) => {
      const coords = parseGeoLocation(emergency.location);
      if (!coords) return;

      const marker = new google.maps.Marker({
        map: mapRef.current!,
        position: coords,
        title: emergency.title,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: PRIORITY_COLORS[emergency.priority],
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        if (!infoWindowRef.current || !mapRef.current) return;
        infoWindowRef.current.setContent(`
          <div style="font-family:sans-serif;max-width:220px;color:#0f172a">
            <strong>${escapeHtml(emergency.title)}</strong>
            <p style="font-size:12px;margin:4px 0">緊急度: ${emergency.priority}</p>
            ${emergency.description ? `<p style="font-size:12px">${escapeHtml(emergency.description)}</p>` : ""}
          </div>`);
        infoWindowRef.current.open({ map: mapRef.current, anchor: marker });
      });

      emergencyMarkersRef.current.push(marker);
    });
  }, [emergencies, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    shelterMarkersRef.current.forEach((m) => m.setMap(null));
    shelterMarkersRef.current = [];

    shelters.forEach((shelter) => {
      const coords = parseGeoLocation(shelter.location);
      if (!coords) return;

      const marker = new google.maps.Marker({
        map: mapRef.current!,
        position: coords,
        title: shelter.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: SHELTER_STATUS_COLORS[shelter.facility_status],
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        if (!infoWindowRef.current || !mapRef.current) return;
        infoWindowRef.current.setContent(`
          <div style="font-family:sans-serif;max-width:220px;color:#0f172a">
            <strong>${escapeHtml(shelter.name)}</strong>
            <p style="font-size:12px;margin:4px 0">${escapeHtml(shelter.address ?? "")}</p>
            <a href="/evacuation-centers/${shelter.id}" style="font-size:12px;color:#2563eb">詳細を見る</a>
          </div>`);
        infoWindowRef.current.open({ map: mapRef.current, anchor: marker });
      });

      shelterMarkersRef.current.push(marker);
    });
  }, [shelters, mapReady]);

  useEffect(() => {
    if (
      !mapReady ||
      !mapRef.current ||
      pinLat === null ||
      pinLng === null ||
      routeLat === null ||
      routeLng === null
    ) {
      routeLineRef.current?.setMap(null);
      routeLineRef.current = null;
      return;
    }

    const origin = { lat: pinLat, lng: pinLng };
    const destination = { lat: routeLat, lng: routeLng };

    fetchDirectionsPolyline(origin, destination).then((path) => {
      routeLineRef.current?.setMap(null);
      if (!path || !mapRef.current) return;

      routeLineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#2563eb",
        strokeOpacity: 0.9,
        strokeWeight: 5,
        map: mapRef.current,
      });

      const bounds = new google.maps.LatLngBounds();
      bounds.extend(origin);
      bounds.extend(destination);
      mapRef.current.fitBounds(bounds, 48);
    });
  }, [mapReady, pinLat, pinLng, routeLat, routeLng]);

  if (mapError) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center text-red-700">
        <p className="font-semibold">{mapError}</p>
      </div>
    );
  }

  return (
    <div className="relative touch-pan-y">
      {adjustMode && (
        <div className="absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] rounded-lg border-2 border-amber-500 bg-amber-100 px-2.5 py-1.5 text-[11px] font-bold leading-snug text-amber-900 shadow sm:left-3 sm:top-3 sm:px-3 sm:text-xs">
          <MapPin className="mb-0.5 inline h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
          位置微調整モード — 地図タップまたはピンドラッグで変更
        </div>
      )}
      {routeDestination && (
        <div className="absolute right-2 top-2 z-10 max-w-[calc(100%-1rem)] rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-900 shadow sm:right-3 sm:top-3 sm:px-3 sm:text-xs">
          <Navigation className="mb-0.5 inline h-3.5 w-3.5 sm:h-4 sm:w-4" />
          経路: {routeDestination.label}
          <button
            type="button"
            onClick={onClearRoute}
            className="ml-1 underline hover:no-underline"
          >
            解除
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        className="h-[min(60vh,28rem)] min-h-[16rem] w-full rounded-xl border border-slate-300 shadow-sm sm:h-96 md:min-h-[20rem]"
        role="application"
        aria-label="防災地図"
      />
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
