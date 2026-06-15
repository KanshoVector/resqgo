"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type {
  PublicEmergencyLocation,
  PublicEvacuationCenter,
} from "@/lib/types/public";
import { searchEmergency as searchEmergencyAction } from "@/actions/search-emergency";
import { searchEvacuationCenters } from "@/actions/evacuation-centers";
import type { FilterState } from "@/components/FilterBar";

type FeedState = {
  emergencies: PublicEmergencyLocation[];
  shelters: PublicEvacuationCenter[];
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
    loading: false,
    error: null,
  });
  const supabaseRef = useRef(createBrowserSupabaseClient());

  const fetchFeed = useCallback(async () => {
    if (lat === null || lng === null || !isAuthenticated) {
      setState({ emergencies: [], shelters: [], loading: false, error: null });
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
        loading: false,
        error: errMsg,
      });
      return;
    }

    setState({
      emergencies: emResult.data,
      shelters: shResult.data,
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
