/**
 * Firestore → Supabase migration bridge
 *
 * Maps legacy iOS app (Firestore) JSON documents to PostGIS-ready
 * Supabase insert payloads. Implement importers against this interface
 * when running a bulk migration.
 */

import type { EmergencyPriority, ShelterStatus } from "@/lib/types/public";

/** Legacy Firestore: app_users/{uid} */
export type FirestoreAppUser = {
  uid: string;
  email?: string;
  displayName?: string;
  role?: "user" | "shelter_admin";
  createdAt?: string | { _seconds: number };
};

/** Legacy Firestore: requests/{id} */
export type FirestoreRequest = {
  id: string;
  title: string;
  description?: string;
  contactInfo?: string;
  priority?: "high" | "medium" | "low";
  status?: string;
  createdBy?: string;
  /** GeoPoint or [lat, lng] or { latitude, longitude } */
  location:
    | { latitude: number; longitude: number }
    | { _latitude: number; _longitude: number }
    | [number, number]
    | { lat: number; lng: number };
  createdAt?: string | { _seconds: number };
};

/** Legacy Firestore: shelters/{id} */
export type FirestoreShelter = {
  id: string;
  name: string;
  address?: string;
  capacity?: number;
  currentOccupancy?: number;
  status?: "open" | "full" | "closed";
  location:
    | { latitude: number; longitude: number }
    | { _latitude: number; _longitude: number }
    | [number, number]
    | { lat: number; lng: number };
  createdAt?: string | { _seconds: number };
};

export type SupabaseProfileInsert = {
  id: string;
  role: "user" | "shelter_admin";
  display_name: string | null;
};

export type SupabaseEmergencyInsert = {
  id?: string;
  title: string;
  description: string | null;
  contact_info: string | null;
  priority: EmergencyPriority;
  status: string;
  created_by: string | null;
  created_at?: string;
  location: string;
};

export type SupabaseShelterInsert = {
  id?: string;
  name: string;
  address: string | null;
  capacity: number | null;
  current_occupancy: number;
  facility_status: ShelterStatus;
  created_at?: string;
  location: string;
};

export type MigrationBatch = {
  profiles: SupabaseProfileInsert[];
  emergencies: SupabaseEmergencyInsert[];
  shelters: SupabaseShelterInsert[];
};

export interface FirestoreMigrationBridge {
  mapUser(doc: FirestoreAppUser): SupabaseProfileInsert;
  mapRequest(doc: FirestoreRequest): SupabaseEmergencyInsert;
  mapShelter(doc: FirestoreShelter): SupabaseShelterInsert;
  mapBatch(users: FirestoreAppUser[], requests: FirestoreRequest[], shelters: FirestoreShelter[]): MigrationBatch;
}

export function extractLatLng(
  location: FirestoreRequest["location"] | FirestoreShelter["location"],
): { lat: number; lng: number } {
  if (Array.isArray(location)) {
    return { lat: location[0], lng: location[1] };
  }
  if ("latitude" in location && "longitude" in location) {
    return { lat: location.latitude, lng: location.longitude };
  }
  if ("_latitude" in location && "_longitude" in location) {
    return { lat: location._latitude, lng: location._longitude };
  }
  return { lat: location.lat, lng: location.lng };
}

export function toPostgisPoint(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

export function parseFirestoreTimestamp(
  ts?: string | { _seconds: number },
): string | undefined {
  if (!ts) return undefined;
  if (typeof ts === "string") return ts;
  return new Date(ts._seconds * 1000).toISOString();
}

export class DefaultFirestoreMigrationBridge implements FirestoreMigrationBridge {
  mapUser(doc: FirestoreAppUser): SupabaseProfileInsert {
    return {
      id: doc.uid,
      role: doc.role ?? "user",
      display_name: doc.displayName ?? doc.email ?? null,
    };
  }

  mapRequest(doc: FirestoreRequest): SupabaseEmergencyInsert {
    const { lat, lng } = extractLatLng(doc.location);
    return {
      id: doc.id,
      title: doc.title,
      description: doc.description ?? null,
      contact_info: doc.contactInfo ?? null,
      priority: doc.priority ?? "medium",
      status: doc.status ?? "open",
      created_by: doc.createdBy ?? null,
      created_at: parseFirestoreTimestamp(doc.createdAt),
      location: toPostgisPoint(lat, lng),
    };
  }

  mapShelter(doc: FirestoreShelter): SupabaseShelterInsert {
    const { lat, lng } = extractLatLng(doc.location);
    return {
      id: doc.id,
      name: doc.name,
      address: doc.address ?? null,
      capacity: doc.capacity ?? null,
      current_occupancy: doc.currentOccupancy ?? 0,
      facility_status: doc.status ?? "open",
      created_at: parseFirestoreTimestamp(doc.createdAt),
      location: toPostgisPoint(lat, lng),
    };
  }

  mapBatch(
    users: FirestoreAppUser[],
    requests: FirestoreRequest[],
    shelters: FirestoreShelter[],
  ): MigrationBatch {
    return {
      profiles: users.map((u) => this.mapUser(u)),
      emergencies: requests.map((r) => this.mapRequest(r)),
      shelters: shelters.map((s) => this.mapShelter(s)),
    };
  }
}

export const firestoreMigrationBridge: FirestoreMigrationBridge =
  new DefaultFirestoreMigrationBridge();

/** Mock: preview a migration batch without writing to DB */
export function previewMigrationBatch(
  users: FirestoreAppUser[],
  requests: FirestoreRequest[],
  shelters: FirestoreShelter[],
): MigrationBatch {
  return firestoreMigrationBridge.mapBatch(users, requests, shelters);
}
