"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  PublicEmergencyLocation,
  PublicEvacuationCenter,
  SupporterEmergencyLocation,
} from "@/lib/types/public";
import {
  fetchAllMapPins,
  searchEmergency as searchEmergencyAction,
  toPublicEmergency,
} from "@/actions/search-emergency";
import { searchEvacuationCenters } from "@/actions/evacuation-centers";
import type { FilterState } from "@/components/FilterBar";

type FeedState = {
  emergencies: SupporterEmergencyLocation[];
  shelters: PublicEvacuationCenter[];
  mapEmergencies: PublicEmergencyLocation[];
  mapShelters: PublicEvacuationCenter[];
  mapFallbackActive: boolean;
  loading: boolean;
  error: string | null;
};

export function useEmergencyFeed(
  lat: number | null,
  lng: number | null,
  radiusMeters: number,
  priority: FilterState["priority"],
  shelterStatus: FilterState["shelterStatus"],
  isAuthenticated: boolean,
) {
  const [state, setState] = useState<FeedState>({
    emergencies: [],
    shelters: [],
    mapEmergencies: [],
    mapShelters: [],
    mapFallbackActive: false,
    loading: false,
    error: null,
  });
  const supabaseRef = useRef(createBrowserSupabaseClient());

  const fetchFeed = useCallback(async () => {
    if (lat === null || lng === null || !isAuthenticated) {
      setState({
        emergencies: [],
        shelters: [],
        mapEmergencies: [],
        mapShelters: [],
        mapFallbackActive: false,
        loading: false,
        error: null,
      });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    const searchInput = {
      lat,
      lng,
      radiusMeters,
      priority: priority === "all" ? undefined : priority,
      shelterStatus: shelterStatus === "all" ? undefined : shelterStatus,
    };

    const [emResult, shResult] = await Promise.all([
      searchEmergencyAction(searchInput),
      searchEvacuationCenters(searchInput),
    ]);

    if (!emResult.ok || !shResult.ok) {
      const errMsg = !emResult.ok
        ? emResult.message
        : !shResult.ok
          ? shResult.message
          : "データの取得に失敗しました。";
      setState({
        emergencies: [],
        shelters: [],
        mapEmergencies: [],
        mapShelters: [],
        mapFallbackActive: false,
        loading: false,
        error: errMsg,
      });
      return;
    }

    let emergencies = emResult.data;
    let shelters = shResult.data;
    let mapEmergencies = emergencies.map(toPublicEmergency);
    let mapShelters = shelters;
    let mapFallbackActive = false;

    if (emergencies.length + shelters.length === 0) {
      const expandedInput = { ...searchInput, radiusMeters: 50000 };
      const [emWide, shWide] = await Promise.all([
        searchEmergencyAction(expandedInput),
        searchEvacuationCenters(expandedInput),
      ]);

      if (emWide.ok && shWide.ok && emWide.data.length + shWide.data.length > 0) {
        mapEmergencies = emWide.data.map(toPublicEmergency);
        mapShelters = shWide.data;
        mapFallbackActive = true;
      } else {
        const allPins = await fetchAllMapPins();
        if (allPins.ok && allPins.data.emergencies.length + allPins.data.shelters.length > 0) {
          mapEmergencies = allPins.data.emergencies.map(toPublicEmergency);
          mapShelters = allPins.data.shelters;
          mapFallbackActive = true;
        }
      }
    }

    setState({
      emergencies,
      shelters,
      mapEmergencies,
      mapShelters,
      mapFallbackActive,
      loading: false,
      error: null,
    });
  }, [lat, lng, radiusMeters, priority, shelterStatus, isAuthenticated]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    if (!isAuthenticated || lat === null || lng === null) return;

    const channel = supabaseRef.current
      .channel("emergency_locations_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "emergency_locations" },
        () => {
          fetchFeed();
        },
      )
      .subscribe();

    return () => {
      supabaseRef.current.removeChannel(channel);
    };
  }, [fetchFeed, isAuthenticated, lat, lng]);

  return { ...state, retry: fetchFeed };
}
