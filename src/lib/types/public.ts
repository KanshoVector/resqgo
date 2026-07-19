/** Map / 公開面 — contact_info を含めない */

export type EmergencyPriority = "high" | "medium" | "low";

export type PublicEmergencyLocation = {
  id: string;
  title: string;
  description: string | null;
  location: unknown;
  status: string;
  priority: EmergencyPriority;
  created_by: string | null;
  created_at: string;
};

/** ログイン支援者向け一覧 — RPC 経由のみ contact_info を付与 */
export type SupporterEmergencyLocation = PublicEmergencyLocation & {
  contact_info: string | null;
};

export type ShelterStatus = "open" | "full" | "closed";

export type PublicEvacuationCenter = {
  id: string;
  name: string;
  address: string | null;
  location: unknown;
  capacity: number | null;
  current_occupancy: number;
  facility_status: ShelterStatus;
  created_at: string;
};

export type UserRole = "user" | "shelter_admin";
