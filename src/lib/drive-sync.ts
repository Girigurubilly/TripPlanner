import {
  downloadTripFile,
  readGoogleClientId,
  rememberAccessToken,
  requestSilentToken,
  storedAccessToken,
  uploadTripFile,
} from "@/lib/google-drive";
import {
  exportChecks,
  exportNotes,
  exportVisits,
  loadTrips,
  localEditedAt,
  replaceLibrary,
  type CheckMap,
  type NoteMap,
  type TripBook,
  type VisitMap,
} from "@/lib/trip";

const PASS_KEY = "tripbook-drive-pass";
const DAILY_KEY = "tripbook-drive-daily";

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export async function syncTripDriveIfDue(): Promise<SyncResult | "skip"> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  try {
    if (localStorage.getItem(DAILY_KEY) === todayKey()) return "skip";
  } catch {
    return "skip";
  }
  if (!readDrivePass() || !readGoogleClientId()) return "skip";
  const result = await syncTripDrive();
  if (result !== "offline") {
    try {
      localStorage.setItem(DAILY_KEY, todayKey());
    } catch {
      /* ignore */
    }
  }
  return result;
}

export type TripSnapshot = {
  schemaVersion: 1;
  kind: "trip-book";
  exportedAt: string;
  trips: TripBook[];
  notes: NoteMap;
  checks?: CheckMap;
  visits?: VisitMap;
};

export type SyncResult = "pulled" | "pushed" | "ok" | "offline" | "need-auth" | "need-pass" | "missing" | "fail";

export function readDrivePass(): string {
  try {
    return localStorage.getItem(PASS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeDrivePass(password: string) {
  try {
    if (password) localStorage.setItem(PASS_KEY, password);
    else localStorage.removeItem(PASS_KEY);
  } catch {
    /* ignore */
  }
}

export function exportSnapshot(): TripSnapshot {
  return {
    schemaVersion: 1,
    kind: "trip-book",
    exportedAt: new Date().toISOString(),
    trips: loadTrips(),
    notes: exportNotes(),
    checks: exportChecks(),
    visits: exportVisits(),
  };
}

async function deriveKey(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 120_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function b64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => {
    s += String.fromCharCode(b);
  });
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encodeDriveBody(snap: TripSnapshot, password: string): Promise<string> {
  if (!password) throw new Error("pass");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(snap)));
  return JSON.stringify({
    v: 1,
    kind: "trip-book-encrypted",
    alg: "AES-GCM",
    salt: b64(salt),
    iv: b64(iv),
    data: b64(new Uint8Array(cipher)),
  });
}

function isEncrypted(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as { kind?: string; data?: string };
    return parsed.kind === "trip-book-encrypted" && Boolean(parsed.data);
  } catch {
    return false;
  }
}

export async function decodeDriveBody(text: string, password: string): Promise<TripSnapshot> {
  let json = text;
  if (isEncrypted(text)) {
    if (!password) throw new Error("pass");
    const parsed = JSON.parse(text) as { salt: string; iv: string; data: string };
    try {
      const key = await deriveKey(password, fromB64(parsed.salt));
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromB64(parsed.iv) as BufferSource },
        key,
        fromB64(parsed.data) as BufferSource,
      );
      json = new TextDecoder().decode(plain);
    } catch {
      throw new Error("bad-pass");
    }
  }
  const data = JSON.parse(json) as TripSnapshot;
  if (data.kind !== "trip-book" || !Array.isArray(data.trips)) throw new Error("format");
  return data;
}

export async function syncTripDrive(): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  if (!readGoogleClientId()) return "need-auth";
  const password = readDrivePass();
  if (!password) return "need-pass";
  const token = storedAccessToken() ?? (await requestSilentToken());
  if (!token) return "need-auth";
  rememberAccessToken(token);

  let remote: { text: string; modifiedTime: string } | null = null;
  try {
    remote = await downloadTripFile(token);
  } catch (err) {
    if ((err as Error).message !== "missing") return "fail";
  }

  if (!remote) {
    const snap = exportSnapshot();
    await uploadTripFile(token, await encodeDriveBody(snap, password));
    return "pushed";
  }

  let decoded: TripSnapshot;
  try {
    decoded = await decodeDriveBody(remote.text, password);
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === "pass" || msg === "bad-pass") return "need-pass";
    return "fail";
  }

  const localAt = localEditedAt();
  const remoteAt = decoded.exportedAt || remote.modifiedTime;
  if (localAt && remoteAt && localAt > remoteAt) {
    const snap = exportSnapshot();
    await uploadTripFile(token, await encodeDriveBody(snap, password));
    return "pushed";
  }
  if (!localAt || (remoteAt && remoteAt > localAt)) {
    replaceLibrary(decoded.trips, decoded.notes || {}, remoteAt || new Date().toISOString(), decoded.checks, decoded.visits);
    return "pulled";
  }
  return "ok";
}
