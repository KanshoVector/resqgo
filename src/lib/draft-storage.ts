const DB_NAME = "resqgo";
const STORE_NAME = "drafts";
const DRAFT_KEY = "emergency-form";
const LS_KEY = "resqgo-emergency-draft";

export type EmergencyFormDraft = {
  title: string;
  description: string;
  contact_info: string;
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(): Promise<EmergencyFormDraft | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(DRAFT_KEY);
    request.onsuccess = () => resolve((request.result as EmergencyFormDraft) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(draft: EmergencyFormDraft): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(draft, DRAFT_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function idbDelete(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(DRAFT_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function lsGet(): EmergencyFormDraft | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as EmergencyFormDraft) : null;
  } catch {
    return null;
  }
}

function lsSet(draft: EmergencyFormDraft): void {
  localStorage.setItem(LS_KEY, JSON.stringify(draft));
}

function lsDelete(): void {
  localStorage.removeItem(LS_KEY);
}

export async function saveDraft(draft: EmergencyFormDraft): Promise<void> {
  try {
    await idbSet(draft);
  } catch {
    lsSet(draft);
  }
}

export async function loadDraft(): Promise<EmergencyFormDraft | null> {
  try {
    const draft = await idbGet();
    if (draft) return draft;
  } catch {
    /* fall through to localStorage */
  }
  return lsGet();
}

export async function clearDraft(): Promise<void> {
  try {
    await idbDelete();
  } catch {
    /* fall through */
  }
  lsDelete();
}
