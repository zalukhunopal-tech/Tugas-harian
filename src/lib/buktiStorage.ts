import { BuktiItem, NamaDana } from "../types";

export interface PendingBuktiUpload {
  id: string; // ID bukti
  trxId: string;
  namaFile: string;
  tipe: string;
  blob: Blob;
  dana: NamaDana;
  waktu: string;
}

const DB_NAME = "keuangan_bukti_offline";
const STORE_NAME = "antrean_bukti";
const DB_VERSION = 1;

function bukaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB tidak didukung di lingkungan ini"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function simpanBuktiOffline(item: PendingBuktiUpload): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await bukaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Gagal menyimpan bukti ke IndexedDB:", e);
  }
}

export async function ambilSemuaBuktiOffline(): Promise<PendingBuktiUpload[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await bukaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Gagal mengambil bukti offline:", e);
    return [];
  }
}

export async function hapusBuktiOffline(id: string): Promise<void> {
  try {
    const db = await bukaDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Gagal menghapus bukti offline dari IndexedDB:", e);
  }
}

/**
 * Kecilkan foto sebelum diunggah:
 * - Sisi terpanjang maks. 1600 px
 * - Format JPEG kualitas ±80% (0.8)
 * - Jika PDF, pertahankan dokumen asli
 */
export async function kompresBukti(
  file: File | Blob,
  namaAsli: string = "bukti.jpg"
): Promise<{ blob: Blob; dataUrl: string; namaFile: string; tipe: string; lebarPx?: number; tinggiPx?: number }> {
  const tipe = file.type || (namaAsli.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");

  // Jika PDF, tidak perlu dikompres sebagai canvas
  if (tipe === "application/pdf" || namaAsli.toLowerCase().endsWith(".pdf")) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return {
      blob: file,
      dataUrl,
      namaFile: namaAsli,
      tipe: "application/pdf",
    };
  }

  // Kompresi gambar
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 2048;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Gagal membuat canvas context"));
        return;
      }

      // Pastikan smoothing berkualitas tinggi agar teks struk tetap tajam dan tidak buram
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Beri background putih untuk mengantisipasi PNG transparan sebelum convert ke JPEG
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Gagal mengompres gambar ke Blob"));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve({
              blob,
              dataUrl,
              namaFile: namaAsli.replace(/\.[^/.]+$/, "") + ".jpg",
              tipe: "image/jpeg",
              lebarPx: width,
              tinggiPx: height,
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.88
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/**
 * Format nama file bukti:
 * YYYY-MM-DD_uraian-singkat_ID.ext
 */
export function formatNamaFileBukti(
  tanggal: string,
  uraian: string,
  id: string,
  ekstensi: string = "jpg"
): string {
  const tgl = tanggal || new Date().toISOString().slice(0, 10);
  const uraianSingkat = (uraian || "transaksi")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "bukti";

  const cleanId = id.slice(-6);
  return `${tgl}_${uraianSingkat}_${cleanId}.${ekstensi}`;
}

/**
 * Konversi dataURL base64 menjadi Blob untuk upload ke Google Drive
 */
export function konversiDataUrlKeBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(parts[1] || "");
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

