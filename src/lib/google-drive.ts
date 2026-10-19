const FILE_NAME = "hk-life-trip.backup.json";
const FOLDER_NAME = "HK Life Money";
const SHARE_SCOPE = "https://www.googleapis.com/auth/drive";
const CLIENT_KEY = "tripbook-google-client-id";
const DEFAULT_GOOGLE_CLIENT_ID = "214174071830-9t6rvidpsa16qgeminojphr5tld9vmq2.apps.googleusercontent.com";
const FOLDER_ID_KEY = "hk-life-trip-folder-id";
const FILE_ID_KEY = "hk-life-trip-file-id";
const ACTION_KEY = "tripbook-drive-action";
const TOKEN_KEY = "tripbook-drive-token";
const TOKEN_EXP_KEY = "tripbook-drive-token-exp";
const GRANTED_KEY = "tripbook-drive-granted";
const SCOPE_KEY = "tripbook-drive-share-scope";

export type DriveAction = "sync" | "share";

export function readGoogleClientId(): string {
  try {
    return localStorage.getItem(CLIENT_KEY)?.trim() || DEFAULT_GOOGLE_CLIENT_ID;
  } catch {
    return DEFAULT_GOOGLE_CLIENT_ID;
  }
}

export function writeGoogleClientId(id: string) {
  writeStored(CLIENT_KEY, id.trim());
}

export function readDriveFileId(): string {
  return readStored(FILE_ID_KEY);
}

export function writeDriveFileId(id: string) {
  writeStored(FILE_ID_KEY, id.trim());
}

export function shareScopeEnabled(): boolean {
  return readStored(SCOPE_KEY) === "1";
}

export function writeShareScope(on: boolean) {
  writeStored(SCOPE_KEY, on ? "1" : "");
  clearAccessToken();
}

function scope(): string {
  return SHARE_SCOPE;
}

function readStored(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStored(key: string, id: string) {
  try {
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function redirectUri(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function hasDriveGrant(): boolean {
  return readStored(GRANTED_KEY) === "1";
}

export function startGoogleSignIn(action: DriveAction): void {
  const clientId = readGoogleClientId();
  if (!clientId) throw new Error("client");
  sessionStorage.setItem(ACTION_KEY, action);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(),
    response_type: "token",
    scope: scope(),
    include_granted_scopes: "true",
  });
  if (!hasDriveGrant()) params.set("prompt", "select_account consent");
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

export function takePendingDriveAction(): DriveAction | null {
  const action = sessionStorage.getItem(ACTION_KEY);
  if (action === "sync" || action === "share") {
    sessionStorage.removeItem(ACTION_KEY);
    return action;
  }
  return null;
}

export function takeRedirectToken(): string | null {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash.includes("access_token") && !hash.includes("error=")) return null;
  const params = new URLSearchParams(hash);
  const token = params.get("access_token");
  const err = params.get("error");
  const expires = Number(params.get("expires_in") ?? "3600");
  history.replaceState(null, "", window.location.pathname + window.location.search);
  if (err) throw new Error(err);
  if (token) rememberAccessToken(token, expires);
  return token;
}

let memToken = "";
let memExp = 0;

export function rememberAccessToken(token: string, expiresIn = 3500) {
  memToken = token;
  memExp = Date.now() + Math.max(60, expiresIn - 60) * 1000;
  try {
    localStorage.setItem(GRANTED_KEY, "1");
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(TOKEN_EXP_KEY, String(memExp));
  } catch {
    /* ignore */
  }
}

export function clearAccessToken() {
  memToken = "";
  memExp = 0;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
  } catch {
    /* ignore */
  }
}

export function storedAccessToken(): string | null {
  if (memToken && Date.now() < memExp) return memToken;
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const exp = Number(sessionStorage.getItem(TOKEN_EXP_KEY) || "0");
    if (!token || Date.now() > exp) return null;
    memToken = token;
    memExp = exp;
    return token;
  } catch {
    return null;
  }
}

type GisClient = { requestAccessToken: (opts: { prompt: string }) => void };

function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-trip-gis]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("gis")));
      return;
    }
    const el = document.createElement("script");
    el.src = "https://accounts.google.com/gsi/client";
    el.async = true;
    el.dataset.tripGis = "1";
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("gis"));
    document.head.appendChild(el);
  });
}

export async function requestSilentToken(): Promise<string | null> {
  const existing = storedAccessToken();
  if (existing) return existing;
  const clientId = readGoogleClientId();
  if (!clientId || !hasDriveGrant()) return null;
  try {
    await loadGis();
  } catch {
    return null;
  }
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) return null;
  return new Promise((resolve) => {
    let done = false;
    const finish = (token: string | null) => {
      if (done) return;
      done = true;
      resolve(token);
    };
    const timer = window.setTimeout(() => finish(null), 6000);
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope: scope(),
      callback: (resp: { access_token?: string; expires_in?: number }) => {
        window.clearTimeout(timer);
        if (resp.access_token) {
          rememberAccessToken(resp.access_token, resp.expires_in ?? 3500);
          finish(resp.access_token);
          return;
        }
        finish(null);
      },
      error_callback: () => {
        window.clearTimeout(timer);
        finish(null);
      },
    }) as GisClient;
    try {
      client.requestAccessToken({ prompt: "none" });
    } catch {
      window.clearTimeout(timer);
      finish(null);
    }
  });
}

export async function getAccessToken(): Promise<string | null> {
  return storedAccessToken() ?? (await requestSilentToken());
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (opts: Record<string, unknown>) => GisClient;
        };
      };
    };
  }
}

async function driveFetch(url: string, token: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearAccessToken();
    throw new Error("auth");
  }
  if (res.status === 404) throw new Error("missing");
  if (!res.ok) throw new Error(`drive ${res.status}`);
  return res;
}

async function ensureFolder(token: string): Promise<string> {
  const known = readStored(FOLDER_ID_KEY);
  if (known) return known;
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const found = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`,
    token,
  );
  const data = (await found.json()) as { files?: { id: string }[] };
  const existing = data.files?.[0]?.id;
  if (existing) {
    writeStored(FOLDER_ID_KEY, existing);
    return existing;
  }
  const created = await driveFetch("https://www.googleapis.com/drive/v3/files", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const folder = (await created.json()) as { id: string };
  writeStored(FOLDER_ID_KEY, folder.id);
  return folder.id;
}

async function findNamedFile(token: string, folder: string): Promise<string> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and '${folder}' in parents and trashed=false`);
  const res = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,modifiedTime)&pageSize=5`,
    token,
  );
  const data = (await res.json()) as { files?: { id: string }[] };
  return data.files?.[0]?.id ?? "";
}

export async function ensureDriveFile(token: string): Promise<string> {
  const known = readDriveFileId();
  if (known) return known;
  const folder = await ensureFolder(token);
  const found = await findNamedFile(token, folder);
  if (found) {
    writeDriveFileId(found);
    return found;
  }
  return "";
}

async function uploadTo(token: string, body: string, existing: string, folder: string) {
  const meta = existing
    ? { name: FILE_NAME, mimeType: "application/json" }
    : { name: FILE_NAME, mimeType: "application/json", parents: [folder] };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
  form.append("file", new Blob([body], { type: "application/json" }));
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  const res = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (res.status === 401) {
    clearAccessToken();
    throw new Error("auth");
  }
  if (res.status === 404) throw new Error("missing");
  if (!res.ok) throw new Error(`drive ${res.status}`);
  const saved = (await res.json()) as { id?: string };
  if (saved.id) writeDriveFileId(saved.id);
  return saved.id || existing;
}

export async function uploadTripFile(token: string, body: string): Promise<string> {
  const existing = await ensureDriveFile(token);
  const folder = existing ? "" : await ensureFolder(token);
  return uploadTo(token, body, existing, folder);
}

export async function downloadTripFile(token: string): Promise<{ id: string; text: string; modifiedTime: string }> {
  const id = await ensureDriveFile(token);
  if (!id) throw new Error("missing");
  const meta = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${id}?fields=id,modifiedTime`,
    token,
  );
  const info = (await meta.json()) as { id: string; modifiedTime?: string };
  const media = await driveFetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, token);
  return { id: info.id, text: await media.text(), modifiedTime: info.modifiedTime ?? "" };
}

export async function shareTripFile(token: string, email: string): Promise<string> {
  const id = await ensureDriveFile(token);
  if (!id) throw new Error("missing");
  await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${id}/permissions?sendNotificationEmail=true`,
    token,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "writer", type: "user", emailAddress: email }),
    },
  );
  return id;
}
