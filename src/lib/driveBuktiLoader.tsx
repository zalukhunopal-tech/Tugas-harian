import React, { useState, useEffect } from "react";
import { BuktiItem } from "../types";
import { FileText, ExternalLink, Loader2 } from "lucide-react";

/**
 * Ekstrak ID file Google Drive dari URL berkas
 * Pola yang didukung:
 * - https://drive.google.com/file/d/<ID>/view...
 * - https://drive.google.com/open?id=<ID>
 * - id=<ID>
 * - atau string ID langsung
 */
export function ekstrakDriveFileId(urlOrId?: string): string | null {
  if (!urlOrId) return null;
  const str = urlOrId.trim();

  // Pola /d/<ID>/
  const matchD = str.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (matchD) return matchD[1];

  // Pola id=<ID>
  const matchId = str.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (matchId) return matchId[1];

  // Pola string id langsung tanpa slash
  if (/^[a-zA-Z0-9_-]{25,}$/.test(str)) {
    return str;
  }

  return null;
}

// In-Memory Blob Cache untuk efisiensi instan selama sesi berjalan
const memoryBlobUrlCache = new Map<string, { url: string; isPdf: boolean; timestamp: number }>();

// IndexedDB untuk menyimpan maksimal 50 berkas blob bukti
const IDB_NAME = "keuangan_drive_bukti_cache";
const IDB_STORE = "drive_blob_cache";
const IDB_VERSION = 1;
const MAX_CACHE_ITEMS = 50;

function bukaDbCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak didukung"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, { keyPath: "fileId" });
        store.createIndex("waktu", "waktu", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function simpanBlobKeIndexedDB(fileId: string, blob: Blob, mimeType: string): Promise<void> {
  try {
    const db = await bukaDbCache();
    const tx = db.transaction(IDB_STORE, "readwrite");
    const store = tx.objectStore(IDB_STORE);

    // Hitung jumlah item saat ini
    const countReq = store.count();
    countReq.onsuccess = async () => {
      if (countReq.result >= MAX_CACHE_ITEMS) {
        // Pangkas data tertua
        const index = store.index("waktu");
        const cursorReq = index.openCursor();
        let deleted = 0;
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (cursor && deleted < 5) {
            cursor.delete();
            deleted++;
            cursor.continue();
          }
        };
      }
      store.put({
        fileId,
        blob,
        mimeType,
        waktu: Date.now(),
      });
    };
  } catch (e) {
    console.warn("Gagal menyimpan blob ke IndexedDB:", e);
  }
}

async function ambilBlobDariIndexedDB(fileId: string): Promise<{ blob: Blob; mimeType: string } | null> {
  try {
    const db = await bukaDbCache();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(fileId);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve({ blob: req.result.blob, mimeType: req.result.mimeType });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export interface HasilMuatBukti {
  url?: string;
  isPdf?: boolean;
  sedangMemuat?: boolean;
  gagal?: boolean;
  linkDrive?: string;
  namaFile?: string;
}

/**
 * Memuat URL pratinjau bukti transaksi secara asinkron
 */
export async function muatPratinjauBukti(
  bukti: BuktiItem,
  googleToken?: string
): Promise<{ url?: string; isPdf?: boolean; gagal?: boolean }> {
  // 1. Jika dataUrl sudah ada lokal (base64)
  if (bukti.dataUrl) {
    const isPdf = bukti.tipe === "application/pdf" || bukti.nama.toLowerCase().endsWith(".pdf");
    return { url: bukti.dataUrl, isPdf, gagal: false };
  }

  const rawLink = bukti.driveLink || "";
  const fileId = bukti.driveId || ekstrakDriveFileId(rawLink);
  const isPdfMeta = bukti.tipe === "application/pdf" || bukti.nama.toLowerCase().endsWith(".pdf") || rawLink.toLowerCase().includes(".pdf");

  if (!fileId) {
    return { gagal: true, isPdf: isPdfMeta };
  }

  // 2. Cek Memory Cache
  if (memoryBlobUrlCache.has(fileId)) {
    const cached = memoryBlobUrlCache.get(fileId)!;
    return { url: cached.url, isPdf: cached.isPdf, gagal: false };
  }

  // 3. Cek IndexedDB Cache
  const dariIdb = await ambilBlobDariIndexedDB(fileId);
  if (dariIdb) {
    const objUrl = URL.createObjectURL(dariIdb.blob);
    const isPdf = isPdfMeta || dariIdb.mimeType.includes("pdf");
    memoryBlobUrlCache.set(fileId, { url: objUrl, isPdf, timestamp: Date.now() });
    return { url: objUrl, isPdf, gagal: false };
  }

  // 4. Unduh via Drive API jika ada token login Google
  if (googleToken) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${googleToken}` },
      });

      if (res.ok) {
        const blob = await res.blob();
        const mime = blob.type || (isPdfMeta ? "application/pdf" : "image/jpeg");
        const isPdf = mime.includes("pdf") || isPdfMeta;
        const objUrl = URL.createObjectURL(blob);

        memoryBlobUrlCache.set(fileId, { url: objUrl, isPdf, timestamp: Date.now() });
        void simpanBlobKeIndexedDB(fileId, blob, mime);

        return { url: objUrl, isPdf, gagal: false };
      }
    } catch (err) {
      console.warn(`Gagal unduh media file ${fileId} dari Drive API:`, err);
    }

    // 5. Coba thumbnailLink
    try {
      const resMeta = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink,mimeType,name`,
        { headers: { Authorization: `Bearer ${googleToken}` } }
      );
      if (resMeta.ok) {
        const meta = await resMeta.json();
        const isPdf = (meta.mimeType || "").includes("pdf") || isPdfMeta;
        if (meta.thumbnailLink) {
          return { url: meta.thumbnailLink, isPdf, gagal: false };
        }
      }
    } catch {
      // lanjut fallback
    }
  }

  // Gagal / belum login / offline
  return { gagal: true, isPdf: isPdfMeta };
}

/**
 * Komponen SVG GambarPengganti persis sesuai instruksi user
 */
export const GambarPengganti: React.FC<{
  style?: React.CSSProperties;
  className?: string;
}> = ({ style, className }) => (
  <svg
    viewBox="0 0 160 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Pratinjau bukti belum tersedia"
    className={className}
    style={{ color: "var(--accent)", width: "100%", height: "100%", ...style }}
  >
    <ellipse cx="80" cy="111" rx="44" ry="5" fill="currentColor" opacity=".1" />
    <path
      d="M50 12h60a6 6 0 0 1 6 6v78l-6-5-6 5-6-5-6 5-6-5-6 5-6-5-6 5-6-5-6 5-6-5-6 5V18a6 6 0 0 1 6-6Z"
      fill="currentColor"
      fillOpacity=".07"
      stroke="currentColor"
      strokeOpacity=".6"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path d="M58 28h44M58 38h30" stroke="currentColor" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
    <path d="M58 54h22M92 54h10M58 64h22M92 64h10M58 74h22M92 74h10" stroke="currentColor" strokeOpacity=".3" strokeWidth="3" strokeLinecap="round" />
    <circle cx="116" cy="86" r="18" fill="currentColor" fillOpacity=".16" stroke="currentColor" strokeWidth="2" />
    <path d="M106 93l6-7 4 4 3-3 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="120" cy="80" r="2.2" fill="currentColor" />
  </svg>
);

interface KotakPratinjauBelumTersediaProps {
  linkDrive?: string;
  style?: React.CSSProperties;
}

/**
 * Tampilan fallback dalam kotak putus-putus dengan GambarPengganti & tombol buka di Drive
 */
export const KotakPratinjauBelumTersedia: React.FC<KotakPratinjauBelumTersediaProps> = ({
  linkDrive,
  style,
}) => {
  return (
    <div
      style={{
        border: "1.5px dashed var(--border)",
        borderRadius: "14px",
        background: "var(--surface)",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: "10px",
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    >
      <div style={{ width: "120px", height: "90px" }}>
        <GambarPengganti />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)" }}>
          Pratinjau belum tersedia
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "2px" }}>
          Berkas tetap aman di Google Drive.
        </div>
      </div>
      {linkDrive && (
        <a
          href={linkDrive}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.82rem",
            padding: "8px 14px",
            textDecoration: "none",
            borderRadius: "8px",
            marginTop: "4px",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={14} />
          <span>Buka di Google Drive</span>
        </a>
      )}
    </div>
  );
};
