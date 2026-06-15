/** 救助要請（SOS）と避難所マスターの責務分離用フィルタ */

const SHELTER_TITLE_RE = /^【避難所】|^避難所[：:・\s]/u;

export function isSosEmergencyTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return false;
  if (SHELTER_TITLE_RE.test(t)) return false;
  if (t.includes("避難所") && !t.includes("救助") && !t.includes("要請")) return false;
  return true;
}

export function filterSosEmergencies<T extends { title: string }>(rows: T[]): T[] {
  return rows.filter((row) => isSosEmergencyTitle(row.title));
}
