import { useEffect, useState } from "react";
import { Cloud } from "lucide-react";
import { readDrivePass, syncTripDrive, writeDrivePass, type SyncResult } from "@/lib/drive-sync";
import {
  readDriveFileId,
  readGoogleClientId,
  redirectUri,
  shareScopeEnabled,
  shareTripFile,
  startGoogleSignIn,
  storedAccessToken,
  takePendingDriveAction,
  takeRedirectToken,
  writeDriveFileId,
  writeShareScope,
} from "@/lib/google-drive";

const RESULT: Record<SyncResult, string> = {
  pulled: "已從 Google Drive 下載較新嘅行程。",
  pushed: "已將呢部機嘅行程同步上 Google Drive。",
  ok: "兩邊已經一樣，冇需要更新。",
  offline: "而家冇網絡。",
  "need-auth": "Google 登入未完成。",
  "need-pass": "請先設定密碼。兩部機要一樣。",
  missing: "Drive 未有行程檔。",
  fail: "同步失敗。請再登入一次。",
};

export function DrivePanel({ onLibraryChange }: { onLibraryChange: () => void }) {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fileId, setFileId] = useState("");
  const [shareMode, setShareMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setPassword(readDrivePass());
    setFileId(readDriveFileId());
    setShareMode(shareScopeEnabled());
    let token: string | null = null;
    try {
      token = takeRedirectToken();
    } catch {
      setMessage("Google 登入取消咗。");
      return;
    }
    if (!token) return;
    const action = takePendingDriveAction() ?? "sync";
    setBusy(true);
    void run(action, token).finally(() => setBusy(false));
    // restore after Google redirects back to this page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveFields() {
    writeDrivePass(password.trim());
    writeDriveFileId(fileId.trim());
  }

  async function run(action: "sync" | "share", token: string) {
    try {
      if (action === "share") {
        const who = email.trim();
        if (!who.includes("@")) {
          setMessage("請輸入老婆嘅 Gmail。");
          return;
        }
        const synced = await syncTripDrive();
        if (synced === "need-auth") {
          startGoogleSignIn("share");
          return;
        }
        if (synced === "need-pass") {
          setMessage(RESULT["need-pass"]);
          return;
        }
        if (synced === "fail" || synced === "offline") {
          setMessage(RESULT[synced]);
          return;
        }
        const id = await shareTripFile(token, who);
        setFileId(id);
        if (synced === "pulled") onLibraryChange();
        setMessage(`已共享。請老婆喺佢部機貼上檔案 ID：${id}`);
        return;
      }
      const result = await syncTripDrive();
      if (result === "need-auth") {
        startGoogleSignIn("sync");
        return;
      }
      setFileId(readDriveFileId());
      setMessage(RESULT[result]);
      if (result === "pulled") onLibraryChange();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "auth") {
        try {
          startGoogleSignIn(action);
          return;
        } catch {
          setMessage("Google 登入失敗。請核對 Google Cloud 嘅 Redirect URI。");
          return;
        }
      }
      if (msg === "missing") {
        setMessage(
          shareMode
            ? "搵唔到共用檔。請核對檔案 ID，同埋個 Gmail 已經有權限。"
            : "讀唔到另一個帳號共享嘅檔。請打開「同另一個 Google 帳號共用」，再同步一次。",
        );
        return;
      }
      if (msg === "pass" || msg === "bad-pass") {
        setMessage("密碼不對。兩部機要用同一組密碼。");
        return;
      }
      setMessage("同步失敗。請再試。");
    }
  }

  async function begin(action: "sync" | "share") {
    saveFields();
    if (!readGoogleClientId()) {
      setMessage("未有 Google Client ID。");
      return;
    }
    if (!password.trim()) {
      setMessage("請設定密碼。檔案會加密，老婆部機要打同一組。");
      return;
    }
    setBusy(true);
    try {
      const token = storedAccessToken();
      if (token) {
        await run(action, token);
        return;
      }
      startGoogleSignIn(action);
    } catch {
      setMessage("開唔到 Google 登入。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="drive" id="drive-sync">
      <summary>
        <Cloud size={16} aria-hidden="true" />
        Google Drive 同步
      </summary>
      <div className="drive-body">
        <p className="tiny">
          Google Client ID 已內置。行程同筆記會加密後放到理財 App 同一個資料夾
          <code>HK Life Money/hk-life-trip.backup.json</code>。密碼要同理財 App 的 Drive 密碼一樣，主畫面兩個圖示先睇到同一份。
        </p>
        <label className="drive-field">
          加密密碼
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="off"
            placeholder="同理財 App 的 Drive 密碼"
          />
        </label>
        <p className="tiny">
          Redirect URI 要加到 Google Cloud：<code>{typeof window === "undefined" ? "" : redirectUri()}</code>
        </p>
        <button className="btn primary" type="button" disabled={busy} onClick={() => void begin("sync")}>
          {busy ? "處理緊…" : "同步呢部機"}
        </button>
        <label className="drive-check">
          <input
            type="checkbox"
            checked={shareMode}
            onChange={(event) => {
              const on = event.target.checked;
              setShareMode(on);
              writeShareScope(on);
            }}
          />
          同另一個 Google 帳號共用
        </label>
        <p className="tiny">
          你同老婆唔同 Gmail 先需要開。Google 可能話呢個 app 未驗證，撳進階再繼續。兩邊都開呢個選項，用同一個
          密碼同檔案 ID。
        </p>
        <label className="drive-field">
          老婆 Gmail
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="off"
            placeholder="name@gmail.com"
          />
        </label>
        <button className="btn" type="button" disabled={busy} onClick={() => void begin("share")}>
          共享呢份檔案
        </button>
        <label className="drive-field">
          檔案 ID
          <input
            value={fileId}
            onChange={(event) => setFileId(event.target.value)}
            autoComplete="off"
            placeholder="同步後會出現，老婆部機貼上"
          />
        </label>
        {message ? <p className="status">{message}</p> : null}
      </div>
    </details>
  );
}
